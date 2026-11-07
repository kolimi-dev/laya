import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthenticatedUser, JwtVerifier } from './types.js';
import { UnauthorizedError } from '../domain/errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthenticatedUser;
  }
}

export function createAuthPreHandler(verifier: JwtVerifier) {
  return async function authPreHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedError('Missing Authorization header. Expected Bearer <token>.');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer' || !parts[1].trim()) {
      throw new UnauthorizedError('Malformed Authorization header. Format: Bearer <token>.');
    }

    const token = parts[1].trim();
    const user = await verifier.verifyToken(token);
    request.user = user;
  };
}
