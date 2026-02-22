import { execFile } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { BitwardenCliError } from '../../../core/errors.js';
import type { Logger } from '../../../core/logger.js';

const execFileAsync = promisify(execFile);

const CLI_TIMEOUT = 30_000;

export interface GenerateOptions {
  length?: number;
  uppercase?: boolean;
  lowercase?: boolean;
  number?: boolean;
  special?: boolean;
  passphrase?: boolean;
  words?: number;
  separator?: string;
}

export class BitwardenCli {
  private queue: Promise<unknown> = Promise.resolve();
  private appDataDir: string;

  constructor(
    private cliPath: string,
    private organizationId: string,
    private collectionId: string,
    private logger: Logger
  ) {
    this.appDataDir = mkdtempSync(join(tmpdir(), 'bw-'));
  }

  private serialize<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.queue.then(fn, fn);
    this.queue = result.catch(() => {});
    return result;
  }

  private async exec(
    args: string[],
    options?: { session?: string; env?: Record<string, string> }
  ): Promise<string> {
    return this.serialize(async () => {
      const env: Record<string, string> = {
        ...(process.env as Record<string, string>),
        BITWARDENCLI_APPDATA_DIR: this.appDataDir,
        BW_NOINTERACTION: 'true',
        ...(options?.env ?? {}),
      };

      if (options?.session) {
        // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
        env['BW_SESSION'] = options.session;
      }

      this.logger.debug({ args: args.filter((a) => !a.startsWith('eyJ')) }, 'Executing bw command');

      try {
        const { stdout, stderr } = await execFileAsync(this.cliPath, args, {
          env,
          timeout: CLI_TIMEOUT,
          maxBuffer: 10 * 1024 * 1024,
        });

        if (stderr?.trim()) {
          this.logger.debug({ stderr: stderr.trim() }, 'bw stderr');
        }

        return stdout;
      } catch (error) {
        const err = error as Error & { stderr?: string; code?: string };
        const message = err.stderr?.trim() || err.message;
        this.logger.error({ args: args[0], error: message }, 'bw command failed');
        throw new BitwardenCliError(`bw ${args[0]} failed: ${message}`, {
          command: args[0],
        });
      }
    });
  }

  async login(clientId: string, clientSecret: string): Promise<void> {
    await this.exec(['login', '--apikey'], {
      env: {
        BW_CLIENTID: clientId,
        BW_CLIENTSECRET: clientSecret,
      },
    });
    this.logger.info('Bitwarden login successful');
  }

  async unlock(password: string): Promise<string> {
    const stdout = await this.exec(['unlock', '--passwordenv', 'BW_UNLOCK_PASSWD'], {
      env: { BW_UNLOCK_PASSWD: password },
    });

    // Parse session key from output
    const match = stdout.match(/BW_SESSION="([^"]+)"/);
    if (!match?.[1]) {
      throw new BitwardenCliError('Failed to parse BW_SESSION from unlock output');
    }

    this.logger.info('Bitwarden vault unlocked');
    return match[1];
  }

  async lock(session: string): Promise<void> {
    await this.exec(['lock'], { session });
    this.logger.info('Bitwarden vault locked');
  }

  async logout(): Promise<void> {
    await this.exec(['logout']);
    this.logger.info('Bitwarden logged out');
  }

  async sync(session: string): Promise<void> {
    await this.exec(['sync'], { session });
    this.logger.debug('Bitwarden vault synced');
  }

  async status(session?: string): Promise<unknown> {
    const stdout = await this.exec(['status', '--raw'], { session });
    return JSON.parse(stdout);
  }

  async listItems(session: string, options?: { search?: string; folderId?: string }): Promise<unknown[]> {
    const args = [
      'list',
      'items',
      '--organizationid',
      this.organizationId,
      '--collectionid',
      this.collectionId,
    ];
    if (options?.search) {
      args.push('--search', options.search);
    }
    if (options?.folderId) {
      args.push('--folderid', options.folderId);
    }
    const stdout = await this.exec(args, { session });
    return JSON.parse(stdout);
  }

  async getItem(session: string, idOrName: string): Promise<unknown> {
    const stdout = await this.exec(['get', 'item', idOrName], { session });
    return JSON.parse(stdout);
  }

  async createItem(session: string, item: Record<string, unknown>): Promise<unknown> {
    // Inject organization and collection
    const itemWithOrg = {
      ...item,
      organizationId: this.organizationId,
      collectionIds: [this.collectionId],
    };

    const encoded = Buffer.from(JSON.stringify(itemWithOrg)).toString('base64');
    const stdout = await this.exec(['create', 'item', encoded], { session });
    return JSON.parse(stdout);
  }

  async editItem(session: string, id: string, item: Record<string, unknown>): Promise<unknown> {
    const encoded = Buffer.from(JSON.stringify(item)).toString('base64');
    const stdout = await this.exec(['edit', 'item', id, encoded], { session });
    return JSON.parse(stdout);
  }

  async deleteItem(session: string, id: string, permanent = false): Promise<void> {
    const args = ['delete', 'item', id];
    if (permanent) {
      args.push('-p');
    }
    await this.exec(args, { session });
  }

  async restoreItem(session: string, id: string): Promise<void> {
    await this.exec(['restore', 'item', id], { session });
  }

  async listFolders(session: string): Promise<unknown[]> {
    const stdout = await this.exec(['list', 'folders'], { session });
    return JSON.parse(stdout);
  }

  async getFolder(session: string, id: string): Promise<unknown> {
    const stdout = await this.exec(['get', 'folder', id], { session });
    return JSON.parse(stdout);
  }

  async listCollections(session: string): Promise<unknown[]> {
    const stdout = await this.exec(['list', 'collections', '--organizationid', this.organizationId], {
      session,
    });
    return JSON.parse(stdout);
  }

  async generate(session: string, options?: GenerateOptions): Promise<string> {
    const args = ['generate'];
    if (options?.passphrase) {
      args.push('--passphrase');
      if (options.words !== undefined) args.push('--words', String(options.words));
      if (options.separator !== undefined) args.push('--separator', options.separator);
    } else {
      if (options?.length !== undefined) args.push('--length', String(options.length));
      if (options?.uppercase === true) args.push('-u');
      if (options?.lowercase === true) args.push('-l');
      if (options?.number === true) args.push('-n');
      if (options?.special === true) args.push('--special');
    }
    const stdout = await this.exec(args, { session });
    return stdout.trim();
  }
}
