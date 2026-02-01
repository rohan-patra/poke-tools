# poke-tools

A Node.js server that integrates external platforms with [Poke](https://poke.com), an AI agent platform. Provides webhook handlers and MCP (Model Context Protocol) proxies for Slack and Telegram.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/rohan-patra/poke-tools)

## Features

- **Slack Integration**
  - Webhook handler for Slack events with signature verification
  - MCP proxy to expose Slack capabilities to AI agents
  - Multi-workspace support

- **Telegram Integration**
  - MCP proxy to expose Telegram capabilities to AI agents
  - Automatic polling for new messages from groups and DMs
  - Powered by [tgcli](https://github.com/kfastov/telegram-mcp-server)

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

### Telegram

Enable MCP proxy for Telegram, powered by [tgcli](https://github.com/kfastov/telegram-mcp-server).

**Setup:**

1. Get your API credentials from [my.telegram.org](https://my.telegram.org):
   - Log in with your phone number
   - Go to "API development tools"
   - Create an app to get your `api_id` and `api_hash`

2. Set the environment variables:

   ```bash
   TELEGRAM_ENABLED=true
   TELEGRAM_API_ID=your_api_id
   TELEGRAM_API_HASH=your_api_hash
   TELEGRAM_PHONE_NUMBER=+1234567890
   ```

3. Complete authentication once (requires 2FA password if enabled):
   ```bash
   TGCLI_STORE=/path/to/store npx @kfastov/tgcli auth
   ```
   Use the same store path as `TELEGRAM_STORE_DIR` in your .env, or omit both to use the default temp directory.

The session is saved locally and persists across restarts.

| Variable                     | Description                                   | Default                                                            |
| ---------------------------- | --------------------------------------------- | ------------------------------------------------------------------ |
| `TELEGRAM_ENABLED`           | Enable/disable Telegram                       | `false`                                                            |
| `TELEGRAM_API_ID`            | Telegram API ID from my.telegram.org          | Required                                                           |
| `TELEGRAM_API_HASH`          | Telegram API hash from my.telegram.org        | Required                                                           |
| `TELEGRAM_PHONE_NUMBER`      | Phone number associated with Telegram account | Required                                                           |
| `TELEGRAM_SESSION`           | Base64-encoded session.json (for containers)  | -                                                                  |
| `TELEGRAM_STORE_DIR`         | Custom store directory for config and session | OS temp dir                                                        |
| `TELEGRAM_MCP_ENDPOINT`      | MCP endpoint path (random for security)       | `5fb1f15f1226e257ab87b202ebdf9a64ef8abed1e05d69cc9d5dbd97aa1eeb7b` |
| `TELEGRAM_MCP_INTERNAL_PORT` | Internal port for tgcli server                | `8080`                                                             |
| `TELEGRAM_MCP_BINARY_PATH`   | Path to tgcli binary                          | `tgcli`                                                            |
| `TELEGRAM_POLL_INTERVAL`     | Polling interval in ms                        | `30000`                                                            |

**Available MCP Tools:**

- **Dialogs:** `listChannels`, `searchChannels`, `listActiveChannels`
- **Messages:** `messagesList`, `messagesSearch`, `messagesGet`, `messagesContext`
- **Send:** `messagesSend`, `messagesSendFile`, `mediaDownload`
- **Groups:** `groupsList`, `groupsInfo`, and more
- **Contacts:** `contactsSearch`, `contactsGet`, and more

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

**For Telegram in Docker:**

Telegram requires a one-time interactive authentication. You can store the session as a base64-encoded environment variable, eliminating the need for persistent volumes.

1. Run authentication locally (one-time setup):

   ```bash
   mkdir -p ./tgcli-store
   TGCLI_STORE=./tgcli-store npx @kfastov/tgcli auth
   ```

   Enter your API ID, API hash, phone number, verification code, and 2FA password when prompted.

2. Export the session as base64:

   ```bash
   cat ./tgcli-store/session.json | base64
   ```

3. Add the base64 string to your environment:

   ```bash
   TELEGRAM_SESSION=eyJkY0lkIjo...your_base64_session...
   ```

4. Run the container:
   ```bash
   docker run -p 3000:3000 --env-file .env poke-tools
   ```

The session is automatically written to disk from the `TELEGRAM_SESSION` env var at startup.

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
│   ├── slack/
│   │   ├── events/       # Slack webhook handler
│   │   └── mcp-proxy/    # Slack MCP proxy
│   └── telegram/
│       ├── mcp-proxy/    # Telegram MCP proxy
│       └── polling/      # Message polling
├── routers/              # HTTP route registration
└── servers/              # Subprocess managers
```

## License

MIT
