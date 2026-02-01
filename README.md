# poke-tools

A Node.js server that integrates external platforms with [Poke](https://poke.com), an AI agent platform. Provides webhook handlers and MCP (Model Context Protocol) proxies for Slack.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/rohan-patra/poke-tools)

## Features

- **Slack Integration**
  - Webhook handler for Slack events with signature verification
  - MCP proxy to expose Slack capabilities to AI agents
  - Multi-workspace support

- **Infrastructure**
  - Health check endpoint with module status aggregation
  - Graceful shutdown handling
  - Structured logging with PII redaction
  - Docker support

## Requirements

- Node.js ≥22.0.0
- pnpm 9.15.0+

## Installation

```bash
# Clone the repository
git clone https://github.com/rohan-patra/poke-tools.git
cd poke-tools

# Install dependencies
pnpm install

# Copy environment file and configure
cp .env.example .env
```

## Configuration

Configuration is done via environment variables. See `.env.example` for all available options.

### Server

| Variable            | Description                                | Default       |
| ------------------- | ------------------------------------------ | ------------- |
| `PORT`              | Server port                                | `3000`        |
| `NODE_ENV`          | Environment (`development` / `production`) | `development` |
| `POKE_BEARER_TOKEN` | Bearer token for Poke API                  | Required      |

### Slack Events

Enable webhook handling for Slack events. Supports multiple workspaces.

| Variable                           | Description                                  |
| ---------------------------------- | -------------------------------------------- |
| `SLACK_EVENTS_ENABLED`             | Enable/disable Slack events (`true`/`false`) |
| `SLACK_WORKSPACE_N_NAME`           | Workspace name                               |
| `SLACK_WORKSPACE_N_ENDPOINT`       | Webhook endpoint path                        |
| `SLACK_WORKSPACE_N_SIGNING_SECRET` | Slack signing secret for verification        |
| `SLACK_WORKSPACE_N_BOT_TOKEN`      | Slack bot/user token                         |

### Slack MCP Proxy

Enable MCP proxy for Slack, powered by [slack-mcp-server](https://github.com/korotovsky/slack-mcp-server).

| Variable                       | Description                                                            |
| ------------------------------ | ---------------------------------------------------------------------- |
| `SLACK_MCP_ENABLED`            | Enable/disable Slack MCP (`true`/`false`)                              |
| `SLACK_MCP_N_NAME`             | Workspace name                                                         |
| `SLACK_MCP_N_ENDPOINT`         | MCP endpoint path                                                      |
| `SLACK_MCP_N_AUTH_MODE`        | Auth mode: `browser`, `oauth`, or `bot`                                |
| `SLACK_MCP_N_ADD_MESSAGE_TOOL` | Enable message sending (`true`, channel IDs, or `!channel` to exclude) |

**Auth modes:**

- `browser` - Requires `XOXC_TOKEN` and `XOXD_TOKEN` (full access)
- `oauth` - Requires `XOXP_TOKEN` (user token from OAuth)
- `bot` - Requires `XOXB_TOKEN` (limited: no search, invited channels only)

## Usage

### Development

```bash
pnpm dev
```

### Production

```bash
pnpm build
pnpm start
```

### Docker

```bash
docker build -t poke-tools .
docker run -p 3000:3000 --env-file .env poke-tools
```

## API Endpoints

| Endpoint              | Method | Description                     |
| --------------------- | ------ | ------------------------------- |
| `/health`             | GET    | Health check with module status |
| `/webhooks/:endpoint` | POST   | Webhook receiver (Slack events) |
| `/mcp/:endpoint`      | \*     | MCP protocol handlers           |

## Scripts

| Script              | Description                              |
| ------------------- | ---------------------------------------- |
| `pnpm dev`          | Start development server with hot reload |
| `pnpm build`        | Compile TypeScript to `dist/`            |
| `pnpm start`        | Run production server                    |
| `pnpm typecheck`    | Type check without emitting              |
| `pnpm format`       | Format code with Prettier                |
| `pnpm format:check` | Check code formatting                    |

## Project Structure

```
src/
├── index.ts              # Entry point - Fastify server setup
├── config/               # Environment parsing and validation
├── core/                 # Shared types, logger, errors
├── integrations/         # External API clients (Poke)
├── modules/              # Feature modules
│   └── slack/
│       ├── events/       # Slack webhook handler
│       └── mcp-proxy/    # Slack MCP proxy
├── routers/              # HTTP route registration
└── servers/              # Subprocess managers
```

## License

MIT
