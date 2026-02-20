import {
  unstable_v2_createSession,
  type SDKSession,
  type SDKResultMessage,
  type SDKResultSuccess,
} from "@anthropic-ai/claude-agent-sdk";
import type { WorkerState, RunRequest, RunResult } from "./types";

const DEFAULT_TIMEOUT_MS = 120_000;
// Model can be overridden via CLAUDE_MODEL env var, default: claude-sonnet-4-6
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

function sanitizeUserId(userId: string): string {
  return userId.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 64);
}

function findClaudeExecutable(): string {
  const candidates = [
    "/usr/local/bin/claude",
    "/usr/bin/claude",
    process.env.CLAUDE_EXECUTABLE,
  ].filter(Boolean) as string[];

  return candidates.find((p) => {
    try {
      require("fs").accessSync(p);
      return true;
    } catch {
      return false;
    }
  }) || "claude";
}

export class AutomationWorker {
  readonly id: string;
  private _state: WorkerState = "initializing";
  private busySince?: number;
  private session: SDKSession | null = null;
  private projectDir: string;

  constructor(id: string, userId?: string) {
    this.id = id;
    if (process.env.NODE_ENV === "production") {
      const slug = userId ? sanitizeUserId(userId) : "_anonymous";
      this.projectDir = `/home/node/users/${slug}`;
    } else {
      this.projectDir = process.cwd();
    }
  }

  get state(): WorkerState {
    return this._state;
  }

  get status() {
    return { id: this.id, state: this._state, busySince: this.busySince };
  }

  async start(): Promise<void> {
    this._state = "initializing";

    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined) env[k] = v;
    }
    env.CLAUDE_CODE_SKIP_BYPASS_PERMISSIONS_WARNING = "1";
    env.DISABLE_INSTALLATION_CHECKS = "1";
    // Prevent nested Claude Code session error
    delete env.CLAUDECODE;

    // Subscription mode: remove ANTHROPIC_API_KEY so the claude binary uses ~/.claude/ auth
    // Set USE_CLAUDE_API_KEY=1 to keep API key mode
    if (!process.env.USE_CLAUDE_API_KEY) {
      delete env.ANTHROPIC_API_KEY;
    }

    const claudeExe = findClaudeExecutable();
    console.log(`[Automation] Worker ${this.id}: model=${CLAUDE_MODEL} exe=${claudeExe} cwd=${this.projectDir}`);

    if (process.env.NODE_ENV === "production") {
      const fs = require("fs");
      const { execSync } = require("child_process");

      fs.mkdirSync(this.projectDir, { recursive: true });

      if (!fs.existsSync(`${this.projectDir}/.git`)) {
        try { execSync("git init", { cwd: this.projectDir, stdio: "ignore" }); } catch {}
      }

      // Anonymous worker: clear previous memory to ensure stateless requests
      if (this.projectDir.endsWith("/_anonymous")) {
        const projectKey = this.projectDir.replace(/^\//, "").replace(/\//g, "-");
        const memFile = `/home/node/.claude/projects/${projectKey}/memory/MEMORY.md`;
        try { fs.rmSync(memFile, { force: true }); } catch {}
      }
    }

    this.session = unstable_v2_createSession({
      model: CLAUDE_MODEL,
      pathToClaudeCodeExecutable: claudeExe,
      permissionMode: "bypassPermissions",
      cwd: this.projectDir,
      env,
    });

    try {
      await this._warmup();
      this._state = "ready";
      console.log(`[Automation] Worker ${this.id} ready (warm)`);
    } catch (err) {
      this._state = "error";
      console.error(`[Automation] Worker ${this.id} warmup failed:`, err);
      throw err;
    }
  }

  private async _warmup(): Promise<void> {
    if (!this.session) throw new Error("No session");

    let initMsg = "hi";
    if (process.env.NODE_ENV === "production") {
      try {
        const fs = require("fs");
        const userMd = `${this.projectDir}/CLAUDE.md`;
        if (fs.existsSync(userMd)) {
          const content = fs.readFileSync(userMd, "utf-8").trim();
          if (content) {
            initMsg = `[Personal settings]\n${content}\n\nRemember the above. Reply "ok" when ready.`;
          }
        }
      } catch {}
    }

    await this.session.send(initMsg);
    for await (const msg of this.session.stream()) {
      if (msg.type === "result") break;
    }
  }

  async execute(request: RunRequest): Promise<RunResult> {
    if (this._state !== "ready") {
      throw new Error(`Worker ${this.id} is not ready (state: ${this._state})`);
    }
    if (!this.session) {
      throw new Error(`Worker ${this.id} has no session`);
    }

    this._state = "busy";
    this.busySince = Date.now();
    const startTime = Date.now();
    const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    try {
      const result = await Promise.race([
        this._ask(request.prompt),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("hard timeout")), timeoutMs)
        ),
      ]);

      const output = result.subtype === "success"
        ? (result as SDKResultSuccess).result
        : (result as any).errors?.join("\n") || "Error";

      return {
        success: !result.is_error,
        output,
        durationMs: Date.now() - startTime,
        timedOut: false,
      };
    } catch (err) {
      const timedOut = (err as Error).message === "hard timeout";
      return {
        success: false,
        output: timedOut ? "" : String(err),
        durationMs: Date.now() - startTime,
        timedOut,
        timeoutType: timedOut ? "hard" : undefined,
      };
    } finally {
      this._state = "ready";
      this.busySince = undefined;
    }
  }

  private async _ask(prompt: string): Promise<SDKResultMessage> {
    if (!this.session) throw new Error("No session");
    await this.session.send(prompt);
    for await (const msg of this.session.stream()) {
      if (msg.type === "result") {
        return msg;
      }
    }
    throw new Error("Session ended without result");
  }

  dispose(): void {
    this._state = "disposed";
    try {
      this.session?.close();
    } catch {}
    this.session = null;
    console.log(`[Automation] Worker ${this.id} disposed`);
  }
}
