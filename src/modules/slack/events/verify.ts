import crypto from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { WebhookVerificationError } from '../../../core/errors.js';

const SLACK_SIGNATURE_HEADER = 'x-slack-signature';
const SLACK_TIMESTAMP_HEADER = 'x-slack-request-timestamp';
const SIGNATURE_VERSION = 'v0';
const MAX_TIMESTAMP_DIFF = 60 * 5; // 5 minutes

export function verifySlackSignature(req: FastifyRequest, signingSecret: string, rawBody: string): void {
  const signature = req.headers[SLACK_SIGNATURE_HEADER] as string | undefined;
  const timestamp = req.headers[SLACK_TIMESTAMP_HEADER] as string | undefined;

  if (!signature || !timestamp) {
    throw new WebhookVerificationError('Missing Slack signature headers', {
      hasSignature: !!signature,
      hasTimestamp: !!timestamp,
    });
  }

  // Check timestamp to prevent replay attacks
  const timestampNum = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);

  if (Math.abs(now - timestampNum) > MAX_TIMESTAMP_DIFF) {
    throw new WebhookVerificationError('Request timestamp too old', {
      timestamp: timestampNum,
      serverTime: now,
      diff: Math.abs(now - timestampNum),
    });
  }

  // Compute expected signature
  const baseString = `${SIGNATURE_VERSION}:${timestamp}:${rawBody}`;
  const hmac = crypto.createHmac('sha256', signingSecret);
  hmac.update(baseString);
  const expectedSignature = `${SIGNATURE_VERSION}=${hmac.digest('hex')}`;

  // Timing-safe comparison
  try {
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      throw new WebhookVerificationError('Invalid Slack signature');
    }
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      throw error;
    }
    throw new WebhookVerificationError('Invalid Slack signature');
  }
}
