import { SlackApiError } from '../../core/errors.js';
import type { Logger } from '../../core/logger.js';

export interface SlackClientConfig {
  botToken: string;
}

export interface SlackUserInfo {
  id: string;
  name: string;
  realName?: string;
  displayName?: string;
}

export interface SlackChannelInfo {
  id: string;
  name: string;
  isPrivate: boolean;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const SLACK_API_BASE = 'https://slack.com/api';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class SlackClient {
  private botToken: string;
  private cache = new Map<string, CacheEntry<unknown>>();

  constructor(
    config: SlackClientConfig,
    private logger: Logger
  ) {
    this.botToken = config.botToken;
  }

  async getUserInfo(userId: string): Promise<SlackUserInfo | null> {
    const cacheKey = `user:${userId}`;
    const cached = this.getFromCache<SlackUserInfo>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`${SLACK_API_BASE}/users.info?user=${userId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.botToken}`,
        },
      });

      if (!response.ok) {
        throw new SlackApiError(`Failed to fetch user info: ${response.statusText}`, response.status);
      }

      const data = (await response.json()) as {
        ok: boolean;
        error?: string;
        user?: {
          id: string;
          name: string;
          real_name?: string;
          profile?: {
            display_name?: string;
            display_name_normalized?: string;
            real_name?: string;
            real_name_normalized?: string;
          };
        };
      };

      if (!data.ok || !data.user) {
        this.logger.warn({ userId, error: data.error }, 'Slack API returned error for user info');
        return null;
      }

      const userInfo: SlackUserInfo = {
        id: data.user.id,
        name: data.user.name,
        realName: data.user.real_name || data.user.profile?.real_name,
        displayName: data.user.profile?.display_name,
      };

      this.setInCache(cacheKey, userInfo);
      return userInfo;
    } catch (error) {
      this.logger.warn({ err: error, userId }, 'Failed to fetch Slack user info');
      return null;
    }
  }

  async getChannelInfo(channelId: string): Promise<SlackChannelInfo | null> {
    const cacheKey = `channel:${channelId}`;
    const cached = this.getFromCache<SlackChannelInfo>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`${SLACK_API_BASE}/conversations.info?channel=${channelId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.botToken}`,
        },
      });

      if (!response.ok) {
        throw new SlackApiError(`Failed to fetch channel info: ${response.statusText}`, response.status);
      }

      const data = (await response.json()) as {
        ok: boolean;
        error?: string;
        channel?: {
          id: string;
          name: string;
          is_private: boolean;
        };
      };

      if (!data.ok || !data.channel) {
        this.logger.warn({ channelId, error: data.error }, 'Slack API returned error for channel info');
        return null;
      }

      const channelInfo: SlackChannelInfo = {
        id: data.channel.id,
        name: data.channel.name,
        isPrivate: data.channel.is_private,
      };

      this.setInCache(cacheKey, channelInfo);
      return channelInfo;
    } catch (error) {
      this.logger.warn({ err: error, channelId }, 'Failed to fetch Slack channel info');
      return null;
    }
  }

  async getMessagePermalink(channelId: string, messageTs: string): Promise<string | null> {
    try {
      const params = new URLSearchParams({
        channel: channelId,
        message_ts: messageTs,
      });

      const response = await fetch(`${SLACK_API_BASE}/chat.getPermalink?${params}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.botToken}`,
        },
      });

      if (!response.ok) {
        throw new SlackApiError(`Failed to fetch message permalink: ${response.statusText}`, response.status);
      }

      const data = (await response.json()) as {
        ok: boolean;
        error?: string;
        permalink?: string;
      };

      if (!data.ok || !data.permalink) {
        this.logger.warn(
          { channelId, messageTs, error: data.error },
          'Slack API returned error for message permalink'
        );
        return null;
      }

      return data.permalink;
    } catch (error) {
      this.logger.warn({ err: error, channelId, messageTs }, 'Failed to fetch Slack message permalink');
      return null;
    }
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setInCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }
}
