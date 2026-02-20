import type { IncomingMessage, ServerResponse } from "http";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { AutomationQueue, QueueFullError } from "./queue";
import type { RunRequest } from "./types";

const MAX_PROMPT_LENGTH = 200_000;
const USERS_BASE = "/home/node/users";

// Claude OAuth constants (from claude CLI source)
const CLAUDE_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const CLAUDE_AUTHORIZE_URL = "https://claude.ai/oauth/authorize";
const CLAUDE_TOKEN_URL = "https://platform.claude.com/v1/oauth/token";
const CLAUDE_REDIRECT_URI = "https://platform.claude.com/oauth/code/callback";
const CLAUDE_SCOPE =
  "org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers";
const CLAUDE_CREDENTIALS_PATH = "/home/node/.claude/.credentials.json";

interface OAuthState {
  codeVerifier: string;
  state: string;
  createdAt: number;
}

// Single global OAuth session (Claude auth is shared)
let pendingOAuth: OAuthState | null = null;

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

function generateState(): string {
  return crypto.randomBytes(24).toString("base64url");
}

function sanitizeUserId(userId: string): string {
  return userId.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 64);
}

function userClaudePath(userId: string): string {
  return path.join(USERS_BASE, sanitizeUserId(userId), "CLAUDE.md");
}

function verifyToken(token: string, secret: string): { valid: boolean; username?: string } {
  try {
    const decoded = Buffer.from(token, "base64").toString();
    const [username, timestampStr, hmac] = decoded.split(":");
    const timestamp = parseInt(timestampStr, 10);

    if (Date.now() - timestamp > 5 * 60 * 1000) {
      return { valid: false };
    }

    const data = `${username}:${timestamp}`;
    const expectedHmac = crypto.createHmac("sha256", secret).update(data).digest("hex");

    if (hmac === expectedHmac) {
      return { valid: true, username };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

function getBearerToken(req: IncomingMessage): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

export class AutomationHttpHandler {
  private readonly queue: AutomationQueue;
  private readonly secret: string;

  constructor(queue: AutomationQueue) {
    this.queue = queue;
    this.secret = process.env.NEXTAUTH_SECRET || "fallback-secret";
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = req.url;
    const method = req.method;

    // GET /health — no auth required
    if (method === "GET" && url === "/health") {
      const health = this.queue.getHealthSummary();
      json(res, health.status === "ok" ? 200 : 503, health);
      return true;
    }

    // GET /auth/status — check Claude auth state (requires auth)
    if (method === "GET" && url === "/auth/status") {
      if (this.authenticate(req, res) === null) return true;
      this.handleAuthStatus(res);
      return true;
    }

    // POST /auth/login — generate and return PKCE OAuth URL
    if (method === "POST" && url === "/auth/login") {
      if (this.authenticate(req, res) === null) return true;
      this.handleAuthLogin(res);
      return true;
    }

    // POST /auth/exchange — exchange callback code (CODE#STATE) for tokens
    if (method === "POST" && url === "/auth/exchange") {
      if (this.authenticate(req, res) === null) return true;
      await this.handleAuthExchange(req, res);
      return true;
    }

    // GET /status — requires auth
    if (method === "GET" && url === "/status") {
      if (this.authenticate(req, res) === null) return true;
      json(res, 200, {
        ...this.queue.getStatus(),
        sessions: this.queue.sessions.getActive().map((s) => ({
          id: s.id.slice(0, 8),
          lastActivity: s.lastActivity,
          processing: s.processing,
        })),
      });
      return true;
    }

    // POST /run — requires auth
    if (method === "POST" && url === "/run") {
      const userId = this.authenticate(req, res);
      if (userId === null) return true;
      await this.handleRun(req, res, userId);
      return true;
    }

    // DELETE /session — explicitly close a session
    if (method === "DELETE" && url === "/session") {
      if (this.authenticate(req, res) === null) return true;
      await this.handleCloseSession(req, res);
      return true;
    }

    // GET /user-claude — read user CLAUDE.md
    if (method === "GET" && url === "/user-claude") {
      const userId = this.authenticate(req, res);
      if (userId === null) return true;
      const filePath = userClaudePath(userId);
      const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
      json(res, 200, { content });
      return true;
    }

    // PUT /user-claude — save user CLAUDE.md
    if (method === "PUT" && url === "/user-claude") {
      const userId = this.authenticate(req, res);
      if (userId === null) return true;
      await this.handlePutUserClaude(req, res, userId);
      return true;
    }

    return false;
  }

  private authenticate(req: IncomingMessage, res: ServerResponse): string | null {
    const token = getBearerToken(req);
    if (!token) {
      json(res, 401, { error: "Missing authorization token" });
      return null;
    }

    const result = verifyToken(token, this.secret);
    if (!result.valid) {
      json(res, 401, { error: "Invalid or expired token" });
      return null;
    }

    return result.username || "anonymous";
  }

  private async handleRun(req: IncomingMessage, res: ServerResponse, userId: string): Promise<void> {
    let body: string;
    try {
      body = await readBody(req);
    } catch {
      json(res, 400, { error: "Failed to read request body" });
      return;
    }

    let parsed: RunRequest;
    try {
      parsed = JSON.parse(body);
    } catch {
      json(res, 400, { error: "Invalid JSON" });
      return;
    }

    if (!parsed.prompt || typeof parsed.prompt !== "string") {
      json(res, 400, { error: "Missing or invalid prompt" });
      return;
    }

    if (parsed.prompt.length > MAX_PROMPT_LENGTH) {
      json(res, 400, { error: `Prompt exceeds ${MAX_PROMPT_LENGTH} characters` });
      return;
    }

    console.log(`[Run] userId=${userId} sessionId=${parsed.sessionId ?? "none"} prompt=${parsed.prompt.slice(0, 30)}`);
    try {
      const result = await this.queue.run({ ...parsed, userId });
      json(res, 200, {
        success: result.success,
        output: result.output,
        durationMs: result.durationMs,
        timedOut: result.timedOut,
        timeoutType: result.timeoutType,
      });
    } catch (err) {
      if (err instanceof QueueFullError) {
        json(res, 429, { error: "Queue is full, try again later" });
      } else {
        console.error("[Automation] Run error:", err);
        json(res, 500, { error: "Internal server error" });
      }
    }
  }

  private async handlePutUserClaude(req: IncomingMessage, res: ServerResponse, userId: string): Promise<void> {
    let body: string;
    try {
      body = await readBody(req);
    } catch {
      json(res, 400, { error: "Failed to read request body" });
      return;
    }

    let parsed: { content?: string };
    try {
      parsed = JSON.parse(body);
    } catch {
      json(res, 400, { error: "Invalid JSON" });
      return;
    }

    const filePath = userClaudePath(userId);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, parsed.content ?? "");
    json(res, 200, { saved: true });
  }

  private handleAuthStatus(res: ServerResponse): void {
    // API key mode: always authenticated
    if (process.env.ANTHROPIC_API_KEY && process.env.USE_CLAUDE_API_KEY === "1") {
      json(res, 200, { authenticated: true, method: "apiKey" });
      return;
    }

    try {
      const claudeExe = process.env.CLAUDE_EXE || "/usr/local/bin/claude";
      const out = execSync(`${claudeExe} auth status`, { encoding: "utf-8", timeout: 5000 });
      const status = JSON.parse(out.trim());
      json(res, 200, { authenticated: !!status.loggedIn, method: status.authMethod || "none" });
    } catch {
      json(res, 200, { authenticated: false, method: "none" });
    }
  }

  private handleAuthLogin(res: ServerResponse): void {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();

    // Store for later exchange
    pendingOAuth = { codeVerifier, state, createdAt: Date.now() };

    const url = new URL(CLAUDE_AUTHORIZE_URL);
    url.searchParams.set("code", "true");
    url.searchParams.set("client_id", CLAUDE_CLIENT_ID);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", CLAUDE_REDIRECT_URI);
    url.searchParams.set("scope", CLAUDE_SCOPE);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("state", state);

    json(res, 200, { url: url.toString() });
  }

  private async handleAuthExchange(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!pendingOAuth) {
      json(res, 400, { error: "No pending OAuth session. Start login first." });
      return;
    }

    // Expire after 10 minutes
    if (Date.now() - pendingOAuth.createdAt > 10 * 60 * 1000) {
      pendingOAuth = null;
      json(res, 400, { error: "OAuth session expired. Please start again." });
      return;
    }

    let body: string;
    try {
      body = await readBody(req);
    } catch {
      json(res, 400, { error: "Failed to read body" });
      return;
    }

    let parsed: { code?: string };
    try {
      parsed = JSON.parse(body);
    } catch {
      json(res, 400, { error: "Invalid JSON" });
      return;
    }

    if (!parsed.code) {
      json(res, 400, { error: "Missing code" });
      return;
    }

    // Format: "AUTH_CODE#STATE"
    const hashIdx = parsed.code.indexOf("#");
    if (hashIdx === -1) {
      json(res, 400, { error: "Invalid code format. Expected CODE#STATE from the callback page." });
      return;
    }

    const authCode = parsed.code.slice(0, hashIdx);
    const callbackState = parsed.code.slice(hashIdx + 1);

    if (callbackState !== pendingOAuth.state) {
      json(res, 400, { error: "State mismatch. Please start the login flow again." });
      return;
    }

    const { codeVerifier } = pendingOAuth;
    pendingOAuth = null;

    // Exchange code for tokens
    try {
      const tokenRes = await fetch(CLAUDE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          code: authCode,
          redirect_uri: CLAUDE_REDIRECT_URI,
          client_id: CLAUDE_CLIENT_ID,
          code_verifier: codeVerifier,
          state: callbackState,
        }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        json(res, 400, { error: `Token exchange failed (${tokenRes.status}): ${err}` });
        return;
      }

      const tokens = (await tokenRes.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        scope?: string;
      };

      // Write tokens to ~/.claude/.credentials.json (same format as claude CLI on Linux)
      let credentials: Record<string, unknown> = {};
      try {
        if (fs.existsSync(CLAUDE_CREDENTIALS_PATH)) {
          credentials = JSON.parse(fs.readFileSync(CLAUDE_CREDENTIALS_PATH, "utf-8"));
        }
      } catch {
        // ignore parse errors
      }

      const scopes = tokens.scope?.split(" ").filter(Boolean) ?? [];
      credentials.claudeAiOauth = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt: Date.now() + tokens.expires_in * 1000,
        scopes,
        subscriptionType: null,
        rateLimitTier: null,
      };

      fs.mkdirSync(path.dirname(CLAUDE_CREDENTIALS_PATH), { recursive: true });
      fs.writeFileSync(CLAUDE_CREDENTIALS_PATH, JSON.stringify(credentials, null, 2), { mode: 0o600 });
      console.log("[Auth] OAuth tokens saved to ~/.claude/.credentials.json");

      // Restart workers so they pick up new credentials
      this.queue.restartWorkers().catch(console.error);

      json(res, 200, { success: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      json(res, 500, { error: `Token exchange error: ${msg}` });
    }
  }

  private async handleCloseSession(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let body: string;
    try {
      body = await readBody(req);
    } catch {
      json(res, 400, { error: "Failed to read request body" });
      return;
    }

    let parsed: { sessionId?: string };
    try {
      parsed = JSON.parse(body);
    } catch {
      json(res, 400, { error: "Invalid JSON" });
      return;
    }

    if (!parsed.sessionId) {
      json(res, 400, { error: "Missing sessionId" });
      return;
    }

    this.queue.sessions.close(parsed.sessionId);
    json(res, 200, { closed: true });
  }
}
