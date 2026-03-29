import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  Res,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response, Request } from 'express';
import { OAuthService } from './oauth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { WORKSPACE_PERMISSIONS } from '../../common/constants/permissions.constant';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('oauth')
@Controller()
export class OAuthController {
  constructor(private readonly oauthService: OAuthService) {}

  // =====================
  // WORKSPACE-SCOPED ENDPOINTS (Authenticated)
  // =====================

  @Get('workspaces/:workspaceId/tools/:toolId/oauth/authorize')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get OAuth authorization URL',
    description:
      'Returns the URL to redirect user to for OAuth authorization (e.g., Google login)',
  })
  @ApiResponse({
    status: 200,
    description: 'Authorization URL generated',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'OAuth authorization URL' },
        state: {
          type: 'string',
          description: 'State token for CSRF protection',
        },
      },
    },
  })
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_VIEW)
  async getAuthorizationUrl(
    @Param('workspaceId') workspaceId: string,
    @Param('toolId') toolId: string,
    @CurrentUser() user: any,
  ): Promise<{ url: string; state: string }> {
    return this.oauthService.generateAuthUrl(workspaceId, toolId, user.sub);
  }

  @Get('workspaces/:workspaceId/tools/:toolId/oauth/status')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Check OAuth connection status',
    description: 'Check if user has connected their account for this tool',
  })
  @ApiResponse({
    status: 200,
    description: 'Connection status',
    schema: {
      type: 'object',
      properties: {
        connected: { type: 'boolean' },
        profile: {
          type: 'object',
          nullable: true,
          properties: {
            email: { type: 'string' },
            name: { type: 'string' },
            picture: { type: 'string' },
          },
        },
        connected_at: { type: 'string', format: 'date-time', nullable: true },
      },
    },
  })
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_VIEW)
  async getConnectionStatus(
    @Param('workspaceId') workspaceId: string,
    @Param('toolId') toolId: string,
    @CurrentUser() user: any,
  ): Promise<{
    connected: boolean;
    profile: { email?: string; name?: string; picture?: string } | null;
    connected_at: Date | null;
  }> {
    const credential = await this.oauthService.getCredential(
      user.sub,
      workspaceId,
      toolId,
    );

    if (!credential || !credential.is_active) {
      return { connected: false, profile: null, connected_at: null };
    }

    return {
      connected: true,
      profile: credential.profile,
      connected_at: credential.connected_at,
    };
  }

  @Delete('workspaces/:workspaceId/tools/:toolId/oauth/disconnect')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Disconnect OAuth account',
    description: 'Revoke and remove OAuth connection for this tool',
  })
  @ApiResponse({ status: 204, description: 'Disconnected successfully' })
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_VIEW)
  async disconnect(
    @Param('workspaceId') workspaceId: string,
    @Param('toolId') toolId: string,
    @CurrentUser() user: any,
  ): Promise<void> {
    await this.oauthService.disconnect(user.sub, workspaceId, toolId);
  }

  @Get('workspaces/:workspaceId/oauth/credentials')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'List all OAuth connections for user in workspace',
    description: 'Get all tools that user has connected OAuth accounts for',
  })
  @ApiResponse({
    status: 200,
    description: 'List of credentials',
  })
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_VIEW)
  async listCredentials(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: any,
  ) {
    const credentials = await this.oauthService.listCredentials(
      user.sub,
      workspaceId,
    );

    return credentials.map((c) => ({
      id: c.id,
      tool_id: c.tool_id,
      tool: c.tool
        ? {
            id: c.tool.id,
            name: c.tool.name,
            display_name: c.tool.display_name,
          }
        : null,
      provider: c.provider,
      profile: c.profile,
      connected_at: c.connected_at,
      is_active: c.is_active,
    }));
  }

  // =====================
  // OAUTH CALLBACK (Public - no auth required)
  // =====================

  @Get('oauth/google/callback')
  @ApiOperation({
    summary: 'Google OAuth callback',
    description:
      'Handles Google OAuth callback. Redirects back to frontend after processing.',
  })
  @ApiQuery({ name: 'code', required: true, description: 'Authorization code' })
  @ApiQuery({ name: 'state', required: true, description: 'State token' })
  @ApiResponse({ status: 302, description: 'Redirect to frontend' })
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    if (error) {
      // User denied access or other error
      res.redirect(
        `${frontendUrl}/oauth/callback?error=${encodeURIComponent(error)}`,
      );
      return;
    }

    try {
      const credential = await this.oauthService.handleCallback(code, state);

      // Decode state to get workspace info for redirect
      const stateData = JSON.parse(Buffer.from(state, 'base64url').toString());

      // Redirect to frontend with success
      res.redirect(
        `${frontendUrl}/workspaces/${stateData.workspaceId}/plugins?` +
          `connected=true&tool=${credential.tool_id}&email=${encodeURIComponent(credential.profile?.email || '')}`,
      );
    } catch (err: any) {
      // Redirect to frontend with error
      res.redirect(
        `${frontendUrl}/oauth/callback?error=${encodeURIComponent(err.message || 'Unknown error')}`,
      );
    }
  }

  // Alternative: JSON callback for SPA (popup flow)
  @Get('oauth/callback/json')
  @ApiOperation({
    summary: 'OAuth callback (JSON response)',
    description: 'For SPA popup flow. Returns JSON instead of redirect.',
  })
  @ApiQuery({ name: 'code', required: true })
  @ApiQuery({ name: 'state', required: true })
  async callbackJson(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
  ): Promise<{
    success: boolean;
    error?: string;
    credential?: {
      tool_id: string;
      provider: string;
      profile: any;
    };
  }> {
    if (error) {
      return { success: false, error };
    }

    try {
      const credential = await this.oauthService.handleCallback(code, state);

      return {
        success: true,
        credential: {
          tool_id: credential.tool_id,
          provider: credential.provider,
          profile: credential.profile,
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Unknown error' };
    }
  }
}
