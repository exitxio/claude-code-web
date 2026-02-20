import { v4 as uuid } from "uuid";
import { AutomationWorker } from "./worker";
import { SessionManager } from "./session-manager";
import type { RunRequest, RunResult, QueueItem, QueueStatus } from "./types";

export class QueueFullError extends Error {
  constructor() {
    super("Automation queue is full");
    this.name = "QueueFullError";
  }
}

export class AutomationQueue {
  private workers: AutomationWorker[] = [];
  private queue: QueueItem[] = [];
  private healthInterval: ReturnType<typeof setInterval> | null = null;
  private readonly poolSize: number;
  readonly maxQueueSize = 20;
  private totalProcessed = 0;
  private totalErrors = 0;
  private startTime = Date.now();
  readonly sessions = new SessionManager();

  constructor(poolSize?: number) {
    this.poolSize = poolSize ?? parseInt(process.env.AUTOMATION_POOL_SIZE || "1");
  }

  async initialize(): Promise<void> {
    console.log(`[Automation] Initializing anon pool (size=${this.poolSize})`);

    for (let i = 0; i < this.poolSize; i++) {
      const worker = new AutomationWorker(`worker-${i}`);
      this.workers.push(worker);
      try {
        await worker.start();
      } catch (err) {
        console.error(`[Automation] Worker ${worker.id} failed to start:`, err);
      }
    }

    this.healthInterval = setInterval(() => this.healthCheck(), 60_000);

    const ready = this.workers.filter((w) => w.state === "ready").length;
    console.log(`[Automation] Anon pool initialized: ${ready}/${this.poolSize} workers ready`);
  }

  async run(request: RunRequest): Promise<RunResult> {
    if (request.sessionId) {
      return this.sessions.run(request.sessionId, request, request.userId);
    }

    const idleWorker = this.workers.find((w) => w.state === "ready");
    if (idleWorker) {
      return this.runOnWorkerOnce(idleWorker, request);
    }

    if (this.queue.length >= this.maxQueueSize) {
      throw new QueueFullError();
    }

    return new Promise<RunResult>((resolve, reject) => {
      this.queue.push({
        id: uuid(),
        request,
        resolve,
        reject,
        enqueuedAt: Date.now(),
      });
    });
  }

  private async runOnWorkerOnce(worker: AutomationWorker, request: RunRequest): Promise<RunResult> {
    const idx = this.workers.indexOf(worker);
    try {
      const result = await worker.execute(request);
      this.totalProcessed++;
      if (!result.success) this.totalErrors++;
      return result;
    } catch (err) {
      this.totalErrors++;
      throw err;
    } finally {
      worker.dispose();
      this.replaceWorker(idx);
    }
  }

  private replaceWorker(idx: number): void {
    if (idx < 0 || idx >= this.workers.length) return;
    const newWorker = new AutomationWorker(`worker-${idx}`);
    this.workers[idx] = newWorker;
    newWorker.start()
      .then(() => this.dispatchNext())
      .catch((err) => console.error(`[Automation] Replacement worker-${idx} failed:`, err));
  }

  private dispatchNext(): void {
    if (this.queue.length === 0) return;
    const idleWorker = this.workers.find((w) => w.state === "ready");
    if (!idleWorker) return;
    const item = this.queue.shift()!;
    this.runOnWorkerOnce(idleWorker, item.request).then(item.resolve, item.reject);
  }

  private async healthCheck(): Promise<void> {
    for (let i = 0; i < this.workers.length; i++) {
      const worker = this.workers[i];
      if (worker.state === "error") {
        console.log(`[Automation] Replacing errored worker ${worker.id}`);
        worker.dispose();
        this.replaceWorker(i);
      }
    }
  }

  getStatus(): QueueStatus {
    return {
      workers: this.workers.map((w) => w.status),
      queueLength: this.queue.length,
      maxQueueSize: this.maxQueueSize,
      totalProcessed: this.totalProcessed,
      totalErrors: this.totalErrors,
    };
  }

  getHealthSummary() {
    const states = this.workers.map((w) => w.state);
    return {
      status: states.some((s) => s === "ready" || s === "busy") ? ("ok" as const) : ("degraded" as const),
      workers: {
        total: this.workers.length,
        ready: states.filter((s) => s === "ready").length,
        busy: states.filter((s) => s === "busy").length,
        error: states.filter((s) => s === "error" || s === "disposed").length,
      },
      queue: {
        length: this.queue.length,
        maxSize: this.maxQueueSize,
      },
      uptime: Date.now() - this.startTime,
    };
  }

  async shutdown(): Promise<void> {
    console.log("[Automation] Shutting down...");
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }

    for (const item of this.queue) {
      item.reject(new Error("Queue shutting down"));
    }
    this.queue = [];

    for (const worker of this.workers) {
      worker.dispose();
    }
    this.workers = [];

    await this.sessions.shutdown();
    console.log("[Automation] Shutdown complete");
  }
}
