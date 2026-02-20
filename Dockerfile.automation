# Base: node with build tools
FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# Automation server image
FROM base AS automation
WORKDIR /app

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Claude CLI (npm global install for Docker compatibility)
RUN npm install -g @anthropic-ai/claude-code

# Install project dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy server source
COPY server ./server
COPY tsconfig.json ./

# git init — Claude Code uses this dir as project root
RUN git init

ENV NODE_ENV=production
ENV CLAUDE_CODE_SKIP_BYPASS_PERMISSIONS_WARNING=1
ENV DISABLE_INSTALLATION_CHECKS=1

EXPOSE 8080

# Pre-create directories with proper ownership
# Named volume claude-auth mounts over /home/node/.claude — Docker initializes
# the volume from image content on first use if volume is empty
RUN mkdir -p /home/node/users \
    /home/node/.claude/debug \
    /home/node/.claude/cache \
    && chown -R node:node /home/node

# Run as node user (non-root)
WORKDIR /home/node
USER node

CMD ["npx", "tsx", "/app/server/automation-server.ts"]
