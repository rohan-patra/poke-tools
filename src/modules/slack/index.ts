import type { Logger } from '../../core/logger.js';
import type { Module, ModuleHealth, ModuleContext } from '../../core/types.js';
import type { AppConfig, SlackWorkspaceConfig, SlackMcpWorkspaceConfig } from '../../config/index.js';
import type { PokeClient } from '../../integrations/poke/index.js';
import { SlackEventsModule } from './events/index.js';
import { SlackMcpProxyModule } from './mcp-proxy/index.js';

interface EventsWorkspaceInstance {
  config: SlackWorkspaceConfig;
  module: SlackEventsModule;
  endpoint: string;
}

interface McpWorkspaceInstance {
  config: SlackMcpWorkspaceConfig;
  module: SlackMcpProxyModule;
  endpoint: string;
}

export class SlackModule implements Module {
  name = 'slack';

  private eventsWorkspaces: EventsWorkspaceInstance[] = [];
  private mcpWorkspaces: McpWorkspaceInstance[] = [];

  constructor(
    private config: AppConfig,
    private context: ModuleContext,
    private pokeClient: PokeClient,
    private logger: Logger
  ) {}

  async initialize(): Promise<void> {
    // Initialize Slack Events modules for each workspace
    if (this.config.slack.events.enabled) {
      for (const workspaceConfig of this.config.slack.events.workspaces) {
        const eventsModule = new SlackEventsModule(
          {
            workspace: workspaceConfig.name,
            signingSecret: workspaceConfig.signingSecret,
            botToken: workspaceConfig.botToken,
          },
          this.pokeClient,
          this.logger.child({ module: 'slack-events', workspace: workspaceConfig.name })
        );

        const endpoint = this.context.registerWebhook(
          eventsModule.getWebhookHandler(),
          workspaceConfig.endpoint
        );
        eventsModule.setEndpoint(endpoint);

        this.eventsWorkspaces.push({
          config: workspaceConfig,
          module: eventsModule,
          endpoint,
        });

        this.logger.info(
          { workspace: workspaceConfig.name, endpoint: `/webhooks/${endpoint}` },
          'Slack Events workspace initialized'
        );
      }

      if (this.eventsWorkspaces.length > 0) {
        this.logger.info(
          { count: this.eventsWorkspaces.length },
          'Slack Events module initialized with workspaces'
        );
      }
    }

    // Initialize Slack MCP Proxy modules for each workspace
    if (this.config.slack.mcp.enabled) {
      for (const workspaceConfig of this.config.slack.mcp.workspaces) {
        const mcpModule = new SlackMcpProxyModule(
          {
            name: workspaceConfig.name,
            binaryPath: this.config.slack.mcp.binaryPath,
            authMode: workspaceConfig.authMode,
            internalPort: workspaceConfig.internalPort,
            tokens: workspaceConfig.tokens,
            addMessageTool: workspaceConfig.addMessageTool,
          },
          this.logger.child({ module: 'slack-mcp', workspace: workspaceConfig.name })
        );

        const endpoint = this.context.registerMcpProxy(
          mcpModule.getMcpProxyHandler(),
          workspaceConfig.endpoint
        );
        mcpModule.setEndpoint(endpoint);

        this.mcpWorkspaces.push({
          config: workspaceConfig,
          module: mcpModule,
          endpoint,
        });

        this.logger.info(
          { workspace: workspaceConfig.name, endpoint: `/mcp/${endpoint}` },
          'Slack MCP Proxy workspace initialized'
        );
      }

      if (this.mcpWorkspaces.length > 0) {
        this.logger.info(
          { count: this.mcpWorkspaces.length },
          'Slack MCP Proxy module initialized with workspaces'
        );
      }
    }
  }

  async start(): Promise<void> {
    // Start all MCP proxy subprocesses
    for (const ws of this.mcpWorkspaces) {
      await ws.module.start();
      this.logger.info({ workspace: ws.config.name }, 'Slack MCP Proxy subprocess started');
    }
  }

  async stop(): Promise<void> {
    // Stop all MCP proxy subprocesses
    for (const ws of this.mcpWorkspaces) {
      await ws.module.stop();
      this.logger.info({ workspace: ws.config.name }, 'Slack MCP Proxy subprocess stopped');
    }
  }

  async healthCheck(): Promise<ModuleHealth> {
    const details: Record<string, unknown> = {};
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check health of all events workspace handlers
    if (this.eventsWorkspaces.length > 0) {
      const workspaceHealths: Record<string, unknown> = {};
      for (const ws of this.eventsWorkspaces) {
        const health = await ws.module.healthCheck();
        workspaceHealths[ws.config.name] = health;
      }
      details['events'] = {
        workspaces: workspaceHealths,
      };
    }

    // Check health of all MCP workspace handlers
    if (this.mcpWorkspaces.length > 0) {
      const mcpHealths: Record<string, unknown> = {};
      for (const ws of this.mcpWorkspaces) {
        const health = await ws.module.healthCheck();
        mcpHealths[ws.config.name] = health;

        if (health.status === 'unhealthy') {
          overallStatus = 'degraded';
        }
      }
      details['mcp'] = {
        workspaces: mcpHealths,
      };
    }

    return {
      status: overallStatus,
      details,
    };
  }

  getEndpoints(): {
    events: { workspace: string; endpoint: string }[];
    mcp: { workspace: string; endpoint: string }[];
  } {
    return {
      events: this.eventsWorkspaces.map((ws) => ({
        workspace: ws.config.name,
        endpoint: `/webhooks/${ws.endpoint}`,
      })),
      mcp: this.mcpWorkspaces.map((ws) => ({
        workspace: ws.config.name,
        endpoint: `/mcp/${ws.endpoint}`,
      })),
    };
  }
}
