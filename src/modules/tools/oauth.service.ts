import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { UserToolCredential } from './entities/user-tool-credential.entity';
import { Tool } from './entities/tool.entity';
import { WorkspaceTool } from './entities/workspace-tool.entity';

interface OAuthConfig {
  client_id: string;
  client_secret: string;
  authorization_url: string;
  token_url: string;
  scopes: string[];
  redirect_uri: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  scope?: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    @InjectRepository(UserToolCredential)
    private readonly credentialRepo: Repository<UserToolCredential>,
    @InjectRepository(Tool)
    private readonly toolRepo: Repository<Tool>,
    @InjectRepository(WorkspaceTool)
    private readonly workspaceToolRepo: Repository<WorkspaceTool>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get OAuth config for a tool in a workspace.
   * Priority: workspace config_override > tool auth_config > env variables
   */
  async getOAuthConfig(
    workspaceId: string,
    toolId: string,
  ): Promise<OAuthConfig> {
    const tool = await this.toolRepo.findOne({ where: { id: toolId } });
    if (!tool) {
      throw new NotFoundException('Tool not found');
    }

    if (tool.auth_config?.type !== 'oauth2') {
      throw new BadRequestException('Tool does not support OAuth');
    }

    const workspaceTool = await this.workspaceToolRepo.findOne({
      where: { workspace_id: workspaceId, tool_id: toolId },
    });

    // Merge configs: workspace override > tool config > env
    const oauthConfig = tool.auth_config.oauth || {};
    const wsOverride = workspaceTool?.config_override?.oauth || {};

    const baseUrl = this.configService.get<string>('APP_URL', 'http://localhost:4000');

    return {
      client_id:
        wsOverride.client_id ||
        oauthConfig.client_id ||
        this.configService.get<string>('GOOGLE_CLIENT_ID', ''),
      client_secret:
        wsOverride.client_secret ||
        oauthConfig.client_secret ||
        this.configService.get<string>('GOOGLE_CLIENT_SECRET', ''),
      authorization_url:
        oauthConfig.authorization_url ||
        'https://accounts.google.com/o/oauth2/v2/auth',
      token_url:
        oauthConfig.token_url || 'https://oauth2.googleapis.com/token',
      scopes: oauthConfig.scopes || [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
      ],
      redirect_uri:
        wsOverride.redirect_uri ||
        this.configService.get<string>(
          'GOOGLE_REDIRECT_URI',
          `${baseUrl}/oauth/google/callback`,
        ),
    };
  }

  /**
   * Generate OAuth authorization URL for user to connect their account.
   * State contains: workspaceId, toolId, userId (encoded)
   */
  async generateAuthUrl(
    workspaceId: string,
    toolId: string,
    userId: string,
  ): Promise<{ url: string; state: string }> {
    const config = await this.getOAuthConfig(workspaceId, toolId);

    if (!config.client_id) {
      throw new BadRequestException(
        'OAuth not configured. Please set GOOGLE_CLIENT_ID or configure in workspace settings.',
      );
    }

    // Create state token (encode workspace, tool, user info)
    const stateData = {
      workspaceId,
      toolId,
      userId,
      timestamp: Date.now(),
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: config.client_id,
      redirect_uri: config.redirect_uri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      state,
      access_type: 'offline', // Get refresh token
      prompt: 'consent', // Force consent to get refresh token
    });

    const url = `${config.authorization_url}?${params.toString()}`;

    return { url, state };
  }

  /**
   * Handle OAuth callback: exchange code for tokens and save credential.
   */
  async handleCallback(
    code: string,
    state: string,
  ): Promise<UserToolCredential> {
    // Decode state
    let stateData: {
      workspaceId: string;
      toolId: string;
      userId: string;
      timestamp: number;
    };

    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch {
      throw new BadRequestException('Invalid state parameter');
    }

    // Validate timestamp (15 minutes expiry)
    if (Date.now() - stateData.timestamp > 15 * 60 * 1000) {
      throw new BadRequestException('OAuth state expired');
    }

    const { workspaceId, toolId, userId } = stateData;
    const config = await this.getOAuthConfig(workspaceId, toolId);

    // Exchange code for tokens
    const tokenResponse = await this.exchangeCodeForTokens(code, config);

    // Get user info from Google
    const userInfo = await this.getGoogleUserInfo(tokenResponse.access_token);

    // Calculate expiry
    const expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : null;

    // Upsert credential
    let credential = await this.credentialRepo.findOne({
      where: { user_id: userId, workspace_id: workspaceId, tool_id: toolId },
    });

    if (credential) {
      // Update existing
      credential.access_token = tokenResponse.access_token;
      credential.refresh_token =
        tokenResponse.refresh_token || credential.refresh_token;
      credential.expires_at = expiresAt;
      credential.scopes = tokenResponse.scope?.split(' ') || config.scopes;
      credential.profile = {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
      };
      credential.is_active = true;
    } else {
      // Create new
      credential = this.credentialRepo.create({
        user_id: userId,
        workspace_id: workspaceId,
        tool_id: toolId,
        provider: 'google',
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token || null,
        expires_at: expiresAt,
        scopes: tokenResponse.scope?.split(' ') || config.scopes,
        profile: {
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
        },
        is_active: true,
      });
    }

    return this.credentialRepo.save(credential);
  }

  /**
   * Exchange authorization code for access/refresh tokens.
   */
  private async exchangeCodeForTokens(
    code: string,
    config: OAuthConfig,
  ): Promise<TokenResponse> {
    const params = new URLSearchParams({
      client_id: config.client_id,
      client_secret: config.client_secret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirect_uri,
    });

    const response = await fetch(config.token_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Token exchange failed: ${error}`);
      throw new BadRequestException('Failed to exchange code for tokens');
    }

    return response.json();
  }

  /**
   * Get Google user info using access token.
   */
  private async getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    const response = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(
        `Failed to get Google user info: Status ${response.status}, Error: ${errorText}`,
      );
      return { id: '', email: '', name: '' };
    }

    return response.json();
  }

  /**
   * Refresh access token using refresh token.
   */
  async refreshAccessToken(credentialId: string): Promise<UserToolCredential> {
    const credential = await this.credentialRepo.findOne({
      where: { id: credentialId },
    });

    if (!credential) {
      throw new NotFoundException('Credential not found');
    }

    if (!credential.refresh_token) {
      throw new BadRequestException('No refresh token available');
    }

    const config = await this.getOAuthConfig(
      credential.workspace_id,
      credential.tool_id,
    );

    const params = new URLSearchParams({
      client_id: config.client_id,
      client_secret: config.client_secret,
      refresh_token: credential.refresh_token,
      grant_type: 'refresh_token',
    });

    const response = await fetch(config.token_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Token refresh failed: ${error}`);
      // Mark credential as inactive
      credential.is_active = false;
      await this.credentialRepo.save(credential);
      throw new BadRequestException(
        'Failed to refresh token. Please reconnect your account.',
      );
    }

    const tokenResponse: TokenResponse = await response.json();

    credential.access_token = tokenResponse.access_token;
    credential.expires_at = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : null;

    return this.credentialRepo.save(credential);
  }

  /**
   * Get valid access token for user (auto-refresh if expired).
   */
  async getAccessToken(
    userId: string,
    workspaceId: string,
    toolId: string,
  ): Promise<string> {
    const credential = await this.credentialRepo.findOne({
      where: {
        user_id: userId,
        workspace_id: workspaceId,
        tool_id: toolId,
        is_active: true,
      },
    });

    if (!credential) {
      throw new BadRequestException(
        'Account not connected. Please connect your account first.',
      );
    }

    // Check if token is expired (with 5 minute buffer)
    if (
      credential.expires_at &&
      credential.expires_at.getTime() < Date.now() + 5 * 60 * 1000
    ) {
      const refreshed = await this.refreshAccessToken(credential.id);
      return refreshed.access_token;
    }

    return credential.access_token;
  }

  /**
   * Get user's credential for a tool.
   */
  async getCredential(
    userId: string,
    workspaceId: string,
    toolId: string,
  ): Promise<UserToolCredential | null> {
    return this.credentialRepo.findOne({
      where: {
        user_id: userId,
        workspace_id: workspaceId,
        tool_id: toolId,
      },
    });
  }

  /**
   * List all credentials for a user in a workspace.
   */
  async listCredentials(
    userId: string,
    workspaceId: string,
  ): Promise<UserToolCredential[]> {
    return this.credentialRepo.find({
      where: { user_id: userId, workspace_id: workspaceId },
      relations: ['tool'],
    });
  }

  /**
   * Disconnect/revoke OAuth credential.
   */
  async disconnect(
    userId: string,
    workspaceId: string,
    toolId: string,
  ): Promise<void> {
    const credential = await this.credentialRepo.findOne({
      where: { user_id: userId, workspace_id: workspaceId, tool_id: toolId },
    });

    if (!credential) {
      return; // Already disconnected
    }

    // Optionally revoke token at Google
    try {
      await fetch(
        `https://oauth2.googleapis.com/revoke?token=${credential.access_token}`,
        { method: 'POST' },
      );
    } catch {
      // Ignore revoke errors
    }

    await this.credentialRepo.remove(credential);
  }
}
