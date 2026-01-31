import { z } from 'zod';

// Schema for a single Slack Events workspace
const slackWorkspaceSchema = z.object({
  name: z.string().min(1),
  endpoint: z.string().min(1),
  signingSecret: z.string().min(1),
  botToken: z.string().min(1),
});

export type SlackWorkspaceEnv = z.infer<typeof slackWorkspaceSchema>;

// Schema for a single Moltbook workspace
const moltbookWorkspaceSchema = z.object({
  name: z.string().min(1),
  endpoint: z.string().min(1),
  apiKey: z.string().min(1),
  pollingEnabled: z.coerce.boolean().default(false),
  pollingInterval: z.coerce.number().default(300000), // 5 minutes
  feedSort: z.enum(['hot', 'new', 'top', 'rising']).default('new'),
});

export type MoltbookWorkspaceEnv = z.infer<typeof moltbookWorkspaceSchema>;

// Schema for a single Slack MCP workspace
const slackMcpWorkspaceSchema = z
  .object({
    name: z.string().min(1),
    endpoint: z.string().min(1),
    authMode: z.enum(['browser', 'oauth', 'bot']).default('browser'),
    xoxcToken: z.string().optional(),
    xoxdToken: z.string().optional(),
    xoxpToken: z.string().optional(),
    xoxbToken: z.string().optional(),
    addMessageTool: z.string().optional(),
  })
  .refine(
    (data) => {
      switch (data.authMode) {
        case 'browser':
          return !!data.xoxcToken && !!data.xoxdToken;
        case 'oauth':
          return !!data.xoxpToken;
        case 'bot':
          return !!data.xoxbToken;
      }
    },
    {
      message: 'Required tokens not provided for auth mode',
    }
  );

export type SlackMcpWorkspaceEnv = z.infer<typeof slackMcpWorkspaceSchema>;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),

  // Poke Integration
  POKE_BEARER_TOKEN: z.string().min(1),

  // Slack Events - multiple workspaces supported via SLACK_WORKSPACE_N_* pattern
  SLACK_EVENTS_ENABLED: z.coerce.boolean().default(false),

  // Slack MCP Proxy - multiple workspaces supported via SLACK_MCP_N_* pattern
  SLACK_MCP_ENABLED: z.coerce.boolean().default(false),
  SLACK_MCP_BINARY_PATH: z.string().default('slack-mcp-server'),
  SLACK_MCP_INTERNAL_PORT_START: z.coerce.number().default(13080),

  // Moltbook - multiple workspaces supported via MOLTBOOK_N_* pattern
  MOLTBOOK_ENABLED: z.coerce.boolean().default(false),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse Slack workspace configs from environment variables.
 * Looks for SLACK_WORKSPACE_N_* pattern where N is 1, 2, 3, etc.
 *
 * Example:
 *   SLACK_WORKSPACE_1_NAME=workspace1
 *   SLACK_WORKSPACE_1_ENDPOINT=workspaceendpoint1
 *   SLACK_WORKSPACE_1_SIGNING_SECRET=xxx
 *   SLACK_WORKSPACE_1_BOT_TOKEN=xoxp-xxx
 *
 *   SLACK_WORKSPACE_2_NAME=acme
 *   SLACK_WORKSPACE_2_ENDPOINT=abc123...
 *   SLACK_WORKSPACE_2_SIGNING_SECRET=yyy
 *   SLACK_WORKSPACE_2_BOT_TOKEN=xoxp-yyy
 */
function parseSlackWorkspaces(): SlackWorkspaceEnv[] {
  const workspaces: SlackWorkspaceEnv[] = [];
  let index = 1;

  while (true) {
    const prefix = `SLACK_WORKSPACE_${index}_`;
    const name = process.env[`${prefix}NAME`];
    const endpoint = process.env[`${prefix}ENDPOINT`];
    const signingSecret = process.env[`${prefix}SIGNING_SECRET`];
    const botToken = process.env[`${prefix}BOT_TOKEN`];

    // Stop if no more workspaces defined
    if (!name && !endpoint && !signingSecret && !botToken) {
      break;
    }

    // Validate this workspace
    const result = slackWorkspaceSchema.safeParse({
      name,
      endpoint,
      signingSecret,
      botToken,
    });

    if (!result.success) {
      console.error(`Invalid Slack workspace ${index} configuration:`);
      console.error(result.error.format());
      process.exit(1);
    }

    workspaces.push(result.data);
    index++;
  }

  return workspaces;
}

/**
 * Parse Slack MCP workspace configs from environment variables.
 * Looks for SLACK_MCP_N_* pattern where N is 1, 2, 3, etc.
 *
 * Example:
 *   SLACK_MCP_1_NAME=workspace1
 *   SLACK_MCP_1_ENDPOINT=mcpendpoint1
 *   SLACK_MCP_1_AUTH_MODE=browser
 *   SLACK_MCP_1_XOXC_TOKEN=xoxc-xxx
 *   SLACK_MCP_1_XOXD_TOKEN=xoxd-xxx
 *   SLACK_MCP_1_ADD_MESSAGE_TOOL=true
 *
 *   SLACK_MCP_2_NAME=acme
 *   SLACK_MCP_2_ENDPOINT=abc123...
 *   SLACK_MCP_2_AUTH_MODE=bot
 *   SLACK_MCP_2_XOXB_TOKEN=xoxb-yyy
 */
function parseSlackMcpWorkspaces(): SlackMcpWorkspaceEnv[] {
  const workspaces: SlackMcpWorkspaceEnv[] = [];
  let index = 1;

  while (true) {
    const prefix = `SLACK_MCP_${index}_`;
    const name = process.env[`${prefix}NAME`];
    const endpoint = process.env[`${prefix}ENDPOINT`];
    const authMode = process.env[`${prefix}AUTH_MODE`];
    const xoxcToken = process.env[`${prefix}XOXC_TOKEN`];
    const xoxdToken = process.env[`${prefix}XOXD_TOKEN`];
    const xoxpToken = process.env[`${prefix}XOXP_TOKEN`];
    const xoxbToken = process.env[`${prefix}XOXB_TOKEN`];
    const addMessageTool = process.env[`${prefix}ADD_MESSAGE_TOOL`];

    // Stop if no more workspaces defined
    if (!name && !endpoint) {
      break;
    }

    // Validate this workspace
    const result = slackMcpWorkspaceSchema.safeParse({
      name,
      endpoint,
      authMode,
      xoxcToken,
      xoxdToken,
      xoxpToken,
      xoxbToken,
      addMessageTool,
    });

    if (!result.success) {
      console.error(`Invalid Slack MCP workspace ${index} configuration:`);
      console.error(result.error.format());
      process.exit(1);
    }

    workspaces.push(result.data);
    index++;
  }

  return workspaces;
}

/**
 * Parse Moltbook workspace configs from environment variables.
 * Looks for MOLTBOOK_N_* pattern where N is 1, 2, 3, etc.
 *
 * Example:
 *   MOLTBOOK_1_NAME=poke-agent
 *   MOLTBOOK_1_ENDPOINT=a1b2c3d4e5f6...
 *   MOLTBOOK_1_API_KEY=moltbook_xxx
 *   MOLTBOOK_1_POLLING_ENABLED=true
 *   MOLTBOOK_1_POLLING_INTERVAL=300000
 *   MOLTBOOK_1_FEED_SORT=new
 */
function parseMoltbookWorkspaces(): MoltbookWorkspaceEnv[] {
  const workspaces: MoltbookWorkspaceEnv[] = [];
  let index = 1;

  while (true) {
    const prefix = `MOLTBOOK_${index}_`;
    const name = process.env[`${prefix}NAME`];
    const endpoint = process.env[`${prefix}ENDPOINT`];
    const apiKey = process.env[`${prefix}API_KEY`];
    const pollingEnabled = process.env[`${prefix}POLLING_ENABLED`];
    const pollingInterval = process.env[`${prefix}POLLING_INTERVAL`];
    const feedSort = process.env[`${prefix}FEED_SORT`];

    // Stop if no more workspaces defined
    if (!name && !endpoint && !apiKey) {
      break;
    }

    // Validate this workspace
    const result = moltbookWorkspaceSchema.safeParse({
      name,
      endpoint,
      apiKey,
      pollingEnabled,
      pollingInterval,
      feedSort,
    });

    if (!result.success) {
      console.error(`Invalid Moltbook workspace ${index} configuration:`);
      console.error(result.error.format());
      process.exit(1);
    }

    workspaces.push(result.data);
    index++;
  }

  return workspaces;
}

export interface LoadEnvResult {
  env: Env;
  slackWorkspaces: SlackWorkspaceEnv[];
  slackMcpWorkspaces: SlackMcpWorkspaceEnv[];
  moltbookWorkspaces: MoltbookWorkspaceEnv[];
}

export function loadEnv(): LoadEnvResult {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment variables:');
    console.error(result.error.format());
    process.exit(1);
  }

  const slackWorkspaces = parseSlackWorkspaces();
  const slackMcpWorkspaces = parseSlackMcpWorkspaces();
  const moltbookWorkspaces = parseMoltbookWorkspaces();

  // Validate that workspaces are defined if events are enabled
  if (result.data.SLACK_EVENTS_ENABLED && slackWorkspaces.length === 0) {
    console.error('SLACK_EVENTS_ENABLED is true but no workspaces defined.');
    console.error(
      'Define at least one workspace using SLACK_WORKSPACE_1_NAME, SLACK_WORKSPACE_1_ENDPOINT, etc.'
    );
    process.exit(1);
  }

  // Validate that MCP workspaces are defined if MCP is enabled
  if (result.data.SLACK_MCP_ENABLED && slackMcpWorkspaces.length === 0) {
    console.error('SLACK_MCP_ENABLED is true but no MCP workspaces defined.');
    console.error('Define at least one workspace using SLACK_MCP_1_NAME, SLACK_MCP_1_ENDPOINT, etc.');
    process.exit(1);
  }

  // Validate that Moltbook workspaces are defined if Moltbook is enabled
  if (result.data.MOLTBOOK_ENABLED && moltbookWorkspaces.length === 0) {
    console.error('MOLTBOOK_ENABLED is true but no Moltbook workspaces defined.');
    console.error('Define at least one workspace using MOLTBOOK_1_NAME, MOLTBOOK_1_ENDPOINT, etc.');
    process.exit(1);
  }

  return {
    env: result.data,
    slackWorkspaces,
    slackMcpWorkspaces,
    moltbookWorkspaces,
  };
}
