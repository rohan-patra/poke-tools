import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Logger } from '../../../core/logger.js';
import type { McpProxyHandler, ModuleHealth } from '../../../core/types.js';
import type { MoltbookWorkspaceConfig } from '../../../config/index.js';
import type { MoltbookClient } from '../../../integrations/moltbook/index.js';
import { MOLTBOOK_TOOLS, executeToolCall } from './tools.js';

// JSON-RPC 2.0 types
interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
  id?: string | number | null;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  id: string | number | null;
}

// MCP Protocol types
interface McpInitializeParams {
  protocolVersion: string;
  capabilities?: Record<string, unknown>;
  clientInfo?: {
    name: string;
    version: string;
  };
}

interface McpToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

export class MoltbookMcpHandler {
  private endpoint: string = '';

  constructor(
    private config: MoltbookWorkspaceConfig,
    private client: MoltbookClient,
    private logger: Logger
  ) {}

  getMcpProxyHandler(): McpProxyHandler {
    return {
      name: `moltbook-mcp-${this.config.name}`,
      proxy: this.handleRequest.bind(this),
    };
  }

  setEndpoint(endpoint: string): void {
    this.endpoint = endpoint;
  }

  private async handleRequest(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = req.body as JsonRpcRequest;

    // Validate JSON-RPC format
    if (!body || body.jsonrpc !== '2.0') {
      return reply.send(this.errorResponse(-32600, 'Invalid Request', null));
    }

    const id = body.id ?? null;

    try {
      let result: unknown;

      switch (body.method) {
        case 'initialize':
          result = this.handleInitialize(body.params as McpInitializeParams);
          break;

        case 'initialized':
          // Notification, no response needed for notifications without id
          if (id === null) {
            return reply.status(204).send();
          }
          result = {};
          break;

        case 'tools/list':
          result = this.handleToolsList();
          break;

        case 'tools/call':
          result = await this.handleToolsCall(body.params as McpToolCallParams);
          break;

        case 'ping':
          result = {};
          break;

        default:
          return reply.send(this.errorResponse(-32601, `Method not found: ${body.method}`, id));
      }

      return reply.send(this.successResponse(result, id));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal error';
      this.logger.error({ err: error, method: body.method }, 'MCP request failed');
      return reply.send(this.errorResponse(-32603, message, id));
    }
  }

  private handleInitialize(_params?: McpInitializeParams): {
    protocolVersion: string;
    capabilities: { tools: Record<string, never> };
    serverInfo: { name: string; version: string };
  } {
    this.logger.info('MCP client initializing');

    return {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: `moltbook-mcp-${this.config.name}`,
        version: '1.0.0',
      },
    };
  }

  private handleToolsList(): { tools: typeof MOLTBOOK_TOOLS } {
    return {
      tools: MOLTBOOK_TOOLS,
    };
  }

  private async handleToolsCall(params: McpToolCallParams): Promise<{
    content: Array<{ type: 'text'; text: string }>;
    isError?: boolean;
  }> {
    if (!params?.name) {
      throw new Error('Tool name is required');
    }

    this.logger.debug({ tool: params.name, args: params.arguments }, 'Executing tool');

    try {
      const result = await executeToolCall(this.client, params.name, params.arguments || {});

      return {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tool execution failed';
      this.logger.error({ err: error, tool: params.name }, 'Tool execution failed');

      return {
        content: [
          {
            type: 'text',
            text: message,
          },
        ],
        isError: true,
      };
    }
  }

  private successResponse(result: unknown, id: string | number | null): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      result,
      id,
    };
  }

  private errorResponse(code: number, message: string, id: string | number | null): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      error: { code, message },
      id,
    };
  }

  async healthCheck(): Promise<ModuleHealth> {
    try {
      // Try to get agent status to verify API key is valid
      await this.client.getStatus();
      return {
        status: 'healthy',
        endpoint: `/mcp/${this.endpoint}`,
      };
    } catch {
      return {
        status: 'unhealthy',
        endpoint: `/mcp/${this.endpoint}`,
        details: {
          error: 'Failed to connect to Moltbook API',
        },
      };
    }
  }
}
