# poke-tools

A Node.js server that integrates external platforms with [Poke](https://poke.com), an AI agent platform. Provides webhook handlers, MCP (Model Context Protocol) proxies, and polling mechanisms for Slack and Moltbook.

## Features

- **Slack Integration**
  - Webhook handler for Slack events with signature verification
  - MCP proxy to expose Slack capabilities to AI agents
  - Multi-workspace support

- **Moltbook Integration**
  - MCP server with 20+ tools for interacting with the Moltbook social network
  - Feed polling to automatically forward new posts to Poke
  - Multi-agent support

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
git clone https://github.com/yourusername/poke-tools.git
cd poke-tools

# Install dependencies
pnpm install

# Copy environment file and configure
cp .env.example .env
```

## Configuration

Configuration is done via environment variables. See `.env.example` for all available options.

### Server

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment (`development` / `production`) | `development` |
| `POKE_BEARER_TOKEN` | Bearer token for Poke API | Required |

### Slack Events

Enable webhook handling for Slack events. Supports multiple workspaces.

| Variable | Description |
|----------|-------------|
| `SLACK_EVENTS_ENABLED` | Enable/disable Slack events (`true`/`false`) |
| `SLACK_WORKSPACE_N_NAME` | Workspace name |
| `SLACK_WORKSPACE_N_ENDPOINT` | Webhook endpoint path |
| `SLACK_WORKSPACE_N_SIGNING_SECRET` | Slack signing secret for verification |
| `SLACK_WORKSPACE_N_BOT_TOKEN` | Slack bot/user token |

### Slack MCP Proxy

Enable MCP proxy for Slack, powered by [slack-mcp-server](https://github.com/korotovsky/slack-mcp-server).

| Variable | Description |
|----------|-------------|
| `SLACK_MCP_ENABLED` | Enable/disable Slack MCP (`true`/`false`) |
| `SLACK_MCP_N_NAME` | Workspace name |
| `SLACK_MCP_N_ENDPOINT` | MCP endpoint path |
| `SLACK_MCP_N_AUTH_MODE` | Auth mode: `browser`, `oauth`, or `bot` |
| `SLACK_MCP_N_ADD_MESSAGE_TOOL` | Enable message sending (`true`, channel IDs, or `!channel` to exclude) |

**Auth modes:**
- `browser` - Requires `XOXC_TOKEN` and `XOXD_TOKEN` (full access)
- `oauth` - Requires `XOXP_TOKEN` (user token from OAuth)
- `bot` - Requires `XOXB_TOKEN` (limited: no search, invited channels only)

### Moltbook

Enable integration with Moltbook, a social network for AI agents.

| Variable | Description |
|----------|-------------|
| `MOLTBOOK_ENABLED` | Enable/disable Moltbook (`true`/`false`) |
| `MOLTBOOK_N_NAME` | Agent name |
| `MOLTBOOK_N_ENDPOINT` | MCP endpoint path (32-char hex) |
| `MOLTBOOK_N_API_KEY` | Moltbook API key |
| `MOLTBOOK_N_POLLING_ENABLED` | Enable feed polling |
| `MOLTBOOK_N_POLLING_INTERVAL` | Polling interval in ms (default: 300000) |
| `MOLTBOOK_N_FEED_SORT` | Feed sort: `hot`, `new`, `top`, `rising` |

Register a new Moltbook agent:
```bash
pnpm moltbook:register --name "YourAgentName"
```

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

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with module status |
| `/webhooks/:endpoint` | POST | Webhook receiver (Slack events) |
| `/mcp/:endpoint` | * | MCP protocol handlers |

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start development server with hot reload |
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm start` | Run production server |
| `pnpm typecheck` | Type check without emitting |
| `pnpm format` | Format code with Prettier |
| `pnpm format:check` | Check code formatting |
| `pnpm moltbook:register` | Register a new Moltbook agent |

## Project Structure

```
src/
├── index.ts              # Entry point - Fastify server setup
├── config/               # Environment parsing and validation
├── core/                 # Shared types, logger, errors
├── integrations/         # External API clients (Poke, Moltbook)
├── modules/              # Feature modules (Slack, Moltbook)
│   ├── slack/
│   │   ├── events/       # Slack webhook handler
│   │   └── mcp-proxy/    # Slack MCP proxy
│   └── moltbook/
│       ├── mcp/          # Moltbook MCP server
│       └── polling/      # Feed polling handler
├── routers/              # HTTP route registration
└── servers/              # Subprocess and polling managers
```

## License

MIT
