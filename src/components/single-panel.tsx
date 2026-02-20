"use client";

import { useState } from "react";
import { Markdown } from "./markdown";
import { ElapsedTimer } from "./elapsed-timer";
import { useIsMac, modKeyLabel } from "./use-platform";

interface SingleResult {
  output?: string;
  durationMs?: number;
  error?: string;
  success?: boolean;
}

export function SinglePanel() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<SingleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastDuration, setLastDuration] = useState<number | null>(null);
  const isMac = useIsMac();
  const mod = modKeyLabel(isMac);

  const handleRun = async () => {
    const p = prompt.trim();
    if (!p || loading) return;
    setLoading(true);
    setResult(null);
    const startTime = Date.now();
    try {
      const res = await fetch("/api/claude/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p }),
      });
      const data = await res.json();
      setResult(data);
      setLastDuration(Date.now() - startTime);
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : "Request failed" });
      setLastDuration(Date.now() - startTime);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 py-5 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-zinc-600">
          Rotation worker pool — independent context per request · {mod}Enter to run
        </p>
        <div className="w-12 text-right">
          {loading ? <ElapsedTimer className="text-xs font-mono text-zinc-500" /> : lastDuration != null ? (
            <span className="text-xs font-mono text-zinc-600">{(lastDuration / 1000).toFixed(1)}s</span>
          ) : null}
        </div>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            handleRun();
          }
        }}
        placeholder="Enter prompt..."
        rows={6}
        className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 resize-y font-mono transition-colors mb-3"
      />

      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={handleRun}
          disabled={loading || !prompt.trim()}
          className="h-8 px-4 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-zinc-100 rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? "Running…" : "Run"}
        </button>
      </div>

      {result && (
        <div
          className={`rounded-lg border p-4 ${
            result.error || result.success === false
              ? "border-red-900/50 bg-red-950/10"
              : "border-zinc-800 bg-zinc-900"
          }`}
        >
          {result.error ? (
            <p className="text-sm text-red-400 font-mono">{result.error}</p>
          ) : (
            <Markdown>{result.output || "*(empty response)*"}</Markdown>
          )}
        </div>
      )}
    </div>
  );
}
