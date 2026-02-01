import type { Logger } from '../../../core/logger.js';
import type { PollerConfig, PollerHandle, PollerStatus } from '../../../core/types.js';
import type { PokeClient } from '../../../integrations/poke/index.js';
import { TelegramMessageState } from '../state.js';
import { formatTelegramMessageForPoke } from '../formatter.js';
import { ALLOWED_DIALOG_TYPES, type TelegramDialog, type TelegramMessage } from '../types.js';

export interface TelegramPollingConfig {
  internalPort: number;
  interval: number;
}

export class TelegramPollingModule {
  private pollerHandle: PollerHandle | null = null;
  private messageState: TelegramMessageState;
  private internalPort: number;

  constructor(
    private config: TelegramPollingConfig,
    private pokeClient: PokeClient,
    private logger: Logger
  ) {
    this.internalPort = config.internalPort;
    this.messageState = new TelegramMessageState();
  }

  getPollerConfig(): PollerConfig {
    return {
      name: 'telegram-messages',
      interval: this.config.interval,
      immediate: false,
      handler: this.pollForMessages.bind(this),
      onError: (error) => {
        this.logger.error({ err: error }, 'Telegram polling error');
      },
    };
  }

  setPollerHandle(handle: PollerHandle): void {
    this.pollerHandle = handle;
  }

  private async pollForMessages(): Promise<void> {
    this.logger.debug('Polling for new Telegram messages');

    try {
      const groups = await this.callMcpTool<TelegramDialog[]>('groupsList', {});

      const filteredDialogs = (groups || []).filter((dialog) =>
        ALLOWED_DIALOG_TYPES.includes(dialog.type as (typeof ALLOWED_DIALOG_TYPES)[number])
      );

      this.logger.debug({ total: groups?.length || 0, filtered: filteredDialogs.length }, 'Filtered dialogs');

      for (const dialog of filteredDialogs) {
        await this.processDialog(dialog);
      }
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to poll Telegram messages');
      throw error;
    }
  }

  private async processDialog(dialog: TelegramDialog): Promise<void> {
    try {
      const lastSeenId = this.messageState.getLastSeenId(dialog.id);

      const messages = await this.callMcpTool<TelegramMessage[]>('messagesList', {
        chatId: dialog.id,
        limit: 10,
      });

      if (!messages || messages.length === 0) {
        return;
      }

      const sortedMessages = messages.sort((a, b) => a.id - b.id);

      for (const message of sortedMessages) {
        if (lastSeenId !== undefined && message.id <= lastSeenId) {
          continue;
        }

        if (this.messageState.isNewMessage(dialog.id, message)) {
          await this.forwardMessage(dialog, message);
          this.messageState.markSeen(dialog.id, message);
        }
      }
    } catch (error) {
      this.logger.warn({ err: error, dialogId: dialog.id }, 'Failed to process dialog');
    }
  }

  private async forwardMessage(dialog: TelegramDialog, message: TelegramMessage): Promise<void> {
    const formattedMessage = formatTelegramMessageForPoke(dialog, message);

    this.logger.info(
      {
        dialogId: dialog.id,
        dialogName: dialog.name,
        type: dialog.type,
        messageId: message.id,
        from: message.senderName || message.senderId,
      },
      'Forwarding Telegram message to Poke'
    );

    await this.pokeClient.sendInboundMessage(formattedMessage);
  }

  private async callMcpTool<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const response = await fetch(`http://127.0.0.1:${this.internalPort}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name,
          arguments: args,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`MCP call failed: ${response.statusText}`);
    }

    const result = (await response.json()) as {
      result?: { content?: Array<{ text?: string }> };
      error?: { message: string };
    };

    if (result.error) {
      throw new Error(`MCP error: ${result.error.message}`);
    }

    const content = result.result?.content?.[0];
    if (content?.text) {
      try {
        return JSON.parse(content.text) as T;
      } catch {
        return content.text as T;
      }
    }

    return result.result as T;
  }

  healthCheck(): PollerStatus {
    return (
      this.pollerHandle?.status() ?? {
        running: false,
        runCount: 0,
      }
    );
  }
}
