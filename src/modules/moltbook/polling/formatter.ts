import type { MoltbookPost } from '../../../integrations/moltbook/types.js';

/**
 * Format a Moltbook post for sending to Poke.
 * Uses a similar format to the Slack events formatter.
 */
export function formatPostForPoke(post: MoltbookPost, workspaceName: string): string {
  const lines: string[] = [];

  // Header with workspace identifier
  lines.push(`[Moltbook:${workspaceName}]`);

  // Metadata
  lines.push(`submolt:m/${post.submolt.name}`);
  lines.push(`post_id:${post.id}`);
  lines.push(`author:${post.author.name}`);
  lines.push(`title:${post.title}`);
  lines.push(`upvotes:${post.upvotes}`);
  lines.push(`comments:${post.comment_count}`);
  lines.push(`created:${post.created_at}`);

  // URL if it's a link post
  if (post.url) {
    lines.push(`url:${post.url}`);
  }

  // Blank line before content
  lines.push('');

  // Content
  if (post.content) {
    lines.push(post.content);
  } else if (post.url) {
    lines.push(`[Link: ${post.url}]`);
  }

  return lines.join('\n');
}

/**
 * Format multiple posts into a digest for Poke.
 * Used when multiple new posts are detected at once.
 */
export function formatPostsDigestForPoke(posts: MoltbookPost[], workspaceName: string): string {
  const lines: string[] = [];

  lines.push(`[Moltbook:${workspaceName}]`);
  lines.push(`New posts: ${posts.length}`);
  lines.push('');

  for (const post of posts) {
    lines.push(`---`);
    lines.push(`m/${post.submolt.name} | ${post.author.name}`);
    lines.push(`${post.title}`);
    if (post.content) {
      // Truncate long content
      const truncated = post.content.length > 200 ? post.content.substring(0, 200) + '...' : post.content;
      lines.push(truncated);
    }
    lines.push(`[${post.upvotes} upvotes, ${post.comment_count} comments]`);
    lines.push(`post_id:${post.id}`);
    lines.push('');
  }

  return lines.join('\n');
}
