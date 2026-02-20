# claude-code-web

Self-hosted web chat interface for Claude Code. No database required — runs entirely with Docker.

<!-- screenshots -->
<!-- ![Login screen](docs/screenshots/login.png) -->
<!-- ![Chat session](docs/screenshots/chat.png) -->
<!-- ![Single-shot mode](docs/screenshots/single.png) -->
<!-- ![My CLAUDE.md](docs/screenshots/claude-md.png) -->

## Features

- **Multi-turn chat** with persistent session context
- **Single-shot mode** — stateless rotation worker pool
- **Personal CLAUDE.md** — per-user instruction files
- **Web-based Claude login** — OAuth flow in the UI, no local `~/.claude` mount needed
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

After logging in, click **"Claude: Not logged in"** in the header to authenticate with your Claude account via OAuth.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXTAUTH_SECRET` | **required** | Random secret for JWT signing |
| `NEXTAUTH_URL` | `http://localhost:3000` | Public URL of the app |
| `USERS` | — | `username:password` pairs, comma-separated |
| `GOOGLE_CLIENT_ID` | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth client secret |
| `CLAUDE_MODEL` | `claude-sonnet-4-6` | Claude model to use |
| `AUTOMATION_POOL_SIZE` | `1` | Number of pre-warmed workers |
| `PORT` | `3000` | Web port |

## Claude Authentication

Claude credentials are stored in a named Docker volume (`claude-auth`) mounted at `/home/node/.claude` inside the container. No local `~/.claude` directory is mounted.

**To authenticate:**
1. Open the app and log in with your account
2. Click **"Claude: Not logged in"** in the header
3. Follow the OAuth link to claude.ai
4. Copy the authorization code from the callback page and paste it back
5. Workers restart automatically with the new credentials

Credentials persist across container restarts via the Docker volume.

## Development

```bash
pnpm install
cp .env.example .env.local
# Edit .env.local (NEXTAUTH_SECRET, USERS, etc.)
pnpm dev:all   # run automation-server + Next.js concurrently
```

## Architecture

```
Browser → Next.js (web) → automation-server → Claude Code CLI
                  ↕ HMAC token auth
```

- **Next.js** handles auth (NextAuth.js), serves UI, proxies API calls
- **automation-server** manages Claude Code worker pool via Agent SDK
- Workers are isolated per user (session mode) or stateless (single mode)
- After Claude login, workers restart automatically to pick up new credentials
