import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Logger } from '../core/logger.js';
import type { McpProxyHandler } from '../core/types.js';

interface RegisteredMcpProxy {
  endpoint: string;
  handler: McpProxyHandler;
}

export class McpRouter {
  private proxies: Map<string, RegisteredMcpProxy> = new Map();

  constructor(private logger: Logger) {}

  register(handler: McpProxyHandler, endpoint: string): string {
    this.proxies.set(endpoint, { endpoint, handler });
    this.logger.info({ name: handler.name, endpoint: `/mcp/${endpoint}` }, 'MCP proxy registered');

    return endpoint;
  }

  attachTo(fastify: FastifyInstance): void {
    // Handle all HTTP methods to /mcp/:endpoint and /mcp/:endpoint/*
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'] as const;

    for (const method of methods) {
      // Route without wildcard
      fastify.route<{ Params: { endpoint: string } }>({
        method,
        url: '/mcp/:endpoint',
        handler: async (request: FastifyRequest<{ Params: { endpoint: string } }>, reply: FastifyReply) => {
          await this.handleRequest(request, reply);
        },
      });

      // Route with wildcard for sub-paths
      fastify.route<{ Params: { endpoint: string; '*': string } }>({
        method,
        url: '/mcp/:endpoint/*',
        handler: async (
          request: FastifyRequest<{ Params: { endpoint: string; '*': string } }>,
          reply: FastifyReply
        ) => {
          await this.handleRequest(request, reply);
        },
      });
    }

    this.logger.info('MCP router attached');
  }

  private async handleRequest(
    request: FastifyRequest<{ Params: { endpoint: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { endpoint } = request.params;
    const proxy = this.proxies.get(endpoint);

    if (!proxy) {
      reply.status(404).send({ error: 'Not found' });
      return;
    }

    try {
      await proxy.handler.proxy(request, reply);
    } catch (error) {
      this.logger.error({ name: proxy.handler.name, err: error }, 'MCP proxy handler error');
      if (!reply.sent) {
        reply.status(500).send({ error: 'Internal server error' });
      }
    }
  }

  getEndpoints(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [endpoint, proxy] of this.proxies) {
      result[proxy.handler.name] = `/mcp/${endpoint}`;
    }
    return result;
  }
}
