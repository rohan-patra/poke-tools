import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';
import type { BitwardenCli } from '../cli.js';
import type { BitwardenSessionManager } from '../session.js';

export function registerMiscTools(
  server: McpServer,
  cli: BitwardenCli,
  sessionManager: BitwardenSessionManager
): void {
  server.registerTool(
    'sync_vault',
    {
      description: 'Force sync the local Bitwarden vault with the remote server to get the latest changes.',
      inputSchema: z.object({}),
    },
    async () => {
      const session = sessionManager.getSession();
      await cli.sync(session);
      return { content: [{ type: 'text' as const, text: 'Vault synced successfully.' }] };
    }
  );

  server.registerTool(
    'generate_password',
    {
      description: "Generate a random password or passphrase using Bitwarden's generator.",
      inputSchema: z.object({
        length: z.number().optional().default(20).describe('Password length (default: 20)'),
        uppercase: z.boolean().optional().default(true).describe('Include uppercase letters'),
        lowercase: z.boolean().optional().default(true).describe('Include lowercase letters'),
        number: z.boolean().optional().default(true).describe('Include numbers'),
        special: z.boolean().optional().default(true).describe('Include special characters'),
        passphrase: z
          .boolean()
          .optional()
          .default(false)
          .describe('Generate a passphrase instead of a password'),
        words: z.number().optional().default(3).describe('Number of words for passphrase (default: 3)'),
        separator: z.string().optional().default('-').describe('Word separator for passphrase (default: -)'),
      }),
    },
    async (options) => {
      const session = sessionManager.getSession();
      const result = await cli.generate(session, options);
      return { content: [{ type: 'text' as const, text: result }] };
    }
  );

  server.registerTool(
    'get_vault_status',
    {
      description:
        'Get the current status of the Bitwarden vault (locked/unlocked state, last sync time, etc.).',
      inputSchema: z.object({}),
    },
    async () => {
      const session = sessionManager.getSession();
      const status = await cli.status(session);
      return { content: [{ type: 'text' as const, text: JSON.stringify(status, null, 2) }] };
    }
  );
}
