"use client";

import { useState } from "react";
import { Markdown } from "./markdown";

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
  const [history, setHistory] = useState<number[]>([]);

  const handleRun = async () => {
    const p = prompt.trim();
    if (!p || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/claude/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p }),
      });
      const data = await res.json();
      setResult(data);
      if (data.durationMs) {
        setHistory((h) => [...h.slice(-9), data.durationMs]);
      }
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : "Request failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-6 py-5 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-zinc-600">
          Rotation worker pool — independent context per request · ⌘Enter to run
        </p>
        {history.length > 0 && (
          <div className="flex items-center gap-1">
            {history.map((ms, i) => (
              <span
                key={i}
                title={`${(ms / 1000).toFixed(1)}s`}
                className={`text-[10px] font-mono px-1 py-0.5 rounded ${
                  i === history.length - 1 ? "bg-zinc-700 text-zinc-200" : "text-zinc-600"
                }`}
              >
                {(ms / 1000).toFixed(1)}s
              </span>
            ))}
          </div>
        )}
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
          {loading ? "Running..." : "Run"}
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
