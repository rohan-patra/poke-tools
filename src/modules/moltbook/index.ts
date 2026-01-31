import type { Logger } from '../../core/logger.js';
import type { Module, ModuleHealth, ModuleContext, PollerHandle } from '../../core/types.js';
import type { AppConfig, MoltbookWorkspaceConfig } from '../../config/index.js';
import type { PokeClient } from '../../integrations/poke/index.js';
import { MoltbookClient } from '../../integrations/moltbook/index.js';
import { MoltbookMcpHandler } from './mcp/index.js';
import { MoltbookPollingHandler } from './polling/index.js';

interface WorkspaceInstance {
  config: MoltbookWorkspaceConfig;
  client: MoltbookClient;
  mcpHandler: MoltbookMcpHandler;
  pollingHandler?: MoltbookPollingHandler;
  pollerHandle?: PollerHandle;
  endpoint: string;
}

export class MoltbookModule implements Module {
  name = 'moltbook';

  private workspaces: WorkspaceInstance[] = [];

  constructor(
    private config: AppConfig,
    private context: ModuleContext,
    private pokeClient: PokeClient,
    private logger: Logger
  ) {}

  async initialize(): Promise<void> {
    for (const workspaceConfig of this.config.moltbook.workspaces) {
      const workspaceLogger = this.logger.child({
        module: 'moltbook',
        workspace: workspaceConfig.name,
      });

      // Create Moltbook API client
      const client = new MoltbookClient(workspaceConfig.apiKey, workspaceLogger);

      // Create MCP handler
      const mcpHandler = new MoltbookMcpHandler(
        workspaceConfig,
        client,
        workspaceLogger.child({ component: 'mcp' })
      );

      // Register MCP proxy endpoint
      const endpoint = this.context.registerMcpProxy(
        mcpHandler.getMcpProxyHandler(),
        workspaceConfig.endpoint
      );
      mcpHandler.setEndpoint(endpoint);

      // Create polling handler if enabled
      let pollingHandler: MoltbookPollingHandler | undefined;
      let pollerHandle: PollerHandle | undefined;

      if (workspaceConfig.pollingEnabled) {
        pollingHandler = new MoltbookPollingHandler(
          workspaceConfig,
          client,
          this.pokeClient,
          workspaceLogger.child({ component: 'polling' })
        );

        pollerHandle = this.context.registerPoller(pollingHandler.getPollerConfig());

        workspaceLogger.info(
          { interval: workspaceConfig.pollingInterval, sort: workspaceConfig.feedSort },
          'Moltbook polling configured'
        );
      }

      this.workspaces.push({
        config: workspaceConfig,
        client,
        mcpHandler,
        pollingHandler,
        pollerHandle,
        endpoint,
      });

      this.logger.info(
        {
          workspace: workspaceConfig.name,
          endpoint: `/mcp/${endpoint}`,
          polling: workspaceConfig.pollingEnabled,
        },
        'Moltbook workspace initialized'
      );
    }

    if (this.workspaces.length > 0) {
      this.logger.info({ count: this.workspaces.length }, 'Moltbook module initialized with workspaces');
    }
  }

  async start(): Promise<void> {
    // No subprocesses to start - MCP is handled directly
    // Pollers are started by the PollingManager
    this.logger.info('Moltbook module started');
  }

  async stop(): Promise<void> {
    // Pollers are stopped by the PollingManager
    this.logger.info('Moltbook module stopped');
  }

  async healthCheck(): Promise<ModuleHealth> {
    const details: Record<string, unknown> = {};
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    const workspaceHealths: Record<string, unknown> = {};

    for (const ws of this.workspaces) {
      const health = await ws.mcpHandler.healthCheck();
      workspaceHealths[ws.config.name] = {
        ...health,
        pollingEnabled: ws.config.pollingEnabled,
        pollingStatus: ws.pollerHandle?.status(),
      };

      if (health.status === 'unhealthy') {
        overallStatus = 'degraded';
      }
    }

    details['workspaces'] = workspaceHealths;

    return {
      status: overallStatus,
      details,
    };
  }

  getEndpoints(): { workspace: string; endpoint: string }[] {
    return this.workspaces.map((ws) => ({
      workspace: ws.config.name,
      endpoint: `/mcp/${ws.endpoint}`,
    }));
  }
}
