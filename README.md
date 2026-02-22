# claude-code-web

Chat UI for [claude-code-api](https://github.com/exitxio/claude-code-api). \
No API key — runs on your existing Claude subscription. \
One-command Docker deploy.

![Login screen](docs/screenshots/login.png)
![Claude OAuth setup](docs/screenshots/oauth-modal.png)
![Chat session](docs/screenshots/chat.png)
![Single-shot mode](docs/screenshots/single.png)
![My CLAUDE.md](docs/screenshots/claude-md.png)

## Architecture

```
Browser
    ↓
claude-code-web (Next.js — auth, chat UI)
    ↓ HMAC token
claude-code-api (worker pool + queue)
    ↓ Agent SDK
Claude Code CLI (agent execution)
```

- **claude-code-web** — Chat UI, user authentication, proxies requests to the API
- **[claude-code-api](https://github.com/exitxio/claude-code-api)** — Automation engine, worker pool, HTTP API with API key auth

`docker compose up` pulls the `claude-code-api` image from GHCR automatically.

## Quick Start

```bash
cp .env.example .env
# NEXTAUTH_SECRET=$(openssl rand -base64 32)
# USERS=admin:yourpassword

docker compose up --build
```

Open http://localhost:3000 → log in → click **"Not logged in · Setup"** in the header → authenticate with your Claude account via OAuth.

## Features

- **Multi-turn sessions** — per-user context persistence
- **Single-shot mode** — stateless worker pool for one-off requests
- **Personal CLAUDE.md** — per-user custom instructions
- **Web OAuth** — authenticate with your Claude subscription, no API key
- **Credentials auth** — env-based user management, no database

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXTAUTH_SECRET` | **required** | Random secret for JWT signing (shared with api) |
| `NEXTAUTH_URL` | `http://localhost:3000` | Public URL of the app |
| `USERS` | — | `username:password` pairs, comma-separated |
| `CLAUDE_MODEL` | `claude-sonnet-4-6` | Claude model to use |
| `AUTOMATION_POOL_SIZE` | `1` | Number of pre-warmed workers |
| `PORT` | `3000` | Web port |

## Claude Authentication

Credentials are stored in a named Docker volume (`claude-auth`) on the api container. No local `~/.claude` mount required.

1. Open the app and log in
2. Click **"Not logged in · Setup"** in the header
3. Follow the OAuth link to claude.ai and sign in
4. Copy the code from the callback page and paste it back
5. Workers restart automatically — ready to use immediately

## Development

The web UI and API server are separate projects. For local development:

```bash
# Terminal 1 — run the API server
cd ../claude-code-api
pnpm install
pnpm dev

# Terminal 2 — run the web UI
pnpm install
cp .env.example .env.local
pnpm dev
```

## HTTP API

The HTTP API is served by `claude-code-api`. See the [claude-code-api README](https://github.com/exitxio/claude-code-api) for full API documentation, including API key authentication for external integrations (bots, CI, automation).

## Docs

- [Security](docs/security.md) — permission modes, network security, credential storage
