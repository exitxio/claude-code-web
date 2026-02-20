"use client";

import { useState, useEffect, useCallback } from "react";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function ClaudeLoginModal({ onClose, onSuccess }: Props) {
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "waiting" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Start OAuth on mount
  useEffect(() => {
    startLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startLogin = async () => {
    setStatus("idle");
    setLoginUrl(null);
    setMessage(null);
    setCode("");

    try {
      const res = await fetch("/api/claude/auth", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setStatus("error");
        setMessage(data.error || "Failed to start login.");
        return;
      }
      setLoginUrl(data.url);
      setStatus("waiting");
    } catch (e: unknown) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Failed to start login.");
    }
  };

  const copyUrl = () => {
    if (!loginUrl) return;
    navigator.clipboard.writeText(loginUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const submitCode = async () => {
    if (!code.trim()) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/claude/auth?action=exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Failed to exchange code.");
      } else {
        setStatus("success");
        setTimeout(onSuccess, 1200);
      }
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Failed to exchange code.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="claude-login-title"
        className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg flex flex-col gap-5 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="claude-login-title" className="text-base font-semibold text-zinc-100">Claude Login</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">✕</button>
        </div>

        {status === "idle" && (
          <p className="text-sm text-zinc-400 animate-pulse">Generating login URL…</p>
        )}

        {status === "waiting" && loginUrl && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-sm text-zinc-300">
                Step 1 — Open this URL and sign in to Claude:
              </p>
              <div className="flex gap-2 items-start">
                <a
                  href={loginUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-xs text-blue-400 hover:text-blue-300 underline break-all bg-black rounded-lg px-3 py-2 font-mono"
                >
                  {loginUrl}
                </a>
                <button
                  onClick={copyUrl}
                  className="shrink-0 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-sm text-zinc-300">
                Step 2 — After signing in, the callback page shows a code. Paste the full code here:
              </p>
              <p className="text-xs text-zinc-500">
                The code looks like: <span className="font-mono text-zinc-400">aBcDeFg…#xYz123…</span>
              </p>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Paste the full code here (includes # character)…"
                rows={2}
                className="w-full bg-black text-zinc-200 text-xs font-mono rounded-lg px-3 py-2 border border-zinc-700 focus:outline-none focus:border-zinc-500 resize-none"
              />
              <button
                onClick={submitCode}
                disabled={!code.trim() || submitting}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-100 rounded-lg text-sm font-medium transition-colors"
              >
                {submitting ? "Signing in…" : "Sign In"}
              </button>
            </div>

            {message && <p className="text-xs text-amber-400">{message}</p>}
          </div>
        )}

        {status === "success" && (
          <p className="text-sm text-green-400 text-center">✓ Signed in! Closing…</p>
        )}

        {status === "error" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-red-400">{message || "Login failed."}</p>
            <button
              onClick={startLogin}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg text-sm font-medium transition-colors"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
