import type { MoltbookClient } from '../../../integrations/moltbook/index.js';

// MCP Tool schema type
interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const MOLTBOOK_TOOLS: McpTool[] = [
  // Feed & Posts
  {
    name: 'moltbook_get_feed',
    description: 'Get your personalized Moltbook feed (posts from subscribed submolts and followed moltys)',
    inputSchema: {
      type: 'object',
      properties: {
        sort: {
          type: 'string',
          enum: ['hot', 'new', 'top'],
          description: 'Sort order for the feed',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of posts to return (default: 25)',
        },
      },
    },
  },
  {
    name: 'moltbook_get_posts',
    description: 'Get posts from Moltbook, optionally filtered by submolt',
    inputSchema: {
      type: 'object',
      properties: {
        submolt: {
          type: 'string',
          description: 'Filter posts to a specific submolt (e.g., "general")',
        },
        sort: {
          type: 'string',
          enum: ['hot', 'new', 'top', 'rising'],
          description: 'Sort order for posts',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of posts to return (default: 25)',
        },
      },
    },
  },
  {
    name: 'moltbook_get_post',
    description: 'Get a single post by ID with its details',
    inputSchema: {
      type: 'object',
      properties: {
        post_id: {
          type: 'string',
          description: 'The ID of the post to retrieve',
        },
      },
      required: ['post_id'],
    },
  },
  {
    name: 'moltbook_create_post',
    description: 'Create a new post on Moltbook. Can be a text post or a link post.',
    inputSchema: {
      type: 'object',
      properties: {
        submolt: {
          type: 'string',
          description: 'The submolt to post to (e.g., "general")',
        },
        title: {
          type: 'string',
          description: 'The title of the post',
        },
        content: {
          type: 'string',
          description: 'The text content of the post (for text posts)',
        },
        url: {
          type: 'string',
          description: 'URL to share (for link posts)',
        },
      },
      required: ['submolt', 'title'],
    },
  },
  {
    name: 'moltbook_delete_post',
    description: 'Delete one of your own posts',
    inputSchema: {
      type: 'object',
      properties: {
        post_id: {
          type: 'string',
          description: 'The ID of the post to delete',
        },
      },
      required: ['post_id'],
    },
  },

  // Comments
  {
    name: 'moltbook_get_comments',
    description: 'Get comments on a post',
    inputSchema: {
      type: 'object',
      properties: {
        post_id: {
          type: 'string',
          description: 'The ID of the post',
        },
        sort: {
          type: 'string',
          enum: ['top', 'new', 'controversial'],
          description: 'Sort order for comments',
        },
      },
      required: ['post_id'],
    },
  },
  {
    name: 'moltbook_create_comment',
    description: 'Add a comment to a post or reply to another comment',
    inputSchema: {
      type: 'object',
      properties: {
        post_id: {
          type: 'string',
          description: 'The ID of the post to comment on',
        },
        content: {
          type: 'string',
          description: 'The comment text',
        },
        parent_id: {
          type: 'string',
          description: 'Optional: ID of the comment to reply to',
        },
      },
      required: ['post_id', 'content'],
    },
  },

  // Voting
  {
    name: 'moltbook_upvote_post',
    description: 'Upvote a post',
    inputSchema: {
      type: 'object',
      properties: {
        post_id: {
          type: 'string',
          description: 'The ID of the post to upvote',
        },
      },
      required: ['post_id'],
    },
  },
  {
    name: 'moltbook_downvote_post',
    description: 'Downvote a post',
    inputSchema: {
      type: 'object',
      properties: {
        post_id: {
          type: 'string',
          description: 'The ID of the post to downvote',
        },
      },
      required: ['post_id'],
    },
  },
  {
    name: 'moltbook_upvote_comment',
    description: 'Upvote a comment',
    inputSchema: {
      type: 'object',
      properties: {
        comment_id: {
          type: 'string',
          description: 'The ID of the comment to upvote',
        },
      },
      required: ['comment_id'],
    },
  },

  // Search
  {
    name: 'moltbook_search',
    description: 'Search Moltbook using semantic search. Understands meaning, not just keywords.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language search query (e.g., "how do agents handle memory")',
        },
        type: {
          type: 'string',
          enum: ['posts', 'comments', 'all'],
          description: 'What to search: posts, comments, or all (default: all)',
        },
        limit: {
          type: 'number',
          description: 'Maximum results (default: 20, max: 50)',
        },
      },
      required: ['query'],
    },
  },

  // Social - Following
  {
    name: 'moltbook_follow',
    description:
      'Follow another molty (agent). Be selective - only follow moltys whose posts you consistently enjoy.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_name: {
          type: 'string',
          description: 'The name of the molty to follow',
        },
      },
      required: ['agent_name'],
    },
  },
  {
    name: 'moltbook_unfollow',
    description: 'Unfollow a molty',
    inputSchema: {
      type: 'object',
      properties: {
        agent_name: {
          type: 'string',
          description: 'The name of the molty to unfollow',
        },
      },
      required: ['agent_name'],
    },
  },

  // Social - Submolts
  {
    name: 'moltbook_subscribe',
    description: 'Subscribe to a submolt (community)',
    inputSchema: {
      type: 'object',
      properties: {
        submolt_name: {
          type: 'string',
          description: 'The name of the submolt to subscribe to',
        },
      },
      required: ['submolt_name'],
    },
  },
  {
    name: 'moltbook_unsubscribe',
    description: 'Unsubscribe from a submolt',
    inputSchema: {
      type: 'object',
      properties: {
        submolt_name: {
          type: 'string',
          description: 'The name of the submolt to unsubscribe from',
        },
      },
      required: ['submolt_name'],
    },
  },
  {
    name: 'moltbook_list_submolts',
    description: 'List all available submolts (communities)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'moltbook_get_submolt',
    description: 'Get details about a specific submolt',
    inputSchema: {
      type: 'object',
      properties: {
        submolt_name: {
          type: 'string',
          description: 'The name of the submolt',
        },
      },
      required: ['submolt_name'],
    },
  },

  // Profile
  {
    name: 'moltbook_get_profile',
    description: 'Get your own Moltbook profile',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'moltbook_get_agent_profile',
    description: "Get another molty's profile",
    inputSchema: {
      type: 'object',
      properties: {
        agent_name: {
          type: 'string',
          description: 'The name of the molty',
        },
      },
      required: ['agent_name'],
    },
  },
];

// Tool execution
export async function executeToolCall(
  client: MoltbookClient,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    // Feed & Posts
    case 'moltbook_get_feed':
      return client.getFeed(
        args['sort'] as 'hot' | 'new' | 'top' | undefined,
        args['limit'] as number | undefined
      );

    case 'moltbook_get_posts':
      return client.getPosts({
        submolt: args['submolt'] as string | undefined,
        sort: args['sort'] as 'hot' | 'new' | 'top' | 'rising' | undefined,
        limit: args['limit'] as number | undefined,
      });

    case 'moltbook_get_post':
      return client.getPost(args['post_id'] as string);

    case 'moltbook_create_post':
      return client.createPost(args['submolt'] as string, args['title'] as string, {
        content: args['content'] as string | undefined,
        url: args['url'] as string | undefined,
      });

    case 'moltbook_delete_post':
      await client.deletePost(args['post_id'] as string);
      return { success: true, message: 'Post deleted' };

    // Comments
    case 'moltbook_get_comments':
      return client.getComments(
        args['post_id'] as string,
        args['sort'] as 'top' | 'new' | 'controversial' | undefined
      );

    case 'moltbook_create_comment':
      return client.createComment(
        args['post_id'] as string,
        args['content'] as string,
        args['parent_id'] as string | undefined
      );

    // Voting
    case 'moltbook_upvote_post':
      return client.upvotePost(args['post_id'] as string);

    case 'moltbook_downvote_post':
      return client.downvotePost(args['post_id'] as string);

    case 'moltbook_upvote_comment':
      return client.upvoteComment(args['comment_id'] as string);

    // Search
    case 'moltbook_search':
      return client.search(args['query'] as string, {
        type: args['type'] as 'posts' | 'comments' | 'all' | undefined,
        limit: args['limit'] as number | undefined,
      });

    // Social - Following
    case 'moltbook_follow':
      await client.followAgent(args['agent_name'] as string);
      return { success: true, message: `Now following ${args['agent_name']}` };

    case 'moltbook_unfollow':
      await client.unfollowAgent(args['agent_name'] as string);
      return { success: true, message: `Unfollowed ${args['agent_name']}` };

    // Social - Submolts
    case 'moltbook_subscribe':
      await client.subscribeSubmolt(args['submolt_name'] as string);
      return { success: true, message: `Subscribed to m/${args['submolt_name']}` };

    case 'moltbook_unsubscribe':
      await client.unsubscribeSubmolt(args['submolt_name'] as string);
      return { success: true, message: `Unsubscribed from m/${args['submolt_name']}` };

    case 'moltbook_list_submolts':
      return client.listSubmolts();

    case 'moltbook_get_submolt':
      return client.getSubmolt(args['submolt_name'] as string);

    // Profile
    case 'moltbook_get_profile':
      return client.getProfile();

    case 'moltbook_get_agent_profile':
      return client.getAgentProfile(args['agent_name'] as string);

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
