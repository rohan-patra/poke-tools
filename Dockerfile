# Go build stage — compile slack-mcp-server from source (main branch has reactions support)
FROM golang:1.24-alpine AS go-builder
RUN apk add --no-cache git
WORKDIR /build
RUN git clone --depth 1 https://github.com/korotovsky/slack-mcp-server.git .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o slack-mcp-server ./cmd/slack-mcp-server

# Build stage
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Runtime stage
FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app
COPY --from=go-builder /build/slack-mcp-server /usr/local/bin/slack-mcp-server
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
ENV PORT=3000
ENV SLACK_MCP_BINARY_PATH=/usr/local/bin/slack-mcp-server
ENV SLACK_MCP_ENABLED_TOOLS=conversations_history,conversations_replies,conversations_add_message,reactions_add,reactions_remove,attachment_get_data,conversations_search_messages,channels_list,usergroups_list,usergroups_me,usergroups_create,usergroups_update,usergroups_users_update

EXPOSE 3000
CMD ["node", "dist/index.js"]
