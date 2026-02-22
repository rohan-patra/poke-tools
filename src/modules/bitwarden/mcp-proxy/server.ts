import { createServer, type Server } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Logger } from '../../../core/logger.js';
import type { BitwardenCli } from './cli.js';
import type { BitwardenSessionManager } from './session.js';
import { registerAllTools } from './tools/index.js';

function createMcpServerInstance(cli: BitwardenCli, sessionManager: BitwardenSessionManager): McpServer {
  const mcpServer = new McpServer({
    name: 'bitwarden-mcp-server',
    version: '1.0.0',
  });
  registerAllTools(mcpServer, cli, sessionManager);
  return mcpServer;
}

export async function createBitwardenMcpServer(
  cli: BitwardenCli,
  sessionManager: BitwardenSessionManager,
  port: number,
  logger: Logger
): Promise<{ httpServer: Server }> {
  const httpServer = createServer(async (req, res) => {
    if (req.method === 'POST' && (req.url === '/mcp' || req.url === '/mcp/')) {
      try {
        const mcpServer = createMcpServerInstance(cli, sessionManager);
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
        });
        await mcpServer.connect(transport);
        await transport.handleRequest(req, res);
      } catch (err) {
        logger.error({ err }, 'Error handling MCP request');
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      }
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(port, '127.0.0.1', () => {
      logger.info({ port }, 'Bitwarden MCP HTTP server listening');
      resolve();
    });
  });

  return { httpServer };
}
