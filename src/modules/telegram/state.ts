import type { TelegramMessage } from './types.js';

interface MessageState {
  id: number;
  date: string;
  textHash: string;
}

/**
 * Tracks seen messages to avoid forwarding duplicates.
 * State is in-memory and resets on restart.
 */
export class TelegramMessageState {
  private state: Map<number, MessageState> = new Map();

  /**
   * Check if a message is new (not yet processed)
   */
  isNewMessage(dialogId: number, message: TelegramMessage): boolean {
    const existing = this.state.get(dialogId);

    if (!existing) {
      return true;
    }

    if (message.id > existing.id) {
      return true;
    }

    if (message.id === existing.id) {
      const textHash = this.hashText(message.text);
      return textHash !== existing.textHash;
    }

    return false;
  }

  /**
   * Mark a message as seen
   */
  markSeen(dialogId: number, message: TelegramMessage): void {
    this.state.set(dialogId, {
      id: message.id,
      date: message.date,
      textHash: this.hashText(message.text),
    });
  }

  /**
   * Get the last seen message ID for a dialog
   */
  getLastSeenId(dialogId: number): number | undefined {
    return this.state.get(dialogId)?.id;
  }

  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * Export state for potential persistence
   */
  export(): Record<number, MessageState> {
    return Object.fromEntries(this.state);
  }

  /**
   * Import state (e.g., from file on restart)
   */
  import(data: Record<number, MessageState>): void {
    this.state = new Map(Object.entries(data).map(([k, v]) => [Number(k), v]));
  }
}
