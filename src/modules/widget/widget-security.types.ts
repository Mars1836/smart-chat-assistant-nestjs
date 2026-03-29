export interface ChatbotWidgetSecurityConfig {
  enabled: boolean;

  allowed_origins?: string[];
  allowed_ips?: string[] | null;

  public_api_key?: string | null;

  rate_limit_window_sec: number;
  rate_limit_max_requests: number;
}

export interface ChatbotWidgetConfig {
  ui?: Record<string, any> | null;
  security: ChatbotWidgetSecurityConfig;
}
