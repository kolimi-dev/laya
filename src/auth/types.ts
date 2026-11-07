/**
 * Laya (लय) — Auth Types
 * Universal Kolimi ID identity consumer interface.
 */

export interface AuthenticatedUser {
  userId: string;
  phone?: string;
  roles: string[];
  sessionId?: string;
}

export interface JwtVerifier {
  verifyToken(token: string): Promise<AuthenticatedUser>;
}
