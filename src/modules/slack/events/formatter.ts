export interface SlackMessageEvent {
  type: 'message';
  subtype?: string;
  channel: string;
  user: string;
  text: string;
  ts: string;
  thread_ts?: string;
  channel_type?: string;
}

export interface SlackEventPayload {
  token: string;
  team_id: string;
  api_app_id: string;
  event: SlackMessageEvent;
  type: 'event_callback';
  event_id: string;
  event_time: number;
}

export interface MessageContext {
  channelName?: string;
  userName?: string;
  permalink?: string;
}

/**
 * Formats a Slack message event into a string for Poke.
 * Includes message content and MCP-compatible identifiers for context lookup.
 *
 * @param event - The Slack message event
 * @param workspace - Workspace identifier (e.g., "workspace1", "acme")
 * @param context - Optional context with display names for channel and user
 */
export function formatSlackMessageForPoke(
  event: SlackMessageEvent,
  workspace: string,
  context?: MessageContext
): string {
  const text = convertMrkdwnToPlainText(event.text);

  // Build a concise message with identifiers for MCP lookup
  const parts: string[] = [];

  // Header split into workspace and channel parts
  parts.push(`[Slack:${workspace}]`);

  // Channel with optional display name
  if (context?.channelName) {
    parts.push(`channel:${event.channel} (#${context.channelName})`);
  } else {
    parts.push(`channel:${event.channel}`);
  }

  // Thread context if in a thread (use thread_ts for MCP lookup via conversations_replies)
  if (event.thread_ts) {
    parts.push(`thread:${event.thread_ts}`);
  }

  // Message timestamp (can be used with channel_id for precise message lookup)
  parts.push(`ts:${event.ts}`);

  // User who sent the message with optional display name
  if (context?.userName) {
    parts.push(`from:${event.user} (${context.userName})`);
  } else {
    parts.push(`from:${event.user}`);
  }

  // Permalink to the message
  if (context?.permalink) {
    parts.push(`link:${context.permalink}`);
  }

  // The actual message content
  parts.push('');
  parts.push(text);

  return parts.join('\n');
}

/**
 * Converts Slack mrkdwn to plain text.
 */
function convertMrkdwnToPlainText(text: string): string {
  return (
    text
      // Convert user mentions: <@U123> -> @user
      .replace(/<@([A-Z0-9]+)>/g, '@$1')
      // Convert channel mentions: <#C123|channel-name> -> #channel-name
      .replace(/<#[A-Z0-9]+\|([^>]+)>/g, '#$1')
      // Convert channel mentions without name: <#C123> -> #C123
      .replace(/<#([A-Z0-9]+)>/g, '#$1')
      // Convert links: <url|text> -> text (url)
      .replace(/<([^|>]+)\|([^>]+)>/g, '$2 ($1)')
      // Convert bare links: <url> -> url
      .replace(/<([^>]+)>/g, '$1')
      // Bold: *text* -> text
      .replace(/\*([^*]+)\*/g, '$1')
      // Italic: _text_ -> text
      .replace(/_([^_]+)_/g, '$1')
      // Strikethrough: ~text~ -> text
      .replace(/~([^~]+)~/g, '$1')
      // Inline code: `text` -> text
      .replace(/`([^`]+)`/g, '$1')
      // Code block: ```text``` -> text
      .replace(/```[\s\S]*?```/g, (match) => match.slice(3, -3).trim())
  );
}

/**
 * Checks if the event is a regular message (not a subtype like bot_message, channel_join, etc.)
 */
export function isRegularMessage(event: SlackMessageEvent): boolean {
  return event.type === 'message' && !event.subtype;
}
