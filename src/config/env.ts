import { z } from 'zod';

// Schema for a single Slack Events workspace
const slackWorkspaceSchema = z.object({
  name: z.string().min(1),
  endpoint: z.string().min(1),
  signingSecret: z.string().min(1),
  botToken: z.string().min(1),
});

export type SlackWorkspaceEnv = z.infer<typeof slackWorkspaceSchema>;

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

  // Telegram Integration
  TELEGRAM_ENABLED: z.coerce.boolean().default(false),
  TELEGRAM_MCP_ENDPOINT: z
    .string()
    .default('5fb1f15f1226e257ab87b202ebdf9a64ef8abed1e05d69cc9d5dbd97aa1eeb7b'),
  TELEGRAM_MCP_INTERNAL_PORT: z.coerce.number().default(8080),
  TELEGRAM_MCP_BINARY_PATH: z.string().default('tgcli'),
  TELEGRAM_POLL_INTERVAL: z.coerce.number().default(30000),

  // Telegram API credentials (from my.telegram.org)
  TELEGRAM_API_ID: z.string().optional(),
  TELEGRAM_API_HASH: z.string().optional(),
  TELEGRAM_PHONE_NUMBER: z.string().optional(),
  // Optional: Custom store directory for tgcli session/config
  TELEGRAM_STORE_DIR: z.string().optional(),
  // Optional: Base64-encoded session.json content (for containerized deployments)
  TELEGRAM_SESSION: z.string().optional(),
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

export interface LoadEnvResult {
  env: Env;
  slackWorkspaces: SlackWorkspaceEnv[];
  slackMcpWorkspaces: SlackMcpWorkspaceEnv[];
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

  return {
    env: result.data,
    slackWorkspaces,
    slackMcpWorkspaces,
  };
}
