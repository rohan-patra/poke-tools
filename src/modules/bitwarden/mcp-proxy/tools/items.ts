import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';
import type { BitwardenCli } from '../cli.js';
import type { BitwardenSessionManager } from '../session.js';

export function registerItemTools(
  server: McpServer,
  cli: BitwardenCli,
  sessionManager: BitwardenSessionManager
): void {
  server.registerTool(
    'list_items',
    {
      description:
        'List items in the Bitwarden vault. Results are scoped to the configured organization and collection.',
      inputSchema: z.object({
        search: z.string().optional().describe('Search term to filter items by name or content'),
        folderId: z.string().optional().describe('Filter items by folder ID'),
      }),
    },
    async ({ search, folderId }) => {
      const session = sessionManager.getSession();
      const items = await cli.listItems(session, { search, folderId });
      return { content: [{ type: 'text' as const, text: JSON.stringify(items, null, 2) }] };
    }
  );

  server.registerTool(
    'get_item',
    {
      description: 'Get a single item from the Bitwarden vault by its ID or exact name.',
      inputSchema: z.object({
        id: z.string().describe('Item ID (UUID) or exact item name'),
      }),
    },
    async ({ id }) => {
      const session = sessionManager.getSession();
      const item = await cli.getItem(session, id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(item, null, 2) }] };
    }
  );

  server.registerTool(
    'create_item',
    {
      description:
        'Create a new item in the Bitwarden vault. The item is automatically added to the configured organization and collection. Item types: 1=Login, 2=Secure Note, 3=Card, 4=Identity.',
      inputSchema: z.object({
        type: z.number().describe('Item type: 1=Login, 2=Secure Note, 3=Card, 4=Identity'),
        name: z.string().describe('Name of the item'),
        notes: z.string().optional().describe('Notes for the item'),
        folderId: z.string().optional().describe('Folder ID to place the item in'),
        login: z
          .object({
            username: z.string().optional().describe('Username'),
            password: z.string().optional().describe('Password'),
            uris: z
              .array(
                z.object({
                  uri: z.string().describe('URI/URL'),
                  match: z.number().optional().describe('URI match type'),
                })
              )
              .optional()
              .describe('Login URIs'),
            totp: z.string().optional().describe('TOTP secret key'),
          })
          .optional()
          .describe('Login-specific fields (for type 1)'),
        fields: z
          .array(
            z.object({
              name: z.string().describe('Field name'),
              value: z.string().describe('Field value'),
              type: z.number().describe('Field type: 0=Text, 1=Hidden, 2=Boolean'),
            })
          )
          .optional()
          .describe('Custom fields'),
      }),
    },
    async (input) => {
      const session = sessionManager.getSession();
      const item = await cli.createItem(session, input);
      return { content: [{ type: 'text' as const, text: JSON.stringify(item, null, 2) }] };
    }
  );

  server.registerTool(
    'edit_item',
    {
      description:
        'Edit an existing item in the Bitwarden vault. You must provide the full item object with all fields (get the item first, modify it, then pass the full object).',
      inputSchema: z.object({
        id: z.string().describe('Item ID (UUID) to edit'),
        item: z
          .record(z.string(), z.unknown())
          .describe(
            'Full item object with modifications applied. Get the item first with get_item, modify desired fields, then pass the entire object here.'
          ),
      }),
    },
    async ({ id, item }) => {
      const session = sessionManager.getSession();
      const result = await cli.editItem(session, id, item as Record<string, unknown>);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    'delete_item',
    {
      description:
        'Delete an item from the Bitwarden vault. By default, items are soft-deleted (sent to trash). Use permanent=true to permanently delete.',
      inputSchema: z.object({
        id: z.string().describe('Item ID (UUID) to delete'),
        permanent: z
          .boolean()
          .optional()
          .default(false)
          .describe('Permanently delete instead of sending to trash'),
      }),
    },
    async ({ id, permanent }) => {
      const session = sessionManager.getSession();
      await cli.deleteItem(session, id, permanent);
      return {
        content: [
          {
            type: 'text' as const,
            text: permanent ? `Item ${id} permanently deleted.` : `Item ${id} moved to trash.`,
          },
        ],
      };
    }
  );

  server.registerTool(
    'restore_item',
    {
      description: 'Restore a soft-deleted (trashed) item in the Bitwarden vault.',
      inputSchema: z.object({
        id: z.string().describe('Item ID (UUID) to restore from trash'),
      }),
    },
    async ({ id }) => {
      const session = sessionManager.getSession();
      await cli.restoreItem(session, id);
      return { content: [{ type: 'text' as const, text: `Item ${id} restored.` }] };
    }
  );
}
