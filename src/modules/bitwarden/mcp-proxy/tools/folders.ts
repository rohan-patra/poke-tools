import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';
import type { BitwardenCli } from '../cli.js';
import type { BitwardenSessionManager } from '../session.js';

export function registerFolderTools(
  server: McpServer,
  cli: BitwardenCli,
  sessionManager: BitwardenSessionManager
): void {
  server.registerTool(
    'list_folders',
    {
      description: 'List all folders in the Bitwarden vault.',
      inputSchema: z.object({}),
    },
    async () => {
      const session = sessionManager.getSession();
      const folders = await cli.listFolders(session);
      return { content: [{ type: 'text' as const, text: JSON.stringify(folders, null, 2) }] };
    }
  );

  server.registerTool(
    'get_folder',
    {
      description: 'Get a single folder by its ID.',
      inputSchema: z.object({
        id: z.string().describe('Folder ID (UUID)'),
      }),
    },
    async ({ id }) => {
      const session = sessionManager.getSession();
      const folder = await cli.getFolder(session, id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(folder, null, 2) }] };
    }
  );
}
