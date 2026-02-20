# claude-code-web

Self-hosted web chat interface for Claude Code. No database required — runs entirely with Docker.

## Features

- **Multi-turn chat** with persistent session context
- **Single-shot mode** — stateless rotation worker pool
- **Personal CLAUDE.md** — per-user instruction files
- **Subscription mode** (default) — mounts your `~/.claude` for authentication
- **API key mode** — set `USE_CLAUDE_API_KEY=1` + `ANTHROPIC_API_KEY`
- **Credentials auth** — env-based username/password (no DB)
- **Google OAuth** — optional, enabled via `GOOGLE_CLIENT_ID`

## Quick Start

```bash
# 1. Copy env example
cp .env.example .env

# 2. Edit .env — set NEXTAUTH_SECRET and USERS at minimum
#    NEXTAUTH_SECRET=$(openssl rand -base64 32)
#    USERS=admin:yourpassword

# 3. Start
docker compose up --build
```

Open http://localhost:3000

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXTAUTH_SECRET` | **required** | Random secret for JWT signing |
| `NEXTAUTH_URL` | `http://localhost:3000` | Public URL of the app |
| `USERS` | — | `username:password` pairs, comma-separated |
| `GOOGLE_CLIENT_ID` | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth client secret |
| `USE_CLAUDE_API_KEY` | — | Set to `1` for API key mode |
| `ANTHROPIC_API_KEY` | — | API key (only with `USE_CLAUDE_API_KEY=1`) |
| `CLAUDE_MODEL` | `claude-sonnet-4-6` | Claude model to use |
| `CLAUDE_CONFIG_DIR` | `~/.claude` | Path to Claude config (subscription mode) |
| `AUTOMATION_POOL_SIZE` | `1` | Number of pre-warmed workers |
| `PORT` | `3000` | Web port |

## Auth Modes

### Subscription mode (default)
Your `~/.claude` directory is mounted into the container, sharing your existing Claude authentication. No API key needed.

### API key mode
```env
USE_CLAUDE_API_KEY=1
ANTHROPIC_API_KEY=sk-ant-...
```

## Development

```bash
pnpm install
cp .env.example .env.local
# Edit .env.local (NEXTAUTH_SECRET, USERS 등)
pnpm dev:all   # automation-server + Next.js 동시 실행
```

## Architecture

```
Browser → Next.js (web) → automation-server → Claude Code CLI
                  ↕ HMAC token auth
```

- **Next.js** handles auth (NextAuth.js), serves UI, proxies API calls
- **automation-server** manages Claude Code worker pool via Agent SDK
- Workers are isolated per user (session mode) or stateless (single mode)
