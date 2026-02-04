import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Logger } from '../../../core/logger.js';
import type { WebhookHandler, ModuleHealth } from '../../../core/types.js';
import type { PokeClient } from '../../../integrations/poke/index.js';
import { verifySlackSignature } from './verify.js';
import { handleChallenge } from './challenge.js';
import { formatSlackMessageForPoke, isRegularMessage, type SlackEventPayload } from './formatter.js';

export interface SlackEventsConfig {
  workspace: string;
  signingSecret: string;
  botToken: string;
  channelBlocklist: string[];
}

export class SlackEventsModule {
  private endpoint: string = '';

  constructor(
    private config: SlackEventsConfig,
    private pokeClient: PokeClient,
    private logger: Logger
  ) {}

  getWebhookHandler(): WebhookHandler {
    return {
      name: 'slack-events',
      handler: this.handleWebhook.bind(this),
    };
  }

  setEndpoint(endpoint: string): void {
    this.endpoint = endpoint;
  }

  private async handleWebhook(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    // Get raw body for signature verification
    const rawBody = (req as FastifyRequest & { rawBody?: string }).rawBody;

    if (!rawBody) {
      this.logger.error('Raw body not available for signature verification');
      return reply.status(500).send({ error: 'Internal server error' });
    }

    // Verify signature
    try {
      verifySlackSignature(req, this.config.signingSecret, rawBody);
    } catch (error) {
      this.logger.warn({ err: error }, 'Slack signature verification failed');
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const body = req.body as Record<string, unknown>;

    // Handle URL verification challenge
    const challenge = handleChallenge(body);
    if (challenge) {
      this.logger.info('Responding to Slack URL verification challenge');
      return reply.send({ challenge });
    }

    // Must respond within 3 seconds - acknowledge immediately
    reply.status(200).send();

    // Process event asynchronously
    setImmediate(() => {
      this.processEvent(body as unknown as SlackEventPayload).catch((err) => {
        this.logger.error({ err }, 'Failed to process Slack event');
      });
    });
  }

  private async processEvent(payload: SlackEventPayload): Promise<void> {
    if (payload.type !== 'event_callback') {
      this.logger.debug({ type: payload.type }, 'Ignoring non-event_callback payload');
      return;
    }

    const event = payload.event;

    if (!isRegularMessage(event)) {
      this.logger.debug({ type: event.type, subtype: event.subtype }, 'Ignoring non-regular message');
      return;
    }

    // Check if channel is in blocklist
    if (this.config.channelBlocklist.includes(event.channel)) {
      this.logger.debug(
        { workspace: this.config.workspace, channel: event.channel },
        'Ignoring message from blocklisted channel'
      );
      return;
    }

    const message = formatSlackMessageForPoke(event, this.config.workspace);
    this.logger.info(
      { workspace: this.config.workspace, channel: event.channel, user: event.user },
      'Forwarding Slack message to Poke'
    );

    await this.pokeClient.sendInboundMessage(message);
  }

  async healthCheck(): Promise<ModuleHealth> {
    return {
      status: 'healthy',
      endpoint: `/webhooks/${this.endpoint}`,
    };
  }
}
