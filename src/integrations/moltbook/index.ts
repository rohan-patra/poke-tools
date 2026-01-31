import type { Logger } from '../../core/logger.js';
import {
  MoltbookApiError,
  MoltbookRateLimitError,
  type MoltbookPost,
  type MoltbookComment,
  type MoltbookAgent,
  type MoltbookSubmolt,
  type MoltbookSearchResult,
  type MoltbookFeedResponse,
  type MoltbookPostResponse,
  type MoltbookCommentsResponse,
  type MoltbookSearchResponse,
  type MoltbookProfileResponse,
  type MoltbookSubmoltsResponse,
  type MoltbookVoteResponse,
  type MoltbookStatusResponse,
} from './types.js';

const MOLTBOOK_API_BASE = 'https://www.moltbook.com/api/v1';

export class MoltbookClient {
  constructor(
    private apiKey: string,
    private logger: Logger
  ) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${MOLTBOOK_API_BASE}${path}`;

    this.logger.debug({ method, path }, 'Moltbook API request');

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    // Handle rate limiting
    if (response.status === 429) {
      const data = (await response.json()) as {
        error?: string;
        retry_after_minutes?: number;
        retry_after_seconds?: number;
        daily_remaining?: number;
      };
      const retryAfter = data.retry_after_minutes ?? data.retry_after_seconds;
      throw new MoltbookRateLimitError(data.error || 'Rate limit exceeded', retryAfter, data.daily_remaining);
    }

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        hint?: string;
      };
      throw new MoltbookApiError(data.error || `HTTP ${response.status}`, response.status, data.hint);
    }

    return response.json() as Promise<T>;
  }

  // ============ Feed & Posts ============

  async getFeed(sort: 'hot' | 'new' | 'top' = 'new', limit = 25): Promise<MoltbookPost[]> {
    const response = await this.request<MoltbookFeedResponse>('GET', `/feed?sort=${sort}&limit=${limit}`);
    return response.posts;
  }

  async getPosts(
    options: {
      sort?: 'hot' | 'new' | 'top' | 'rising';
      limit?: number;
      submolt?: string;
    } = {}
  ): Promise<MoltbookPost[]> {
    const params = new URLSearchParams();
    if (options.sort) params.set('sort', options.sort);
    if (options.limit) params.set('limit', String(options.limit));
    if (options.submolt) params.set('submolt', options.submolt);

    const response = await this.request<MoltbookFeedResponse>('GET', `/posts?${params.toString()}`);
    return response.posts;
  }

  async getPost(postId: string): Promise<MoltbookPost> {
    const response = await this.request<MoltbookPostResponse>('GET', `/posts/${postId}`);
    return response.post;
  }

  async createPost(
    submolt: string,
    title: string,
    options: { content?: string; url?: string } = {}
  ): Promise<MoltbookPost> {
    const response = await this.request<MoltbookPostResponse>('POST', '/posts', {
      submolt,
      title,
      ...options,
    });
    return response.post;
  }

  async deletePost(postId: string): Promise<void> {
    await this.request<{ success: boolean }>('DELETE', `/posts/${postId}`);
  }

  // ============ Comments ============

  async getComments(
    postId: string,
    sort: 'top' | 'new' | 'controversial' = 'top'
  ): Promise<MoltbookComment[]> {
    const response = await this.request<MoltbookCommentsResponse>(
      'GET',
      `/posts/${postId}/comments?sort=${sort}`
    );
    return response.comments;
  }

  async createComment(postId: string, content: string, parentId?: string): Promise<MoltbookComment> {
    const body: { content: string; parent_id?: string } = { content };
    if (parentId) body.parent_id = parentId;

    const response = await this.request<{ success: boolean; comment: MoltbookComment }>(
      'POST',
      `/posts/${postId}/comments`,
      body
    );
    return response.comment;
  }

  // ============ Voting ============

  async upvotePost(postId: string): Promise<MoltbookVoteResponse> {
    return this.request<MoltbookVoteResponse>('POST', `/posts/${postId}/upvote`);
  }

  async downvotePost(postId: string): Promise<MoltbookVoteResponse> {
    return this.request<MoltbookVoteResponse>('POST', `/posts/${postId}/downvote`);
  }

  async upvoteComment(commentId: string): Promise<MoltbookVoteResponse> {
    return this.request<MoltbookVoteResponse>('POST', `/comments/${commentId}/upvote`);
  }

  // ============ Social ============

  async followAgent(agentName: string): Promise<void> {
    await this.request<{ success: boolean }>('POST', `/agents/${agentName}/follow`);
  }

  async unfollowAgent(agentName: string): Promise<void> {
    await this.request<{ success: boolean }>('DELETE', `/agents/${agentName}/follow`);
  }

  async subscribeSubmolt(submoltName: string): Promise<void> {
    await this.request<{ success: boolean }>('POST', `/submolts/${submoltName}/subscribe`);
  }

  async unsubscribeSubmolt(submoltName: string): Promise<void> {
    await this.request<{ success: boolean }>('DELETE', `/submolts/${submoltName}/subscribe`);
  }

  // ============ Search ============

  async search(
    query: string,
    options: { type?: 'posts' | 'comments' | 'all'; limit?: number } = {}
  ): Promise<MoltbookSearchResult[]> {
    const params = new URLSearchParams();
    params.set('q', query);
    if (options.type) params.set('type', options.type);
    if (options.limit) params.set('limit', String(options.limit));

    const response = await this.request<MoltbookSearchResponse>('GET', `/search?${params.toString()}`);
    return response.results;
  }

  // ============ Profile ============

  async getProfile(): Promise<MoltbookAgent> {
    const response = await this.request<MoltbookProfileResponse>('GET', '/agents/me');
    return response.agent;
  }

  async getAgentProfile(name: string): Promise<MoltbookProfileResponse> {
    return this.request<MoltbookProfileResponse>('GET', `/agents/profile?name=${encodeURIComponent(name)}`);
  }

  async getStatus(): Promise<MoltbookStatusResponse> {
    return this.request<MoltbookStatusResponse>('GET', '/agents/status');
  }

  // ============ Submolts ============

  async listSubmolts(): Promise<MoltbookSubmolt[]> {
    const response = await this.request<MoltbookSubmoltsResponse>('GET', '/submolts');
    return response.submolts;
  }

  async getSubmolt(name: string): Promise<MoltbookSubmolt> {
    const response = await this.request<{ success: boolean; submolt: MoltbookSubmolt }>(
      'GET',
      `/submolts/${name}`
    );
    return response.submolt;
  }

  async getSubmoltFeed(
    submoltName: string,
    sort: 'hot' | 'new' | 'top' | 'rising' = 'new',
    limit = 25
  ): Promise<MoltbookPost[]> {
    const response = await this.request<MoltbookFeedResponse>(
      'GET',
      `/submolts/${submoltName}/feed?sort=${sort}&limit=${limit}`
    );
    return response.posts;
  }
}

// Re-export types
export * from './types.js';
