import { AutomationWorker } from "./worker";
import type { RunRequest, RunResult } from "./types";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30분
const MAX_SESSIONS = 20;

interface PendingItem {
  request: RunRequest;
  resolve: (r: RunResult) => void;
  reject: (e: Error) => void;
}

interface SessionEntry {
  worker: AutomationWorker;
  startPromise: Promise<void>;
  lastActivity: number;
  pending: PendingItem[];
  processing: boolean;
}

export class SessionManager {
  private sessions = new Map<string, SessionEntry>();
  private gcInterval: ReturnType<typeof setInterval>;

  constructor() {
    this.gcInterval = setInterval(() => this.gc(), 60_000);
  }

  async run(sessionId: string, request: RunRequest, userId?: string): Promise<RunResult> {
    let entry = this.sessions.get(sessionId);

    if (!entry) {
      if (this.sessions.size >= MAX_SESSIONS) {
        throw new Error("Too many active sessions (max 20)");
      }
      const worker = new AutomationWorker(`ses-${sessionId.slice(0, 8)}`, userId);
      const startPromise = worker.start();
      entry = {
        worker,
        startPromise,
        lastActivity: Date.now(),
        pending: [],
        processing: false,
      };
      this.sessions.set(sessionId, entry);

      startPromise.catch((err) => {
        const e = this.sessions.get(sessionId);
        if (e) {
          for (const item of e.pending) item.reject(err as Error);
          e.pending = [];
          this.sessions.delete(sessionId);
        }
      });
    }

    entry.lastActivity = Date.now();

    return new Promise<RunResult>((resolve, reject) => {
      entry!.pending.push({ request, resolve, reject });
      entry!.startPromise.then(() => this.drain(sessionId)).catch(() => {});
    });
  }

  private async drain(sessionId: string): Promise<void> {
    const entry = this.sessions.get(sessionId);
    if (!entry || entry.processing) return;

    entry.processing = true;
    while (entry.pending.length > 0) {
      const item = entry.pending.shift()!;
      try {
        const result = await entry.worker.execute(item.request);
        entry.lastActivity = Date.now();
        item.resolve(result);
      } catch (err) {
        item.reject(err as Error);
      }
    }
    entry.processing = false;
  }

  close(sessionId: string): void {
    const entry = this.sessions.get(sessionId);
    if (entry) {
      entry.worker.dispose();
      this.sessions.delete(sessionId);
      console.log(`[SessionManager] Closed session ${sessionId.slice(0, 8)}`);
    }
  }

  private gc(): void {
    const now = Date.now();
    for (const [id, entry] of this.sessions) {
      if (!entry.processing && now - entry.lastActivity > IDLE_TIMEOUT_MS) {
        console.log(`[SessionManager] GC idle session ${id.slice(0, 8)}`);
        entry.worker.dispose();
        this.sessions.delete(id);
      }
    }
  }

  getActive(): Array<{ id: string; lastActivity: number; processing: boolean }> {
    return Array.from(this.sessions.entries()).map(([id, e]) => ({
      id,
      lastActivity: e.lastActivity,
      processing: e.processing,
    }));
  }

  async shutdown(): Promise<void> {
    clearInterval(this.gcInterval);
    for (const [, entry] of this.sessions) {
      entry.worker.dispose();
    }
    this.sessions.clear();
  }
}
