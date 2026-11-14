/**
 * Laya (లయ) — Email OTP Authentication Routes
 * Powered by Resend (auth@kolimi.dev) with Rate Limiting & Clean Universal Template
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import crypto from 'node:crypto';
import * as jose from 'jose';
import { Resend } from 'resend';
import { getEnv } from '../config/env.js';
import { getSql } from '../storage/db.js';

const sendOtpSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

const verifyOtpSchema = z.object({
  email: z.string().email(),
  otpCode: z.string().length(6, 'Verification code must be 6 digits'),
});

interface ActiveChallenge {
  otpHash: string;
  expiresAt: Date;
  attempts: number;
  lastRequestedAt: Date;
  requestCount: number;
}

// In-memory challenge store (5-minute TTL per challenge, 15-minute sliding rate window)
const activeChallenges = new Map<string, ActiveChallenge>();

function hashString(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export async function authEmailRoutes(fastify: FastifyInstance): Promise<void> {
  const env = getEnv();
  const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

  // 1. Send Email OTP (Includes Strict Rate Limiting & Cooldown)
  fastify.post('/api/v1/auth/email/send-otp', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = sendOtpSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        title: 'Invalid Email Address',
        status: 400,
        detail: parseResult.error.issues[0]?.message ?? 'Invalid email address',
      });
    }

    const { email } = parseResult.data;
    const normalizedEmail = email.trim().toLowerCase();
    const existing = activeChallenges.get(normalizedEmail);
    const now = new Date();

    // ─── RATE LIMITING & COOLDOWN DEFENSE ───
    if (existing) {
      const secondsSinceLast = (now.getTime() - existing.lastRequestedAt.getTime()) / 1000;

      // 45-second cooldown to prevent button spamming
      if (secondsSinceLast < 45) {
        const waitSec = Math.ceil(45 - secondsSinceLast);
        return reply.status(429).send({
          code: 'RATE_LIMIT_COOLDOWN',
          title: 'Please Wait',
          status: 429,
          detail: `Please wait ${waitSec} seconds before requesting another verification code.`,
        });
      }

      // Max 4 requests per 15 minutes per email address
      if (existing.requestCount >= 4 && existing.expiresAt > now) {
        return reply.status(429).send({
          code: 'RATE_LIMIT_EXCEEDED',
          title: 'Too Many Requests',
          status: 429,
          detail: 'You have requested too many codes. Please wait 15 minutes before trying again.',
        });
      }
    }

    // Generate random 6-digit cryptographic OTP code
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const otpHash = hashString(otpCode);
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes

    activeChallenges.set(normalizedEmail, {
      otpHash,
      expiresAt,
      attempts: 0,
      lastRequestedAt: now,
      requestCount: (existing?.requestCount ?? 0) + 1,
    });

    // Send email via Resend if API key is present
    if (resend) {
      try {
        await resend.emails.send({
          from: env.EMAIL_FROM,
          to: normalizedEmail,
          subject: 'Your Kolimi ID verification code',
          text: `Your Kolimi ID verification code is:\n\n${otpCode}\n\nValid for 5 minutes.\n\nThis is an automated message from Kolimi Studio. Please do not reply directly to this email.`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 24px 12px; background-color: #F4F4F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #18181B;">
              <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 440px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #E4E4E7; border-radius: 12px; padding: 32px 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <tr>
                  <td>
                    <!-- Header -->
                    <div style="font-size: 20px; font-weight: 700; color: #09090B; letter-spacing: -0.3px; margin-bottom: 4px;">Kolimi ID</div>
                    <div style="font-size: 14px; color: #71717A; margin-bottom: 24px;">Use this code to sign in to <strong>Laya (లయ)</strong></div>

                    <!-- Copyable OTP Box -->
                    <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px;">
                      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748B; margin-bottom: 8px;">Verification Code</div>
                      <div style="font-family: 'SF Mono', Consolas, Monaco, monospace; font-size: 34px; font-weight: 700; color: #0284C7; letter-spacing: 6px; user-select: all; -webkit-user-select: all; cursor: pointer; padding: 4px 8px; display: inline-block;">
                        ${otpCode}
                      </div>
                      <div style="font-size: 11px; color: #94A3B8; margin-top: 8px;">Tap or double-click to copy code</div>
                    </div>

                    <!-- Expiry & Disclaimer -->
                    <p style="font-size: 13px; color: #71717A; line-height: 1.5; margin: 0 0 24px 0;">
                      This code is valid for 5 minutes. If you did not request this, no further action is required.
                    </p>

                    <!-- Automated Footer -->
                    <div style="border-top: 1px solid #F1F5F9; padding-top: 16px;">
                      <p style="font-size: 11px; color: #94A3B8; line-height: 1.5; margin: 0;">
                        This is an automated message from Kolimi Studio (kolimi.dev). Please do not reply directly to this email.
                      </p>
                    </div>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `,
        });
        request.log.info({ email: normalizedEmail }, 'Verification email sent via Resend');
      } catch (err) {
        request.log.error(err, 'Failed to send email via Resend');
        return reply.status(502).send({
          code: 'EMAIL_DELIVERY_FAILED',
          title: 'Email Delivery Failed',
          status: 502,
          detail: 'Unable to deliver verification code. Please check your domain configuration.',
        });
      }
    } else {
      // Dev / testing fallback: log to console
      request.log.warn(`[DEV AUTH] No RESEND_API_KEY configured. OTP for ${normalizedEmail}: ${otpCode}`);
      console.log(`\n🔑 [Laya DEV OTP] Email: ${normalizedEmail} | OTP Code: ${otpCode}\n`);
    }

    return reply.status(200).send({
      success: true,
      expiresInSeconds: 300,
      message: `Verification code sent to ${normalizedEmail}`,
    });
  });

  // 2. Verify Email OTP & Issue JWT
  fastify.post('/api/v1/auth/email/verify-otp', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = verifyOtpSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        title: 'Invalid Payload',
        status: 400,
        detail: parseResult.error.issues[0]?.message ?? 'Invalid payload',
      });
    }

    const { email, otpCode } = parseResult.data;
    const normalizedEmail = email.trim().toLowerCase();

    const challenge = activeChallenges.get(normalizedEmail);

    if (!challenge || challenge.expiresAt < new Date()) {
      activeChallenges.delete(normalizedEmail);
      return reply.status(400).send({
        code: 'AUTH_OTP_EXPIRED',
        title: 'Verification Code Expired',
        status: 400,
        detail: 'The verification code has expired. Please request a new one.',
      });
    }

    if (challenge.attempts >= 5) {
      activeChallenges.delete(normalizedEmail);
      return reply.status(400).send({
        code: 'AUTH_OTP_MAX_ATTEMPTS',
        title: 'Max Attempts Exceeded',
        status: 400,
        detail: 'Too many incorrect attempts. Please request a new code.',
      });
    }

    const submittedHash = hashString(otpCode);
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(challenge.otpHash),
      Buffer.from(submittedHash)
    );

    if (!isMatch) {
      challenge.attempts += 1;
      return reply.status(400).send({
        code: 'AUTH_OTP_INVALID',
        title: 'Invalid Verification Code',
        status: 400,
        detail: 'The verification code you entered is incorrect.',
      });
    }

    // Success: delete challenge
    activeChallenges.delete(normalizedEmail);

    // Generate deterministic user ID
    const emailHash = crypto.createHash('sha256').update(normalizedEmail).digest('hex').substring(0, 16);
    const userId = `usr_${emailHash}`;

    // Sync Master Identity to auth.users (ADR-0004 & Multi-App Observability)
    const sql = getSql();
    if (sql) {
      try {
        await sql`
          INSERT INTO auth.users (id, email, email_verified_at, last_login_at, created_by)
          VALUES (${userId}, ${normalizedEmail}, NOW(), NOW(), ${userId})
          ON CONFLICT (id) DO UPDATE SET 
            last_login_at = NOW(),
            email_verified_at = COALESCE(auth.users.email_verified_at, NOW())
        `;
        await sql`
          INSERT INTO auth.user_identities (id, user_id, identity_provider, provider_uid, last_sign_in_at, created_by)
          VALUES (${'idn_' + emailHash}, ${userId}, 'email', ${normalizedEmail}, NOW(), ${userId})
          ON CONFLICT (id) DO UPDATE SET last_sign_in_at = NOW()
        `;
      } catch (err) {
        request.log.warn(err, 'Observability note: could not sync user to auth.users schema');
      }
    }

    // Sign 30-day JWT Access Token
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const accessToken = await new jose.SignJWT({
      sub: userId,
      email: normalizedEmail,
      roles: ['user'],
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(env.JWT_ISSUER)
      .setAudience(env.JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(secret);

    return reply.status(200).send({
      user: {
        id: userId,
        email: normalizedEmail,
      },
      session: {
        accessToken,
        tokenType: 'Bearer',
        expiresIn: 30 * 24 * 60 * 60, // 30 days
      },
    });
  });
}
