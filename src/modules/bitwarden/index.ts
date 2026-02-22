import type { AppConfig } from '../../config/index.js';
import type { Logger } from '../../core/logger.js';
import type { Module, ModuleContext, ModuleHealth } from '../../core/types.js';
import { BitwardenMcpProxyModule } from './mcp-proxy/index.js';

export class BitwardenModule implements Module {
  name = 'bitwarden';

  private mcpProxy: BitwardenMcpProxyModule;
  private endpoint = '';

  constructor(
    private config: AppConfig,
    private context: ModuleContext,
    private logger: Logger
  ) {
    this.mcpProxy = new BitwardenMcpProxyModule(
      {
        cliPath: config.bitwarden.cliPath,
        internalPort: config.bitwarden.internalPort,
        clientId: config.bitwarden.clientId,
        clientSecret: config.bitwarden.clientSecret,
        clientPasswd: config.bitwarden.clientPasswd,
        organizationId: config.bitwarden.organizationId,
        collectionId: config.bitwarden.collectionId,
      },
      logger.child({ module: 'bitwarden-mcp' })
    );
  }

  async initialize(): Promise<void> {
    this.endpoint = this.context.registerMcpProxy(
      this.mcpProxy.getMcpProxyHandler(),
      this.config.bitwarden.endpoint
    );
    this.mcpProxy.setEndpoint(this.endpoint);
    this.logger.info({ endpoint: `/mcp/${this.endpoint}` }, 'Bitwarden MCP proxy initialized');
  }

  async start(): Promise<void> {
    await this.mcpProxy.start();
    this.logger.info('Bitwarden MCP proxy started');
  }

  async stop(): Promise<void> {
    await this.mcpProxy.stop();
    this.logger.info('Bitwarden MCP proxy stopped');
  }

  async healthCheck(): Promise<ModuleHealth> {
    return this.mcpProxy.healthCheck();
  }

  getEndpoints(): { mcp: string } {
    return { mcp: `/mcp/${this.endpoint}` };
  }
}
