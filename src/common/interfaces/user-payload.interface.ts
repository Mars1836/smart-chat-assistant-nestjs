export interface UserPayload {
  sub: string;
  email: string;
  systemRoleId?: string;
}

export interface JwtTokens {
  accessToken: string;
  refreshToken: string;
}
