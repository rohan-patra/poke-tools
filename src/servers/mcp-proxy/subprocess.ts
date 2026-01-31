import { spawn, type ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import type { Logger } from '../../core/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveBinaryPath(binaryPath: string): string {
  // If it's an absolute path, use it directly
  if (binaryPath.startsWith('/')) {
    return binaryPath;
  }

  // Try to find in node_modules/.bin relative to project root
  const projectRoot = resolve(__dirname, '../../..');
  const nodeModulesBin = resolve(projectRoot, 'node_modules', '.bin', binaryPath);
  if (existsSync(nodeModulesBin)) {
    return nodeModulesBin;
  }

  // Fall back to the original path (will use PATH)
  return binaryPath;
}

export interface SubprocessConfig {
  name: string;
  binaryPath: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface SubprocessStatus {
  running: boolean;
  pid?: number;
  uptime?: number;
  restartCount: number;
  lastError?: string;
}

export class SubprocessManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private startTime: number = 0;
  private restartAttempts = 0;
  private maxRestarts = 5;
  private restartDelay = 1000;
  private shuttingDown = false;
  private lastError?: string;

  constructor(
    private config: SubprocessConfig,
    private logger: Logger
  ) {
    super();
  }

  private handleOutput(data: Buffer, stream: 'stdout' | 'stderr'): void {
    const lines = data.toString().trim().split('\n');

    for (const line of lines) {
      if (!line) continue;

      // Try to parse as JSON log from slack-mcp-server
      try {
        const parsed = JSON.parse(line) as { level?: string; message?: string; [key: string]: unknown };
        const { level, message, timestamp, app, ...rest } = parsed;

        // Map slack-mcp-server log levels to pino levels
        const logMethod =
          level === 'fatal' || level === 'error'
            ? 'error'
            : level === 'warn'
              ? 'warn'
              : level === 'info'
                ? 'info'
                : 'debug';

        // Log with parsed fields
        this.logger[logMethod]({ ...rest }, message ?? line);
      } catch {
        // Not JSON, log as plain text
        if (stream === 'stderr') {
          this.logger.warn(line);
        } else {
          this.logger.debug(line);
        }
      }
    }
  }

  async start(): Promise<void> {
    if (this.process) {
      throw new Error('Process already running');
    }

    this.shuttingDown = false;

    const env = {
      ...process.env,
      ...this.config.env,
    };

    const resolvedPath = resolveBinaryPath(this.config.binaryPath);
    this.logger.info({ name: this.config.name, binaryPath: resolvedPath }, 'Starting subprocess');

    this.process = spawn(resolvedPath, this.config.args ?? [], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.startTime = Date.now();

    this.process.stdout?.on('data', (data: Buffer) => {
      this.handleOutput(data, 'stdout');
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      this.handleOutput(data, 'stderr');
    });

    this.process.on('error', (err) => {
      this.logger.error({ name: this.config.name, err }, 'Subprocess error');
      this.lastError = err.message;
      this.process = null;
      // Don't re-emit error to avoid crashing the app
    });

    this.process.on('exit', (code, signal) => {
      this.logger.warn({ name: this.config.name, code, signal }, 'Subprocess exited');
      this.process = null;
      this.emit('exit', code, signal);

      if (!this.shuttingDown && this.restartAttempts < this.maxRestarts) {
        this.restartAttempts++;
        const delay = this.restartDelay * this.restartAttempts;
        this.logger.info(
          { name: this.config.name, attempt: this.restartAttempts, delay },
          'Scheduling subprocess restart'
        );
        setTimeout(() => {
          if (!this.shuttingDown) {
            this.start().catch((err) => {
              this.logger.error({ name: this.config.name, err }, 'Failed to restart subprocess');
            });
          }
        }, delay);
      } else if (this.restartAttempts >= this.maxRestarts) {
        this.logger.error({ name: this.config.name }, 'Max restart attempts reached');
        this.emit('maxRestartsReached');
      }
    });

    this.logger.info({ name: this.config.name, pid: this.process.pid }, 'Subprocess started');
  }

  async stop(): Promise<void> {
    const proc = this.process;
    if (!proc) return;

    this.shuttingDown = true;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (this.process) {
          this.logger.warn({ name: this.config.name }, 'Force killing subprocess');
          this.process.kill('SIGKILL');
        }
        resolve();
      }, 5000);

      proc.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });

      proc.kill('SIGTERM');
    });
  }

  get status(): SubprocessStatus {
    return {
      running: !!this.process,
      pid: this.process?.pid,
      uptime: this.process ? Date.now() - this.startTime : undefined,
      restartCount: this.restartAttempts,
      lastError: this.lastError,
    };
  }

  get stdin() {
    return this.process?.stdin ?? null;
  }

  get stdout() {
    return this.process?.stdout ?? null;
  }

  get stderr() {
    return this.process?.stderr ?? null;
  }
}
