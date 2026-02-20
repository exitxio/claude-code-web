export type WorkerState = "initializing" | "ready" | "busy" | "error" | "disposed";

export interface RunRequest {
  prompt: string;
  sessionId?: string;      // session ID — if present, context is maintained across requests
  userId?: string;         // user ID — used for memory isolation
  timeoutMs?: number;      // hard timeout, default 120000
  idleTimeoutMs?: number;  // idle timeout, default 8000
}

export interface RunResult {
  success: boolean;
  output: string;          // text result
  durationMs: number;
  timedOut: boolean;
  timeoutType?: "idle" | "hard";
}

export interface QueueItem {
  id: string;
  request: RunRequest;
  resolve: (result: RunResult) => void;
  reject: (error: Error) => void;
  enqueuedAt: number;
}

export interface WorkerStatus {
  id: string;
  state: WorkerState;
  busySince?: number;
}

export interface QueueStatus {
  workers: WorkerStatus[];
  queueLength: number;
  maxQueueSize: number;
  totalProcessed: number;
  totalErrors: number;
}

export interface RunResponse {
  success: boolean;
  output?: string;
  durationMs?: number;
  timedOut?: boolean;
  timeoutType?: string;
  error?: string;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  workers: { total: number; ready: number; busy: number; error: number };
  queue: { length: number; maxSize: number };
  uptime: number;
}
