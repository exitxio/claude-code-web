export type WorkerState = "initializing" | "ready" | "busy" | "error" | "disposed";

export interface RunRequest {
  prompt: string;
  sessionId?: string;      // 세션 ID — 있으면 per-session 컨텍스트 유지
  userId?: string;         // 사용자 ID — 메모리 격리에 사용
  timeoutMs?: number;      // 하드 타임아웃, default 120000
  idleTimeoutMs?: number;  // idle 타임아웃, default 8000
}

export interface RunResult {
  success: boolean;
  output: string;          // 텍스트 결과
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
