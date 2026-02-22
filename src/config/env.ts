import { z } from 'zod';

// Schema for a single Slack Events workspace
const slackWorkspaceSchema = z.object({
  name: z.string().min(1),
  endpoint: z.string().min(1),
  signingSecret: z.string().min(1),
  botToken: z.string().min(1),
  channelBlocklist: z.array(z.string()).default([]),
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

  // Bitwarden MCP
  BITWARDEN_MCP_ENABLED: z.coerce.boolean().default(false),
  BITWARDEN_MCP_ENDPOINT: z.string().default('d34d793bfe874d78a15a7f75c1aff53e'),
  BITWARDEN_MCP_INTERNAL_PORT: z.coerce.number().default(13180),
  BITWARDEN_CLIENT_ID: z.string().optional(),
  BITWARDEN_CLIENT_SECRET: z.string().optional(),
  BITWARDEN_CLIENT_PASSWD: z.string().optional(),
  BITWARDEN_ORGANIZATION_ID: z.string().optional(),
  BITWARDEN_COLLECTION_ID: z.string().optional(),
  BITWARDEN_CLI_PATH: z.string().default('bw'),
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
 *   SLACK_WORKSPACE_1_CHANNEL_BLOCKLIST=C123,C456  # Optional: comma-separated channel IDs to ignore
 *
 *   SLACK_WORKSPACE_2_NAME=acme
 *   SLACK_WORKSPACE_2_ENDPOINT=abc123...
 *   SLACK_WORKSPACE_2_SIGNING_SECRET=yyy
 *   SLACK_WORKSPACE_2_BOT_TOKEN=xoxp-yyy
 */
/**
 * Parse a comma-separated list of channel IDs into an array.
 * Example: "C123,C456,C789" -> ["C123", "C456", "C789"]
 */
function parseChannelList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((ch) => ch.trim())
    .filter((ch) => ch.length > 0);
}

function parseSlackWorkspaces(): SlackWorkspaceEnv[] {
  const workspaces: SlackWorkspaceEnv[] = [];
  let index = 1;

  while (true) {
    const prefix = `SLACK_WORKSPACE_${index}_`;
    const name = process.env[`${prefix}NAME`];
    const endpoint = process.env[`${prefix}ENDPOINT`];
    const signingSecret = process.env[`${prefix}SIGNING_SECRET`];
    const botToken = process.env[`${prefix}BOT_TOKEN`];
    const channelBlocklist = parseChannelList(process.env[`${prefix}CHANNEL_BLOCKLIST`]);

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
      channelBlocklist,
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

  // Validate Bitwarden config when enabled
  if (result.data.BITWARDEN_MCP_ENABLED) {
    const missing: string[] = [];
    if (!result.data.BITWARDEN_CLIENT_ID) missing.push('BITWARDEN_CLIENT_ID');
    if (!result.data.BITWARDEN_CLIENT_SECRET) missing.push('BITWARDEN_CLIENT_SECRET');
    if (!result.data.BITWARDEN_CLIENT_PASSWD) missing.push('BITWARDEN_CLIENT_PASSWD');
    if (!result.data.BITWARDEN_ORGANIZATION_ID) missing.push('BITWARDEN_ORGANIZATION_ID');
    if (!result.data.BITWARDEN_COLLECTION_ID) missing.push('BITWARDEN_COLLECTION_ID');

    if (missing.length > 0) {
      console.error('BITWARDEN_MCP_ENABLED is true but required variables are missing:');
      console.error(`  ${missing.join(', ')}`);
      process.exit(1);
    }
  }

  return {
    env: result.data,
    slackWorkspaces,
    slackMcpWorkspaces,
  };
}
