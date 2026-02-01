/**
 * Telegram message structure from tgcli MCP tools
 */
export interface TelegramMessage {
  id: number;
  date: string;
  text: string;
  senderId: number;
  senderName?: string;
}

/**
 * Telegram dialog/chat structure
 */
export interface TelegramDialog {
  id: number;
  name: string;
  type: 'user' | 'group' | 'channel' | 'bot';
  title?: string;
  unreadCount?: number;
}

/**
 * Dialog types that should be included in polling
 * - user: Direct messages
 * - group: Group chats
 * Excluded:
 * - channel: Broadcast channels (not interactive)
 */
export const ALLOWED_DIALOG_TYPES = ['user', 'group'] as const;
export type AllowedDialogType = (typeof ALLOWED_DIALOG_TYPES)[number];

/**
 * MCP tool call result structure
 */
export interface McpToolResult<T = unknown> {
  content: Array<{
    type: string;
    text?: string;
    data?: T;
  }>;
}
