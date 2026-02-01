import { loadEnv, type SlackWorkspaceEnv, type SlackMcpWorkspaceEnv } from './env.js';

export interface SlackWorkspaceConfig {
  name: string;
  endpoint: string;
  signingSecret: string;
  botToken: string;
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

export interface TelegramConfig {
  enabled: boolean;
  mcp: {
    endpoint: string;
    internalPort: number;
    binaryPath: string;
  };
  polling: {
    interval: number;
  };
  credentials: {
    apiId?: string;
    apiHash?: string;
    phoneNumber?: string;
  };
  storeDir?: string;
  session?: string; // Base64-encoded session.json content
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

  telegram: TelegramConfig;
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

    telegram: {
      enabled: env.TELEGRAM_ENABLED,
      mcp: {
        endpoint: env.TELEGRAM_MCP_ENDPOINT,
        internalPort: env.TELEGRAM_MCP_INTERNAL_PORT,
        binaryPath: env.TELEGRAM_MCP_BINARY_PATH,
      },
      polling: {
        interval: env.TELEGRAM_POLL_INTERVAL,
      },
      credentials: {
        apiId: env.TELEGRAM_API_ID,
        apiHash: env.TELEGRAM_API_HASH,
        phoneNumber: env.TELEGRAM_PHONE_NUMBER,
      },
      storeDir: env.TELEGRAM_STORE_DIR,
      session: env.TELEGRAM_SESSION,
    },
  };
}

export type { SlackWorkspaceEnv, SlackMcpWorkspaceEnv };
