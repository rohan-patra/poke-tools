// Moltbook API Response Types

export interface MoltbookAgent {
  name: string;
  description?: string;
  karma?: number;
  follower_count?: number;
  following_count?: number;
  is_claimed?: boolean;
  is_active?: boolean;
  created_at?: string;
  last_active?: string;
  avatar_url?: string;
  owner?: {
    x_handle?: string;
    x_name?: string;
    x_avatar?: string;
    x_bio?: string;
    x_follower_count?: number;
    x_following_count?: number;
    x_verified?: boolean;
  };
}

export interface MoltbookSubmolt {
  name: string;
  display_name: string;
  description?: string;
  subscriber_count?: number;
  post_count?: number;
  created_at?: string;
  avatar_url?: string;
  banner_url?: string;
  banner_color?: string;
  theme_color?: string;
  your_role?: 'owner' | 'moderator' | null;
}

export interface MoltbookPost {
  id: string;
  title: string;
  content?: string;
  url?: string;
  upvotes: number;
  downvotes: number;
  comment_count: number;
  created_at: string;
  updated_at?: string;
  is_pinned?: boolean;
  author: {
    name: string;
    avatar_url?: string;
  };
  submolt: {
    name: string;
    display_name: string;
  };
}

export interface MoltbookComment {
  id: string;
  content: string;
  upvotes: number;
  downvotes: number;
  created_at: string;
  parent_id?: string;
  author: {
    name: string;
    avatar_url?: string;
  };
  post_id: string;
}

export interface MoltbookSearchResult {
  id: string;
  type: 'post' | 'comment';
  title?: string;
  content: string;
  upvotes: number;
  downvotes: number;
  created_at: string;
  similarity: number;
  author: {
    name: string;
  };
  submolt?: {
    name: string;
    display_name: string;
  };
  post?: {
    id: string;
    title: string;
  };
  post_id: string;
}

// API Response wrappers
export interface MoltbookApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  hint?: string;
}

export interface MoltbookFeedResponse {
  success: boolean;
  posts: MoltbookPost[];
  cursor?: string;
}

export interface MoltbookPostResponse {
  success: boolean;
  post: MoltbookPost;
}

export interface MoltbookCommentsResponse {
  success: boolean;
  comments: MoltbookComment[];
}

export interface MoltbookSearchResponse {
  success: boolean;
  query: string;
  type: string;
  results: MoltbookSearchResult[];
  count: number;
}

export interface MoltbookProfileResponse {
  success: boolean;
  agent: MoltbookAgent;
  recentPosts?: MoltbookPost[];
}

export interface MoltbookSubmoltsResponse {
  success: boolean;
  submolts: MoltbookSubmolt[];
}

export interface MoltbookVoteResponse {
  success: boolean;
  message: string;
  author?: {
    name: string;
  };
  already_following?: boolean;
  suggestion?: string;
}

export interface MoltbookRegistrationResponse {
  agent: {
    api_key: string;
    claim_url: string;
    verification_code: string;
  };
  important: string;
}

export interface MoltbookStatusResponse {
  status: 'pending_claim' | 'claimed';
}

// Error types
export class MoltbookApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public hint?: string
  ) {
    super(message);
    this.name = 'MoltbookApiError';
  }
}

export class MoltbookRateLimitError extends MoltbookApiError {
  constructor(
    message: string,
    public retryAfter?: number,
    public dailyRemaining?: number
  ) {
    super(message, 429);
    this.name = 'MoltbookRateLimitError';
  }
}
