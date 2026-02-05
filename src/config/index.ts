import { loadEnv, type SlackMcpWorkspaceEnv, type SlackWorkspaceEnv } from './env.js';

export interface SlackWorkspaceConfig {
  name: string;
  endpoint: string;
  signingSecret: string;
  botToken: string;
  channelBlocklist: string[];
}

export interface SlackMcpWorkspaceConfig {
  name: string;
  endpoint: string;
  authMode: 'browser' | 'oauth' | 'bot';
  internalPort: number;
  tokens: {
    xoxc?: string;
    xoxd?: string;
    xoxp?: string;
    xoxb?: string;
  };
  addMessageTool?: string;
}

export interface AppConfig {
  env: 'development' | 'staging' | 'production';
  port: number;

  poke: {
    bearerToken: string;
    apiBaseUrl: string;
    webhookEndpoint: string;
  };

  slack: {
    events: {
      enabled: boolean;
      workspaces: SlackWorkspaceConfig[];
    };
    mcp: {
      enabled: boolean;
      binaryPath: string;
      workspaces: SlackMcpWorkspaceConfig[];
    };
  };
}

export function loadConfig(): AppConfig {
  const { env, slackWorkspaces, slackMcpWorkspaces } = loadEnv();

  return {
    env: env.NODE_ENV,
    port: env.PORT,

    poke: {
      bearerToken: env.POKE_BEARER_TOKEN,
      apiBaseUrl: 'https://poke.com/api/v1',
      webhookEndpoint: '/inbound-sms/webhook',
    },

    slack: {
      events: {
        enabled: env.SLACK_EVENTS_ENABLED,
        workspaces: slackWorkspaces.map((ws: SlackWorkspaceEnv) => ({
          name: ws.name,
          endpoint: ws.endpoint,
          signingSecret: ws.signingSecret,
          botToken: ws.botToken,
          channelBlocklist: ws.channelBlocklist,
        })),
      },
      mcp: {
        enabled: env.SLACK_MCP_ENABLED,
        binaryPath: env.SLACK_MCP_BINARY_PATH,
        workspaces: slackMcpWorkspaces.map(
          (ws: SlackMcpWorkspaceEnv, index: number): SlackMcpWorkspaceConfig => ({
            name: ws.name,
            endpoint: ws.endpoint,
            authMode: ws.authMode,
            internalPort: env.SLACK_MCP_INTERNAL_PORT_START + index,
            tokens: {
              xoxc: ws.xoxcToken,
              xoxd: ws.xoxdToken,
              xoxp: ws.xoxpToken,
              xoxb: ws.xoxbToken,
            },
            addMessageTool: ws.addMessageTool,
          })
        ),
      },
    },
  };
}

export type { SlackWorkspaceEnv, SlackMcpWorkspaceEnv };
