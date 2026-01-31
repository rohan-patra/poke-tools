import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Logger } from '../core/logger.js';
import type { WebhookHandler } from '../core/types.js';

interface RegisteredWebhook {
  endpoint: string;
  handler: WebhookHandler;
}

export class WebhookRouter {
  private webhooks: Map<string, RegisteredWebhook> = new Map();

  constructor(private logger: Logger) {}

  register(handler: WebhookHandler, endpoint: string): string {
    this.webhooks.set(endpoint, { endpoint, handler });
    this.logger.info({ name: handler.name, endpoint: `/webhooks/${endpoint}` }, 'Webhook registered');

    return endpoint;
  }

  attachTo(fastify: FastifyInstance): void {
    // Handle POST requests to /webhooks/:endpoint
    fastify.post<{ Params: { endpoint: string } }>(
      '/webhooks/:endpoint',
      {
        config: {
          rawBody: true,
        },
      },
      async (request: FastifyRequest<{ Params: { endpoint: string } }>, reply: FastifyReply) => {
        const { endpoint } = request.params;
        const webhook = this.webhooks.get(endpoint);

        if (!webhook) {
          return reply.status(404).send({ error: 'Not found' });
        }

        try {
          await webhook.handler.handler(request, reply);
        } catch (error) {
          this.logger.error({ name: webhook.handler.name, err: error }, 'Webhook handler error');
          if (!reply.sent) {
            return reply.status(500).send({ error: 'Internal server error' });
          }
        }
      }
    );

    this.logger.info('Webhook router attached');
  }

  getEndpoints(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [endpoint, webhook] of this.webhooks) {
      result[webhook.handler.name] = `/webhooks/${endpoint}`;
    }
    return result;
  }
}
