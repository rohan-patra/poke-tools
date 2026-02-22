import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';
import type { BitwardenCli } from '../cli.js';
import type { BitwardenSessionManager } from '../session.js';

export function registerCollectionTools(
  server: McpServer,
  cli: BitwardenCli,
  sessionManager: BitwardenSessionManager
): void {
  server.registerTool(
    'list_collections',
    {
      description: 'List all collections in the configured Bitwarden organization.',
      inputSchema: z.object({}),
    },
    async () => {
      const session = sessionManager.getSession();
      const collections = await cli.listCollections(session);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(collections, null, 2) }],
      };
    }
  );
}
