import type { Logger } from '../../core/logger.js';
import type { Module, ModuleHealth, ModuleContext } from '../../core/types.js';
import type { AppConfig } from '../../config/index.js';
import type { PokeClient } from '../../integrations/poke/index.js';
import { TelegramMcpProxyModule } from './mcp-proxy/index.js';
import { TelegramPollingModule } from './polling/index.js';

export class TelegramModule implements Module {
  name = 'telegram';

  private mcpModule: TelegramMcpProxyModule | null = null;
  private pollingModule: TelegramPollingModule | null = null;

  constructor(
    private config: AppConfig,
    private context: ModuleContext,
    private pokeClient: PokeClient,
    private logger: Logger
  ) {}

  async initialize(): Promise<void> {
    const telegramConfig = this.config.telegram;

    this.mcpModule = new TelegramMcpProxyModule(
      {
        endpoint: telegramConfig.mcp.endpoint,
        binaryPath: telegramConfig.mcp.binaryPath,
        internalPort: telegramConfig.mcp.internalPort,
        credentials: telegramConfig.credentials,
        storeDir: telegramConfig.storeDir,
        session: telegramConfig.session,
      },
      this.logger.child({ module: 'telegram-mcp' })
    );

    const endpoint = this.context.registerMcpProxy(
      this.mcpModule.getMcpProxyHandler(),
      telegramConfig.mcp.endpoint
    );
    this.mcpModule.setEndpoint(endpoint);

    this.logger.info({ endpoint: `/mcp/${endpoint}` }, 'Telegram MCP Proxy initialized');

    this.pollingModule = new TelegramPollingModule(
      {
        internalPort: telegramConfig.mcp.internalPort,
        interval: telegramConfig.polling.interval,
      },
      this.pokeClient,
      this.logger.child({ module: 'telegram-polling' })
    );

    const pollerHandle = this.context.registerPoller(this.pollingModule.getPollerConfig());
    this.pollingModule.setPollerHandle(pollerHandle);

    this.logger.info({ interval: telegramConfig.polling.interval }, 'Telegram Polling initialized');
  }

  async start(): Promise<void> {
    if (this.mcpModule) {
      await this.mcpModule.start();
      this.logger.info('Telegram MCP subprocess started');
    }
  }

  async stop(): Promise<void> {
    if (this.mcpModule) {
      await this.mcpModule.stop();
      this.logger.info('Telegram MCP subprocess stopped');
    }
  }

  async healthCheck(): Promise<ModuleHealth> {
    const details: Record<string, unknown> = {};
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (this.mcpModule) {
      const mcpHealth = await this.mcpModule.healthCheck();
      details['mcp'] = mcpHealth;
      if (mcpHealth.status === 'unhealthy') status = 'degraded';
    }

    if (this.pollingModule) {
      const pollingHealth = this.pollingModule.healthCheck();
      details['polling'] = pollingHealth;
    }

    return { status, details };
  }

  getEndpoints(): { mcp: string } {
    return {
      mcp: `/mcp/${this.config.telegram.mcp.endpoint}`,
    };
  }
}
