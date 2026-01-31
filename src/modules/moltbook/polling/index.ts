import type { Logger } from '../../../core/logger.js';
import type { PollerConfig } from '../../../core/types.js';
import type { MoltbookWorkspaceConfig } from '../../../config/index.js';
import type { MoltbookClient } from '../../../integrations/moltbook/index.js';
import type { PokeClient } from '../../../integrations/poke/index.js';
import { formatPostForPoke } from './formatter.js';

const MAX_SEEN_IDS = 1000;
const TRIM_TO_IDS = 500;

export class MoltbookPollingHandler {
  private seenPostIds = new Set<string>();
  private isFirstPoll = true;

  constructor(
    private config: MoltbookWorkspaceConfig,
    private client: MoltbookClient,
    private pokeClient: PokeClient,
    private logger: Logger
  ) {}

  async poll(): Promise<void> {
    this.logger.debug('Polling Moltbook feed');

    try {
      // getFeed only supports hot/new/top, so map rising to new
      const feedSort = this.config.feedSort === 'rising' ? 'new' : this.config.feedSort;
      const posts = await this.client.getFeed(feedSort, 25);

      if (this.isFirstPoll) {
        // On first poll, just populate seen IDs without forwarding
        // This prevents flooding Poke with old posts on startup
        for (const post of posts) {
          this.seenPostIds.add(post.id);
        }
        this.logger.info({ count: posts.length }, 'First poll complete, initialized seen posts');
        this.isFirstPoll = false;
        return;
      }

      // Process new posts (in reverse order so oldest comes first)
      const newPosts = posts.filter((post) => !this.seenPostIds.has(post.id)).reverse();

      if (newPosts.length > 0) {
        this.logger.info({ count: newPosts.length }, 'New posts detected');

        for (const post of newPosts) {
          try {
            const message = formatPostForPoke(post, this.config.name);
            await this.pokeClient.sendInboundMessage(message);
            this.seenPostIds.add(post.id);

            this.logger.debug(
              { postId: post.id, author: post.author.name, title: post.title },
              'Forwarded post to Poke'
            );
          } catch (error) {
            this.logger.error({ err: error, postId: post.id }, 'Failed to forward post to Poke');
            // Don't add to seen IDs so we retry next poll
          }
        }
      } else {
        this.logger.debug('No new posts');
      }

      // Trim seen IDs to prevent memory growth
      this.trimSeenIds();
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to poll Moltbook feed');
      throw error;
    }
  }

  private trimSeenIds(): void {
    if (this.seenPostIds.size > MAX_SEEN_IDS) {
      const idsArray = Array.from(this.seenPostIds);
      this.seenPostIds = new Set(idsArray.slice(-TRIM_TO_IDS));
      this.logger.debug({ from: idsArray.length, to: this.seenPostIds.size }, 'Trimmed seen post IDs');
    }
  }

  getPollerConfig(): PollerConfig {
    return {
      name: `moltbook-${this.config.name}`,
      interval: this.config.pollingInterval,
      immediate: true,
      handler: () => this.poll(),
      onError: (error) => {
        this.logger.error({ err: error }, 'Moltbook polling error');
      },
    };
  }
}
