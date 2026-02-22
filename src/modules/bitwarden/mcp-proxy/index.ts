import type { Server } from 'node:http';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Logger } from '../../../core/logger.js';
import type { McpProxyHandler, ModuleHealth } from '../../../core/types.js';
import { BitwardenCli } from './cli.js';
import { createBitwardenMcpServer } from './server.js';
import { BitwardenSessionManager } from './session.js';

export interface BitwardenMcpConfig {
  cliPath: string;
  internalPort: number;
  clientId: string;
  clientSecret: string;
  clientPasswd: string;
  organizationId: string;
  collectionId: string;
}

export class BitwardenMcpProxyModule {
  private cli: BitwardenCli;
  private sessionManager: BitwardenSessionManager;
  private httpServer: Server | null = null;
  private endpoint = '';
  private internalPort: number;

  constructor(
    config: BitwardenMcpConfig,
    private logger: Logger
  ) {
    this.internalPort = config.internalPort;
    this.cli = new BitwardenCli(config.cliPath, config.organizationId, config.collectionId, logger);
    this.sessionManager = new BitwardenSessionManager(
      this.cli,
      config.clientId,
      config.clientSecret,
      config.clientPasswd,
      logger
    );
  }

  getMcpProxyHandler(): McpProxyHandler {
    return {
      name: 'bitwarden-mcp',
      proxy: this.handleProxy.bind(this),
    };
  }

  setEndpoint(endpoint: string): void {
    this.endpoint = endpoint;
  }

  private async handleProxy(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const targetUrl = `http://127.0.0.1:${this.internalPort}/mcp`;

    try {
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string' && key !== 'host' && key !== 'connection') {
          headers[key] = value;
        }
      }

      const rawBody = (req as typeof req & { rawBody?: string }).rawBody;
      const body =
        req.method !== 'GET' && req.method !== 'HEAD' ? rawBody || JSON.stringify(req.body) : undefined;

      const response = await fetch(targetUrl, {
        method: req.method,
        headers,
        body,
      });

      for (const [key, value] of response.headers.entries()) {
        if (key !== 'transfer-encoding' && key !== 'connection') {
          reply.header(key, value);
        }
      }

      reply.status(response.status);

      const responseBody = await response.text();
      return reply.send(responseBody);
    } catch (error) {
      this.logger.error({ err: error, targetUrl }, 'Failed to proxy request to bitwarden-mcp-server');
      return reply.status(502).send({ error: 'Bad gateway' });
    }
  }

  async start(): Promise<void> {
    await this.sessionManager.initialize();

    const result = await createBitwardenMcpServer(
      this.cli,
      this.sessionManager,
      this.internalPort,
      this.logger
    );
    this.httpServer = result.httpServer;
  }

  async stop(): Promise<void> {
    if (this.httpServer) {
      const server = this.httpServer;
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
      this.httpServer = null;
    }

    await this.sessionManager.shutdown();
  }

  async healthCheck(): Promise<ModuleHealth> {
    return {
      status: this.sessionManager.isUnlocked && this.httpServer ? 'healthy' : 'unhealthy',
      endpoint: `/mcp/${this.endpoint}`,
      details: {
        vaultUnlocked: this.sessionManager.isUnlocked,
        httpServerRunning: !!this.httpServer,
      },
    };
  }
}
