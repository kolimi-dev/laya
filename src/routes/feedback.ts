import { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { UserId } from '../domain/types.js';

const FeedbackInputSchema = z.object({
  category: z.enum(['bug', 'feature_request', 'general', 'support']).default('general'),
  message: z.string().trim().min(3, 'Feedback message must be at least 3 characters').max(2000),
  context: z.record(z.string(), z.any()).optional(),
});

export async function feedbackRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/v1/feedback', async (request, reply) => {
    const userId = request.user.userId as UserId;
    const body = FeedbackInputSchema.parse(request.body);

    const feedbackId = `fbk_${randomUUID().replace(/-/g, '')}`;
    const receivedAt = new Date().toISOString();

    // In production, this can forward to the platform or append to support ticket queue
    reply.status(201);
    return {
      success: true,
      feedbackId,
      userId,
      category: body.category,
      receivedAt,
    };
  });
}
