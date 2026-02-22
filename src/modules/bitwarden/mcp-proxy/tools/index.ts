import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BitwardenCli } from '../cli.js';
import type { BitwardenSessionManager } from '../session.js';
import { registerCollectionTools } from './collections.js';
import { registerFolderTools } from './folders.js';
import { registerItemTools } from './items.js';
import { registerMiscTools } from './misc.js';

export function registerAllTools(
  server: McpServer,
  cli: BitwardenCli,
  sessionManager: BitwardenSessionManager
): void {
  registerItemTools(server, cli, sessionManager);
  registerFolderTools(server, cli, sessionManager);
  registerCollectionTools(server, cli, sessionManager);
  registerMiscTools(server, cli, sessionManager);
}
