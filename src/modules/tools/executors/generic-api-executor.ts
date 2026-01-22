import { Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { BaseToolExecutor, ExecutionContext } from './base-executor';
import { OAuthService } from '../oauth.service';

/**
 * Action executor configuration schema (stored in tool_actions.executor_config)
 * 
 * Example for Gmail list_emails:
 * {
 *   "method": "GET",
 *   "endpoint": "/users/me/messages",
 *   "params": {
 *     "query": {
 *       "q": "{{query}}",
 *       "maxResults": "{{maxResults}}",
 *       "pageToken": "{{pageToken}}"
 *     }
 *   }
 * }
 * 
 * Example for Gmail send_email:
 * {
 *   "method": "POST",
 *   "endpoint": "/users/me/messages/send",
 *   "content_type": "application/json",
 *   "body": {
 *     "raw": "{{_computed.encoded_message}}"
 *   },
 *   "pre_process": "gmail_encode_message"
 * }
 */
export interface ActionExecutorConfig {
  // HTTP method
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

  // Endpoint path (can contain {{param}} placeholders)
  endpoint: string;

  // Content type for request body
  content_type?: string;

  // Parameter mappings
  params?: {
    // Path parameters: /users/{{userId}}/messages/{{messageId}}
    path?: Record<string, string>;
    // Query parameters: ?q={{query}}&maxResults={{limit}}
    query?: Record<string, string>;
    // Header parameters
    headers?: Record<string, string>;
    // Body template (for POST/PUT/PATCH)
    body?: Record<string, any> | string;
  };

  // Pre-processing function name (for special transformations like Gmail message encoding)
  pre_process?: string;

  // Response transformation (JMESPath expression)
  response_transform?: string;

  // Success message template
  success_message?: string;
}

/**
 * Generic API Executor - handles any API call based on configuration
 * No hardcoded logic for specific APIs
 */
export class GenericApiExecutor extends BaseToolExecutor {
  private readonly logger = new Logger(GenericApiExecutor.name);

  constructor(
    config: Record<string, any>,
    private readonly oauthService?: OAuthService,
  ) {
    super(config);
  }

  async execute(
    params: Record<string, any>,
    context: ExecutionContext,
  ): Promise<any> {
    const baseUrl = this.config.base_url as string;
    if (!baseUrl) {
      throw new BadRequestException('API executor requires base_url in config');
    }

    // Get action config
    const actionConfig: ActionExecutorConfig = params._actionConfig || {};
    const method = actionConfig.method || 'GET';
    let endpoint = actionConfig.endpoint || '/';

    // Get authentication token if needed
    const authType = this.config.auth_type || 'none';
    let authHeaders: Record<string, string> = {};

    if (authType === 'oauth2' && this.oauthService) {
      const token = await this.getOAuthToken(context, params._toolId);
      authHeaders['Authorization'] = `Bearer ${token}`;
    } else if (authType === 'api_key') {
      const apiKey = this.config.api_key || params._apiKey;
      const headerName = this.config.api_key_header || 'X-API-Key';
      if (apiKey) {
        authHeaders[headerName] = apiKey;
      }
    } else if (authType === 'bearer') {
      const token = this.config.bearer_token || params._bearerToken;
      if (token) {
        authHeaders['Authorization'] = `Bearer ${token}`;
      }
    }

    // Clean params (remove internal fields)
    const cleanParams = this.cleanParams(params);

    // Apply pre-processing if specified
    let processedParams = cleanParams;
    if (actionConfig.pre_process) {
      processedParams = await this.preProcess(
        actionConfig.pre_process,
        cleanParams,
        context,
      );
    }

    // Build URL with path parameter substitution
    endpoint = this.substitutePathParams(
      endpoint,
      actionConfig.params?.path || {},
      processedParams,
    );

    const url = `${baseUrl}${endpoint}`;

    // Build query string
    const queryString = this.buildQueryString(
      actionConfig.params?.query || {},
      processedParams,
    );

    const fullUrl = queryString ? `${url}?${queryString}` : url;

    // Build headers
    const headers: Record<string, string> = {
      ...authHeaders,
      ...(actionConfig.params?.headers
        ? this.substituteValues(actionConfig.params.headers, processedParams)
        : {}),
    };

    // Build body
    let body: any = null;
    if (['POST', 'PUT', 'PATCH'].includes(method) && actionConfig.params?.body) {
      body = this.buildBody(actionConfig.params.body, processedParams);
      headers['Content-Type'] = actionConfig.content_type || 'application/json';
    }

    // Make request
    const response = await this.makeRequest(fullUrl, method, body, headers);

    // Transform response if specified
    if (actionConfig.response_transform) {
      return this.transformResponse(response, actionConfig.response_transform);
    }

    // Build success message if specified
    if (actionConfig.success_message) {
      return {
        success: true,
        message: this.substituteTemplate(
          actionConfig.success_message,
          { ...processedParams, _response: response },
        ),
        data: response,
      };
    }

    return response;
  }

  /**
   * Get OAuth token for user
   */
  private async getOAuthToken(
    context: ExecutionContext,
    toolId: string,
  ): Promise<string> {
    if (!this.oauthService) {
      throw new BadRequestException('OAuth service not available');
    }

    if (!context.userId || !context.workspaceId) {
      throw new UnauthorizedException(
        'User and workspace context required for OAuth',
      );
    }

    try {
      return await this.oauthService.getAccessToken(
        context.userId,
        context.workspaceId,
        toolId,
      );
    } catch (error: any) {
      throw new UnauthorizedException(
        `OAuth not connected. Please connect your account first. (${error.message})`,
      );
    }
  }

  /**
   * Remove internal params (starting with _)
   */
  private cleanParams(params: Record<string, any>): Record<string, any> {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(params)) {
      if (!key.startsWith('_')) {
        clean[key] = value;
      }
    }
    return clean;
  }

  /**
   * Substitute path parameters in endpoint
   * /users/{{userId}}/messages/{{messageId}} -> /users/123/messages/456
   */
  private substitutePathParams(
    endpoint: string,
    pathConfig: Record<string, string>,
    params: Record<string, any>,
  ): string {
    let result = endpoint;

    // First, substitute from explicit path config
    for (const [placeholder, paramName] of Object.entries(pathConfig)) {
      const value = this.resolveValue(paramName, params);
      if (value !== undefined && value !== null) {
        result = result.replace(`{{${placeholder}}}`, String(value));
      }
    }

    // Then, substitute any remaining {{param}} directly from params
    result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = params[key];
      return value !== undefined && value !== null ? String(value) : '';
    });

    return result;
  }

  /**
   * Build query string from config and params
   */
  private buildQueryString(
    queryConfig: Record<string, string>,
    params: Record<string, any>,
  ): string {
    const queryParams = new URLSearchParams();

    for (const [queryKey, paramRef] of Object.entries(queryConfig)) {
      const value = this.resolveValue(paramRef, params);
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(queryKey, String(value));
      }
    }

    return queryParams.toString();
  }

  /**
   * Build request body from config and params
   */
  private buildBody(
    bodyConfig: Record<string, any> | string,
    params: Record<string, any>,
  ): any {
    if (typeof bodyConfig === 'string') {
      // String template
      return this.substituteTemplate(bodyConfig, params);
    }

    // Object template - deep substitute
    return this.deepSubstitute(bodyConfig, params);
  }

  /**
   * Deep substitute {{param}} in object
   */
  private deepSubstitute(
    obj: any,
    params: Record<string, any>,
  ): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      // Check if entire string is a placeholder
      const match = obj.match(/^\{\{(.+)\}\}$/);
      if (match) {
        return this.resolveValue(match[1], params);
      }
      // Otherwise, substitute within string
      return this.substituteTemplate(obj, params);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.deepSubstitute(item, params));
    }

    if (typeof obj === 'object') {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        const substitutedValue = this.deepSubstitute(value, params);
        // Only include if value is not undefined/null/empty
        if (
          substitutedValue !== undefined &&
          substitutedValue !== null &&
          substitutedValue !== ''
        ) {
          result[key] = substitutedValue;
        }
      }
      return result;
    }

    return obj;
  }

  /**
   * Substitute {{param}} placeholders in template string
   */
  private substituteTemplate(
    template: string,
    params: Record<string, any>,
  ): string {
    return template.replace(/\{\{(.+?)\}\}/g, (_, key) => {
      const value = this.resolveValue(key.trim(), params);
      return value !== undefined && value !== null ? String(value) : '';
    });
  }

  /**
   * Substitute values in a flat object
   */
  private substituteValues(
    obj: Record<string, string>,
    params: Record<string, any>,
  ): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, template] of Object.entries(obj)) {
      const value = this.substituteTemplate(template, params);
      if (value) {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Resolve value from params using dot notation
   * e.g., "user.email" -> params.user.email
   */
  private resolveValue(path: string, params: Record<string, any>): any {
    const parts = path.split('.');
    let value: any = params;

    for (const part of parts) {
      if (value === undefined || value === null) {
        return undefined;
      }
      value = value[part];
    }

    return value;
  }

  /**
   * Pre-process parameters (for special transformations)
   */
  private async preProcess(
    processorName: string,
    params: Record<string, any>,
    context: ExecutionContext,
  ): Promise<Record<string, any>> {
    switch (processorName) {
      case 'gmail_encode_message':
        return this.gmailEncodeMessage(params);

      case 'gmail_encode_reply':
        // For reply, we need to fetch original message first
        return this.gmailEncodeReply(params, context);

      default:
        this.logger.warn(`Unknown pre-processor: ${processorName}`);
        return params;
    }
  }

  /**
   * Gmail message encoding (RFC 2822 + base64url)
   */
  private gmailEncodeMessage(params: Record<string, any>): Record<string, any> {
    const headers: string[] = [];

    if (params.to) {
      const to = String(params.to).split(',').map((e) => e.trim()).join(', ');
      headers.push(`To: ${to}`);
    }

    if (params.subject) {
      headers.push(`Subject: ${params.subject}`);
    }

    if (params.cc) {
      headers.push(`Cc: ${params.cc}`);
    }

    if (params.bcc) {
      headers.push(`Bcc: ${params.bcc}`);
    }

    headers.push('MIME-Version: 1.0');

    if (params.isHtml) {
      headers.push('Content-Type: text/html; charset=UTF-8');
    } else {
      headers.push('Content-Type: text/plain; charset=UTF-8');
    }

    const message = [...headers, '', params.body || ''].join('\r\n');

    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return {
      ...params,
      _computed: {
        ...params._computed,
        encoded_message: encodedMessage,
      },
    };
  }

  /**
   * Gmail reply encoding
   */
  private async gmailEncodeReply(
    params: Record<string, any>,
    context: ExecutionContext,
  ): Promise<Record<string, any>> {
    // This would need to fetch original message - for now, simplified
    const headers: string[] = [];

    if (params.replyTo) {
      headers.push(`To: ${params.replyTo}`);
    }

    if (params.subject) {
      headers.push(`Subject: Re: ${params.subject.replace(/^Re:\s*/i, '')}`);
    }

    if (params.inReplyTo) {
      headers.push(`In-Reply-To: ${params.inReplyTo}`);
      headers.push(`References: ${params.inReplyTo}`);
    }

    headers.push('MIME-Version: 1.0');
    headers.push(
      params.isHtml
        ? 'Content-Type: text/html; charset=UTF-8'
        : 'Content-Type: text/plain; charset=UTF-8',
    );

    const message = [...headers, '', params.body || ''].join('\r\n');

    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return {
      ...params,
      _computed: {
        ...params._computed,
        encoded_message: encodedMessage,
      },
    };
  }

  /**
   * Transform response using JMESPath-like expression
   * Simple implementation - can be extended with jmespath library
   */
  private transformResponse(response: any, expression: string): any {
    // Simple dot notation for now
    // e.g., "messages" -> response.messages
    // e.g., "data.items[*].name" -> more complex (would need jmespath)
    
    if (!expression || expression === '.') {
      return response;
    }

    try {
      const parts = expression.split('.');
      let result = response;

      for (const part of parts) {
        if (result === undefined || result === null) {
          return null;
        }
        result = result[part];
      }

      return result;
    } catch {
      return response;
    }
  }

  /**
   * Make HTTP request
   */
  private async makeRequest(
    url: string,
    method: string,
    body: any,
    headers: Record<string, string>,
  ): Promise<any> {
    try {
      this.logger.debug(`${method} ${url}`);

      const options: RequestInit = {
        method,
        headers,
      };

      if (body !== null && body !== undefined) {
        options.body =
          typeof body === 'string' ? body : JSON.stringify(body);
      }

      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`API error: ${response.status} - ${errorText}`);

        if (response.status === 401) {
          throw new UnauthorizedException(
            'Authentication failed. Please reconnect your account.',
          );
        }

        throw new BadRequestException(
          `API request failed: ${response.status} - ${errorText}`,
        );
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return response.json();
      }

      return response.text();
    } catch (error) {
      this.logger.error('API request error:', error);
      throw error;
    }
  }
}
