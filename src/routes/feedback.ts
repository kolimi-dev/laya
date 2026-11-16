import { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import * as jose from 'jose';
import { Resend } from 'resend';
import { getEnv } from '../config/env.js';

const FeedbackInputSchema = z.object({
  category: z.enum(['bug', 'feature_request', 'feature', 'compliment', 'general', 'support']).default('general'),
  message: z.string().trim().min(3, 'Feedback message must be at least 3 characters').max(5000),
  senderName: z.string().trim().max(100).optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
  diagnostics: z.string().max(3000).optional(),
  context: z.record(z.string(), z.any()).optional(),
});

const CATEGORY_LABELS: Record<string, string> = {
  bug: '🐛 Bug Report',
  feature_request: '✨ Feature Idea',
  feature: '✨ Feature Idea',
  compliment: '❤️ Compliment',
  support: '🛟 Support',
  general: '💬 General Feedback',
};

export async function feedbackRoutes(app: FastifyInstance): Promise<void> {
  const env = getEnv();
  const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

  app.post('/api/v1/feedback', async (request, reply) => {
    const parseResult = FeedbackInputSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        title: 'Invalid Feedback Payload',
        status: 400,
        detail: parseResult.error.issues[0]?.message ?? 'Invalid feedback payload',
      });
    }

    const body = parseResult.data;
    const feedbackId = `fbk_${randomUUID().replace(/-/g, '')}`;
    const receivedAt = new Date().toISOString();

    let callerUserId = 'guest';
    let callerEmail = body.email || undefined;

    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const payload = jose.decodeJwt(token);
        if (payload?.sub) callerUserId = String(payload.sub);
        if (!callerEmail && payload?.email) callerEmail = String(payload.email);
      } catch {}
    }

    const catHeader = CATEGORY_LABELS[body.category] || body.category;
    const senderDisplay = body.senderName
      ? `${body.senderName}${callerEmail ? ` <${callerEmail}>` : ''}`
      : callerEmail || 'Anonymous Guest';

    let emailDelivered = false;
    if (resend) {
      try {
        const preview = body.message.replace(/\s+/g, ' ').slice(0, 45);
        const subject = `[Laya Feedback] ${catHeader}: ${preview}...`;

        const textLines = [
          `New Feedback Received from Laya Mobile:`,
          `-------------------------------------------`,
          `Category: ${catHeader}`,
          `Sender: ${senderDisplay} (${callerUserId})`,
          `Timestamp: ${receivedAt}`,
          `ID: ${feedbackId}`,
          ``,
          `MESSAGE:`,
          body.message,
        ];
        if (body.diagnostics) {
          textLines.push(``, `DIAGNOSTICS:`, body.diagnostics);
        }
        const textContent = textLines.join('\n');

        const escapedMsg = body.message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const escapedDiag = body.diagnostics ? body.diagnostics.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';

        const htmlContent = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #18181B; line-height: 1.6; padding: 20px; background-color: #F4F4F5;">
  <div style="max-width: 560px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E4E4E7; border-radius: 12px; padding: 28px;">
    <div style="display: inline-block; padding: 4px 10px; background: #EFF6FF; color: #2563EB; font-weight: 600; font-size: 13px; border-radius: 6px; margin-bottom: 12px;">
      ${catHeader}
    </div>
    <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #09090B;">New In-App Feedback</h2>
    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
      <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748B;"><strong>From:</strong> ${senderDisplay}</p>
      <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748B;"><strong>User ID:</strong> ${callerUserId}</p>
      <p style="margin: 0; font-size: 13px; color: #64748B;"><strong>Received At:</strong> ${receivedAt}</p>
    </div>
    <div style="margin-bottom: 24px;">
      <h3 style="font-size: 14px; text-transform: uppercase; color: #71717A; margin-bottom: 8px;">Message</h3>
      <div style="white-space: pre-wrap; background: #FAFAFA; border: 1px solid #F4F4F5; border-radius: 8px; padding: 14px; font-size: 15px; color: #18181B;">${escapedMsg}</div>
    </div>
    ${body.diagnostics ? `
    <div style="margin-bottom: 20px;">
      <h3 style="font-size: 13px; text-transform: uppercase; color: #71717A; margin-bottom: 6px;">Diagnostics</h3>
      <pre style="background: #18181B; color: #F4F4F5; padding: 12px; border-radius: 6px; font-size: 12px; overflow-x: auto;">${escapedDiag}</pre>
    </div>` : ''}
    <div style="border-top: 1px solid #F1F5F9; padding-top: 14px; font-size: 11px; color: #94A3B8;">
      Dispatched by Laya Feedback Gateway • ID: ${feedbackId}
    </div>
  </div>
</body>
</html>`;

        await resend.emails.send({
          from: env.FEEDBACK_FROM_EMAIL,
          to: env.FEEDBACK_TARGET_EMAIL,
          replyTo: callerEmail || undefined,
          subject,
          text: textContent,
          html: htmlContent,
        });
        emailDelivered = true;
        request.log.info({ feedbackId, to: env.FEEDBACK_TARGET_EMAIL }, 'Feedback email sent via Resend');
      } catch (err) {
        request.log.error(err, 'Failed to dispatch feedback email via Resend');
      }
    } else {
      request.log.warn({ feedbackId }, 'Resend API key missing; logged feedback locally');
    }

    return reply.status(201).send({
      success: true,
      feedbackId,
      userId: callerUserId,
      category: body.category,
      deliveredViaEmail: emailDelivered,
      receivedAt,
    });
  });
}
