import type { TelegramDialog, TelegramMessage } from './types.js';

/**
 * Formats a Telegram message for Poke.
 * Includes message content and identifiers for context lookup via MCP tools.
 */
export function formatTelegramMessageForPoke(dialog: TelegramDialog, message: TelegramMessage): string {
  const parts: string[] = [];

  parts.push('[Telegram]');
  parts.push(`dialog:${dialog.id}`);
  parts.push(`type:${mapDialogType(dialog.type)}`);

  if (dialog.title && dialog.title !== dialog.name) {
    parts.push(`title:${dialog.title}`);
  } else if (dialog.name) {
    parts.push(`name:${dialog.name}`);
  }

  parts.push(`from:${message.senderName || message.senderId}`);
  parts.push(`msgId:${message.id}`);
  parts.push(`time:${message.date}`);

  parts.push('');
  parts.push(message.text);

  return parts.join('\n');
}

/**
 * Maps internal dialog type to user-friendly name
 */
function mapDialogType(type: string): string {
  switch (type) {
    case 'user':
      return 'dm';
    case 'group':
      return 'group';
    case 'channel':
      return 'channel';
    case 'bot':
      return 'bot';
    default:
      return type;
  }
}
