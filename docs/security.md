# Security

## Permission Mode

Claude Code workers run with a configurable `permissionMode`. The current default is `bypassPermissions`.

### Available modes

| Mode | File edits | Shell commands | Behavior |
|------|-----------|----------------|----------|
| `default` | Prompts | Prompts | Blocks waiting for interactive approval — unusable in a web context |
| `acceptEdits` | Auto-approved | Prompts | Safe for file-only workflows; shell commands cause the worker to hang |
| `bypassPermissions` | Auto-approved | Auto-approved | Full agent capability; requires `allowDangerouslySkipPermissions: true` |
| `dontAsk` | Denied | Denied | Most restrictive; Claude can only respond in text |

### Why `bypassPermissions` is the default

Claude Code's agent capabilities — file editing, shell execution, tool use — require non-interactive approval. In a web server context there is no TTY to respond to permission prompts, so any mode that prompts will cause the worker to hang indefinitely.

`bypassPermissions` is the only mode that allows the full agent feature set without blocking.

### Changing the mode

If you only need file editing (no shell access), switch to `acceptEdits` in `server/automation/worker.ts`:

```typescript
this.session = unstable_v2_createSession({
  model: CLAUDE_MODEL,
  pathToClaudeCodeExecutable: claudeExe,
  permissionMode: "acceptEdits",   // was: "bypassPermissions"
  cwd: this.projectDir,
  env,
});
```

With `acceptEdits`, prompts for shell commands or network operations will cause the worker to hang. Only switch to this mode if you intentionally want to disable shell execution.

---

## Network Security

### Service-to-service authentication

Next.js and the automation server communicate over an internal Docker network. All requests are authenticated with HMAC-SHA256 tokens signed with `NEXTAUTH_SECRET` and expire after 5 minutes.

The automation server does not expose any port to the host — it is only reachable from the `web` container.

### HTTPS

The app does not terminate TLS itself. For any non-localhost deployment, put a reverse proxy (nginx, Caddy, Traefik) in front and enforce HTTPS. Running over plain HTTP exposes session cookies to interception.

---

## Claude Credentials

OAuth credentials are stored in a named Docker volume (`claude-auth`) mounted at `/home/node/.claude` inside the automation container. They are never written to the host filesystem.

The volume persists across container restarts. To revoke access, remove the volume:

```bash
docker compose down -v
```

---

## Multi-user Considerations

Currently all users of the same deployment share a single Claude account (the one authenticated via the login modal). This is fine for personal use or a small trusted group on a private server.

Each user gets an isolated session workspace (`/home/node/users/<username>/`) with their own project directory and CLAUDE.md.

Per-user Claude OAuth (separate credentials per account) is a planned v2 feature.
