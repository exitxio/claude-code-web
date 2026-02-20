import type { IncomingMessage, ServerResponse } from "http";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { spawn, execSync } from "child_process";
import { AutomationQueue, QueueFullError } from "./queue";
import type { RunRequest } from "./types";

const MAX_PROMPT_LENGTH = 200_000;
const USERS_BASE = "/home/node/users";

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

    // GET /health — 인증 없음
    if (method === "GET" && url === "/health") {
      const health = this.queue.getHealthSummary();
      json(res, health.status === "ok" ? 200 : 503, health);
      return true;
    }

    // GET /auth/status — Claude 인증 상태 확인 (인증 필요)
    if (method === "GET" && url === "/auth/status") {
      if (this.authenticate(req, res) === null) return true;
      this.handleAuthStatus(res);
      return true;
    }

    // POST /auth/login — Claude 로그인 플로우 (SSE, 인증 필요)
    if (method === "POST" && url === "/auth/login") {
      if (this.authenticate(req, res) === null) return true;
      this.handleAuthLogin(res);
      return true;
    }

    // GET /status — 인증 필요
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

    // POST /run — 인증 필요
    if (method === "POST" && url === "/run") {
      const userId = this.authenticate(req, res);
      if (userId === null) return true;
      await this.handleRun(req, res, userId);
      return true;
    }

    // DELETE /session — 세션 명시적 종료
    if (method === "DELETE" && url === "/session") {
      if (this.authenticate(req, res) === null) return true;
      await this.handleCloseSession(req, res);
      return true;
    }

    // GET /user-claude — 사용자 CLAUDE.md 읽기
    if (method === "GET" && url === "/user-claude") {
      const userId = this.authenticate(req, res);
      if (userId === null) return true;
      const filePath = userClaudePath(userId);
      const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
      json(res, 200, { content });
      return true;
    }

    // PUT /user-claude — 사용자 CLAUDE.md 저장
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
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const sendEvent = (type: string, payload: object) => {
      res.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
    };

    const claudeExe = process.env.CLAUDE_EXE || "/usr/local/bin/claude";
    const child = spawn(claudeExe, ["auth", "login"], {
      env: { ...process.env, TERM: "dumb", BROWSER: "none" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const urlRegex = /https?:\/\/\S+/g;

    const processOutput = (chunk: Buffer) => {
      const text = chunk.toString();
      const urls = text.match(urlRegex);
      if (urls) {
        sendEvent("url", { url: urls[0], text });
      } else {
        sendEvent("output", { text });
      }
    };

    child.stdout.on("data", processOutput);
    child.stderr.on("data", processOutput);

    child.on("close", (code) => {
      sendEvent("done", { success: code === 0, code });
      res.end();
    });

    child.on("error", (err) => {
      sendEvent("error", { text: err.message });
      res.end();
    });

    res.on("close", () => {
      child.kill();
    });
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
