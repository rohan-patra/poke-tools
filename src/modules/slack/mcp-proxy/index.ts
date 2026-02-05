import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Logger } from '../../../core/logger.js';
import type { McpProxyHandler, ModuleHealth } from '../../../core/types.js';
import { type SubprocessConfig, SubprocessManager } from '../../../servers/mcp-proxy/subprocess.js';

export interface SlackMcpConfig {
  name: string;
  binaryPath: string;
  authMode: 'browser' | 'oauth' | 'bot';
  internalPort: number;
  tokens: {
    xoxc?: string;
    xoxd?: string;
    xoxp?: string;
    xoxb?: string;
  };
  addMessageTool?: string;
}

export class SlackMcpProxyModule {
  private subprocess: SubprocessManager;
  private endpoint: string = '';
  private internalPort: number;

  constructor(
    private config: SlackMcpConfig,
    private logger: Logger
  ) {
    this.internalPort = config.internalPort;

    const subprocessConfig: SubprocessConfig = {
      name: `slack-mcp-server-${config.name}`,
      binaryPath: config.binaryPath,
      args: ['--transport', 'http'],
      env: this.buildEnv(),
    };

    this.subprocess = new SubprocessManager(subprocessConfig, logger);
  }

  private buildEnv(): Record<string, string> {
    const env: Record<string, string> = {
      SLACK_MCP_HOST: '127.0.0.1',
      SLACK_MCP_PORT: String(this.internalPort),
    };

    switch (this.config.authMode) {
      case 'browser':
        // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
        if (this.config.tokens.xoxc) env['SLACK_MCP_XOXC_TOKEN'] = this.config.tokens.xoxc;
        // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
        if (this.config.tokens.xoxd) env['SLACK_MCP_XOXD_TOKEN'] = this.config.tokens.xoxd;
        break;
      case 'oauth':
        // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
        if (this.config.tokens.xoxp) env['SLACK_MCP_XOXP_TOKEN'] = this.config.tokens.xoxp;
        break;
      case 'bot':
        // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
        if (this.config.tokens.xoxb) env['SLACK_MCP_XOXB_TOKEN'] = this.config.tokens.xoxb;
        break;
    }

    if (this.config.addMessageTool) {
      // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
      env['SLACK_MCP_ADD_MESSAGE_TOOL'] = this.config.addMessageTool;
    }

    return env;
  }

  getMcpProxyHandler(): McpProxyHandler {
    return {
      name: `slack-mcp-${this.config.name}`,
      proxy: this.handleProxy.bind(this),
    };
  }

  setEndpoint(endpoint: string): void {
    this.endpoint = endpoint;
  }

  private async handleProxy(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    // With HTTP transport, slack-mcp-server exposes /mcp endpoint
    // We proxy all requests to that endpoint
    const targetUrl = `http://127.0.0.1:${this.internalPort}/mcp`;

    try {
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string' && key !== 'host' && key !== 'connection') {
          headers[key] = value;
        }
      }

      // Get raw body for proper forwarding
      const rawBody = (req as typeof req & { rawBody?: string }).rawBody;
      const body =
        req.method !== 'GET' && req.method !== 'HEAD' ? rawBody || JSON.stringify(req.body) : undefined;

      const response = await fetch(targetUrl, {
        method: req.method,
        headers,
        body,
      });

      // Copy response headers
      for (const [key, value] of response.headers.entries()) {
        if (key !== 'transfer-encoding' && key !== 'connection') {
          reply.header(key, value);
        }
      }

      reply.status(response.status);

      // Return response body
      const responseBody = await response.text();
      return reply.send(responseBody);
    } catch (error) {
      this.logger.error({ err: error, targetUrl }, 'Failed to proxy request to slack-mcp-server');
      return reply.status(502).send({ error: 'Bad gateway' });
    }
  }

  async start(): Promise<void> {
    await this.subprocess.start();
  }

  async stop(): Promise<void> {
    await this.subprocess.stop();
  }

  async healthCheck(): Promise<ModuleHealth> {
    const status = this.subprocess.status;

    return {
      status: status.running ? 'healthy' : 'unhealthy',
      endpoint: `/mcp/${this.endpoint}`,
      details: {
        pid: status.pid,
        uptime: status.uptime,
        restartCount: status.restartCount,
        lastError: status.lastError,
      },
    };
  }
}
