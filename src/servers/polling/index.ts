import type { Logger } from '../../core/logger.js';
import type { PollerConfig, PollerHandle, PollerStatus } from '../../core/types.js';

interface PollerState {
  config: PollerConfig;
  timer: ReturnType<typeof setInterval> | null;
  running: boolean;
  lastRun?: Date;
  lastError?: string;
  runCount: number;
}

export class PollingManager {
  private pollers: Map<string, PollerState> = new Map();

  constructor(private logger: Logger) {}

  register(config: PollerConfig): PollerHandle {
    if (this.pollers.has(config.name)) {
      throw new Error(`Poller '${config.name}' already registered`);
    }

    const state: PollerState = {
      config,
      timer: null,
      running: false,
      runCount: 0,
    };

    this.pollers.set(config.name, state);

    const handle: PollerHandle = {
      start: () => this.startPoller(config.name),
      stop: () => this.stopPoller(config.name),
      trigger: () => this.triggerPoller(config.name),
      status: () => this.getStatus(config.name),
    };

    this.logger.info({ name: config.name, interval: config.interval }, 'Poller registered');

    return handle;
  }

  private startPoller(name: string): void {
    const state = this.pollers.get(name);
    if (!state) throw new Error(`Poller '${name}' not found`);
    if (state.running) return;

    state.running = true;

    if (state.config.immediate) {
      this.runPoller(name);
    }

    state.timer = setInterval(() => {
      this.runPoller(name);
    }, state.config.interval);

    this.logger.info({ name }, 'Poller started');
  }

  private stopPoller(name: string): void {
    const state = this.pollers.get(name);
    if (!state) throw new Error(`Poller '${name}' not found`);

    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }

    state.running = false;
    this.logger.info({ name }, 'Poller stopped');
  }

  private async triggerPoller(name: string): Promise<void> {
    await this.runPoller(name);
  }

  private async runPoller(name: string): Promise<void> {
    const state = this.pollers.get(name);
    if (!state) throw new Error(`Poller '${name}' not found`);

    try {
      await state.config.handler();
      state.lastRun = new Date();
      state.runCount++;
      state.lastError = undefined;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      state.lastError = errorMessage;
      this.logger.error({ name, err: error }, 'Poller error');

      if (state.config.onError) {
        state.config.onError(error instanceof Error ? error : new Error(errorMessage));
      }
    }
  }

  private getStatus(name: string): PollerStatus {
    const state = this.pollers.get(name);
    if (!state) throw new Error(`Poller '${name}' not found`);

    return {
      running: state.running,
      lastRun: state.lastRun,
      lastError: state.lastError,
      runCount: state.runCount,
    };
  }

  startAll(): void {
    for (const name of this.pollers.keys()) {
      this.startPoller(name);
    }
  }

  stopAll(): void {
    for (const name of this.pollers.keys()) {
      this.stopPoller(name);
    }
  }

  getAllStatus(): Record<string, PollerStatus> {
    const result: Record<string, PollerStatus> = {};
    for (const name of this.pollers.keys()) {
      result[name] = this.getStatus(name);
    }
    return result;
  }
}
