import type { FastifyRequest, FastifyReply } from 'fastify';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Logger } from '../../../core/logger.js';
import type { McpProxyHandler, ModuleHealth } from '../../../core/types.js';
import { SubprocessManager, type SubprocessConfig } from '../../../servers/mcp-proxy/subprocess.js';

export interface TelegramCredentials {
  apiId?: string;
  apiHash?: string;
  phoneNumber?: string;
}

export interface TelegramMcpConfig {
  endpoint: string;
  binaryPath: string;
  internalPort: number;
  credentials: TelegramCredentials;
  storeDir?: string;
  session?: string; // Base64-encoded session.json content
}

interface TgcliConfig {
  apiId: string;
  apiHash: string;
  phoneNumber: string;
  mcp: {
    enabled: boolean;
    host: string;
    port: number;
  };
}

export class TelegramMcpProxyModule {
  private subprocess: SubprocessManager;
  private endpoint: string = '';
  private internalPort: number;
  private storeDir: string;
  private credentials: TelegramCredentials;
  private session?: string;

  constructor(
    config: TelegramMcpConfig,
    private logger: Logger
  ) {
    this.internalPort = config.internalPort;
    this.credentials = config.credentials;
    this.session = config.session;
    this.storeDir = config.storeDir || join(tmpdir(), 'poke-tools-tgcli');

    const subprocessConfig: SubprocessConfig = {
      name: 'telegram-mcp-server',
      binaryPath: config.binaryPath,
      args: ['server', '--port', String(config.internalPort)],
      env: {
        TGCLI_STORE: this.storeDir,
      },
    };

    this.subprocess = new SubprocessManager(subprocessConfig, logger);
  }

  getMcpProxyHandler(): McpProxyHandler {
    return {
      name: 'telegram-mcp',
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
      this.logger.error({ err: error, targetUrl }, 'Failed to proxy request to telegram-mcp-server');
      return reply.status(502).send({ error: 'Bad gateway' });
    }
  }

  private async writeConfigFile(): Promise<void> {
    const { apiId, apiHash, phoneNumber } = this.credentials;

    if (!apiId || !apiHash || !phoneNumber) {
      this.logger.warn(
        'Telegram credentials not fully configured. Set TELEGRAM_API_ID, TELEGRAM_API_HASH, and TELEGRAM_PHONE_NUMBER.'
      );
      return;
    }

    await mkdir(this.storeDir, { recursive: true });

    const configPath = join(this.storeDir, 'config.json');
    const tgcliConfig: TgcliConfig = {
      apiId,
      apiHash,
      phoneNumber,
      mcp: {
        enabled: true,
        host: '127.0.0.1',
        port: this.internalPort,
      },
    };

    await writeFile(configPath, JSON.stringify(tgcliConfig, null, 2), 'utf-8');
    this.logger.info({ configPath, storeDir: this.storeDir }, 'Wrote tgcli config file');
  }

  private async writeSessionFile(): Promise<void> {
    if (!this.session) {
      return;
    }

    await mkdir(this.storeDir, { recursive: true });

    const sessionPath = join(this.storeDir, 'session.json');

    try {
      const sessionContent = Buffer.from(this.session, 'base64').toString('utf-8');
      // Validate it's valid JSON
      JSON.parse(sessionContent);
      await writeFile(sessionPath, sessionContent, 'utf-8');
      this.logger.info({ sessionPath }, 'Wrote tgcli session file from TELEGRAM_SESSION env var');
    } catch (error) {
      this.logger.error(
        { err: error },
        'Failed to decode TELEGRAM_SESSION - must be valid base64-encoded JSON'
      );
    }
  }

  async start(): Promise<void> {
    await this.writeConfigFile();
    await this.writeSessionFile();
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
