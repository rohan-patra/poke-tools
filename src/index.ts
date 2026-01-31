import Fastify from 'fastify';
import cors from '@fastify/cors';
import { loadConfig } from './config/index.js';
import { createLogger } from './core/logger.js';
import type { Module, ModuleContext } from './core/types.js';
import { WebhookRouter } from './routers/webhooks.js';
import { McpRouter } from './routers/mcp.js';
import { PollingManager } from './servers/polling/index.js';
import { PokeClient } from './integrations/poke/index.js';
import { SlackModule } from './modules/slack/index.js';

async function main() {
  const config = loadConfig();
  const logger = createLogger(config.env);

  logger.info('Poke-tools server starting...');

  // Create Fastify instance
  const fastify = Fastify({
    logger: false, // We use our own logger
    trustProxy: true,
  });

  // Register CORS
  await fastify.register(cors, {
    origin: true,
  });

  // Add raw body parsing for webhook signature verification
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try {
      const json = JSON.parse(body as string);
      // Attach raw body for signature verification
      (req as typeof req & { rawBody: string }).rawBody = body as string;
      done(null, json);
    } catch (err) {
      done(err as Error);
    }
  });

  // Initialize routers
  const webhookRouter = new WebhookRouter(logger);
  const mcpRouter = new McpRouter(logger);
  const pollingManager = new PollingManager(logger);

  // Initialize Poke client
  const pokeClient = new PokeClient(config.poke, logger.child({ service: 'poke' }));

  // Create module context
  const moduleContext: ModuleContext = {
    config,
    logger,
    registerWebhook: (handler, endpoint) => webhookRouter.register(handler, endpoint),
    registerMcpProxy: (handler, endpoint) => mcpRouter.register(handler, endpoint),
    registerPoller: (pollerConfig) => pollingManager.register(pollerConfig),
  };

  // Initialize modules
  const modules: Module[] = [];

  // Slack module
  if (config.slack.events.enabled || config.slack.mcp.enabled) {
    const slackModule = new SlackModule(config, moduleContext, pokeClient, logger.child({ module: 'slack' }));
    await slackModule.initialize();
    modules.push(slackModule);

    // Log endpoints
    const endpoints = slackModule.getEndpoints();
    if (endpoints.events.length > 0) {
      logger.info({ endpoints: endpoints.events }, '[slack-events] Webhook endpoints registered');
    }
    if (endpoints.mcp.length > 0) {
      logger.info({ endpoints: endpoints.mcp }, '[slack-mcp] MCP proxy endpoints registered');
    }
  }

  // Attach routers to Fastify
  webhookRouter.attachTo(fastify);
  mcpRouter.attachTo(fastify);

  // Health check endpoint
  fastify.get('/health', async () => {
    const moduleHealth = await Promise.all(
      modules.map(async (m) => ({
        name: m.name,
        health: await m.healthCheck(),
      }))
    );

    const webhookEndpoints = webhookRouter.getEndpoints();
    const mcpEndpoints = mcpRouter.getEndpoints();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      modules: Object.fromEntries(moduleHealth.map((m) => [m.name, m.health])),
      endpoints: {
        webhooks: webhookEndpoints,
        mcp: mcpEndpoints,
      },
    };
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down...');

    // Stop polling
    pollingManager.stopAll();

    // Stop modules
    await Promise.all(modules.map((m) => m.stop()));

    // Close Fastify
    await fastify.close();

    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Start modules
  for (const module of modules) {
    await module.start();
  }

  // Start polling
  pollingManager.startAll();

  // Start server
  await fastify.listen({
    port: config.port,
    host: '0.0.0.0',
  });

  const baseUrl = `http://localhost:${config.port}`;
  const webhookEndpoints = webhookRouter.getEndpoints();
  const mcpEndpoints = mcpRouter.getEndpoints();

  logger.info({ url: baseUrl }, 'Server listening');
  logger.info('');
  logger.info('='.repeat(60));
  logger.info('Endpoints:');
  logger.info(`  Health:  ${baseUrl}/health`);
  for (const [name, path] of Object.entries(webhookEndpoints)) {
    logger.info(`  ${name}: ${baseUrl}${path}`);
  }
  for (const [name, path] of Object.entries(mcpEndpoints)) {
    logger.info(`  ${name}: ${baseUrl}${path}`);
  }
  logger.info('='.repeat(60));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
