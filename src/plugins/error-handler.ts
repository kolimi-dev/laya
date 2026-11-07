import { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { LayaDomainError } from '../domain/errors.js';

export interface Rfc7807Problem {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string;
  instance: string;
  timestamp: string;
  invalidParams?: Array<{ name: string; reason: string }>;
}

export function registerErrorHandler(app: FastifyInstance): void {
  // Fastify 404 handler for unknown routes
  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    const problem: Rfc7807Problem = {
      type: 'https://errors.kolimi.dev/tracker/route-not-found',
      title: 'Route Not Found',
      status: 404,
      detail: `Cannot ${request.method} ${request.url}`,
      code: 'ROUTE_NOT_FOUND',
      instance: request.url,
      timestamp: new Date().toISOString(),
    };
    reply.status(404).header('content-type', 'application/problem+json').send(problem);
  });

  // Global error handler
  app.setErrorHandler((error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) => {
    // 1. Domain Errors
    if (error instanceof LayaDomainError) {
      const problem: Rfc7807Problem = {
        type: `https://errors.kolimi.dev/tracker/${error.code.toLowerCase().replace(/_/g, '-')}`,
        title: error.title,
        status: error.status,
        detail: error.detail,
        code: error.code,
        instance: request.url,
        timestamp: new Date().toISOString(),
      };
      reply.status(error.status).header('content-type', 'application/problem+json').send(problem);
      return;
    }

    // 2. Zod Validation Errors
    if (error instanceof ZodError) {
      const problem: Rfc7807Problem = {
        type: 'https://errors.kolimi.dev/tracker/validation-error',
        title: 'Validation Failed',
        status: 400,
        detail: 'One or more request parameters failed validation.',
        code: 'VALIDATION_FAILED',
        instance: request.url,
        timestamp: new Date().toISOString(),
        invalidParams: error.issues.map((i) => ({
          name: i.path.join('.'),
          reason: i.message,
        })),
      };
      reply.status(400).header('content-type', 'application/problem+json').send(problem);
      return;
    }

    // 3. Fastify Validation Errors (schema validation)
    if ('validation' in error && Array.isArray((error as any).validation)) {
      const problem: Rfc7807Problem = {
        type: 'https://errors.kolimi.dev/tracker/validation-error',
        title: 'Validation Failed',
        status: 400,
        detail: error.message,
        code: 'VALIDATION_FAILED',
        instance: request.url,
        timestamp: new Date().toISOString(),
        invalidParams: ((error as any).validation as any[]).map((v) => ({
          name: v.instancePath ?? v.params?.issue ?? 'body',
          reason: v.message ?? 'Invalid parameter',
        })),
      };
      reply.status(400).header('content-type', 'application/problem+json').send(problem);
      return;
    }

    // 4. Default 500 Uncaught Errors
    const statusCode = typeof (error as any).statusCode === 'number' ? (error as any).statusCode : 500;
    const isProd = process.env.NODE_ENV === 'production';

    const problem: Rfc7807Problem = {
      type: 'https://errors.kolimi.dev/tracker/internal-server-error',
      title: statusCode === 500 ? 'Internal Server Error' : error.name,
      status: statusCode,
      detail: isProd && statusCode === 500 ? 'An unexpected server error occurred.' : error.message,
      code: statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'HTTP_ERROR',
      instance: request.url,
      timestamp: new Date().toISOString(),
    };

    reply.status(statusCode).header('content-type', 'application/problem+json').send(problem);
  });
}
