import type { Logger } from '../../../core/logger.js';
import type { BitwardenCli } from './cli.js';

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export class BitwardenSessionManager {
  private session: string | null = null;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private sessionState: 'logged_out' | 'locked' | 'unlocked' = 'logged_out';

  constructor(
    private cli: BitwardenCli,
    private clientId: string,
    private clientSecret: string,
    private clientPasswd: string,
    private logger: Logger
  ) {}

  async initialize(): Promise<void> {
    this.logger.info('Initializing Bitwarden session...');

    // Login with API key
    await this.cli.login(this.clientId, this.clientSecret);
    this.sessionState = 'locked';

    // Unlock vault
    this.session = await this.cli.unlock(this.clientPasswd);
    this.sessionState = 'unlocked';

    // Initial sync
    await this.cli.sync(this.session);

    // Start periodic sync
    this.syncTimer = setInterval(() => {
      if (this.session) {
        this.cli.sync(this.session).catch((err) => {
          this.logger.warn({ err }, 'Periodic sync failed');
        });
      }
    }, SYNC_INTERVAL_MS);

    this.logger.info('Bitwarden session initialized');
  }

  getSession(): string {
    if (!this.session || this.sessionState !== 'unlocked') {
      throw new Error('Bitwarden vault is not unlocked');
    }
    return this.session;
  }

  get isUnlocked(): boolean {
    return this.sessionState === 'unlocked' && this.session !== null;
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Bitwarden session...');

    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    if (this.session && this.sessionState === 'unlocked') {
      try {
        await this.cli.lock(this.session);
        this.sessionState = 'locked';
      } catch (err) {
        this.logger.warn({ err }, 'Failed to lock vault during shutdown');
      }
    }

    if (this.sessionState !== 'logged_out') {
      try {
        await this.cli.logout();
        this.sessionState = 'logged_out';
      } catch (err) {
        this.logger.warn({ err }, 'Failed to logout during shutdown');
      }
    }

    this.session = null;
    this.logger.info('Bitwarden session shut down');
  }
}
