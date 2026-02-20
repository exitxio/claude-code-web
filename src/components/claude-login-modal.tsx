"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function ClaudeLoginModal({ onClose, onSuccess }: Props) {
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "waiting" | "success" | "failed">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const startLogin = async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setStatus("waiting");
    setLoginUrl(null);
    setMessage(null);

    try {
      const res = await fetch("/api/claude/auth", { method: "POST", signal: ctrl.signal });
      if (!res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";

        for (const part of parts) {
          const eventMatch = part.match(/^event: (\w+)/m);
          const dataMatch = part.match(/^data: (.+)/m);
          if (!dataMatch) continue;

          const eventType = eventMatch?.[1] ?? "output";
          const payload = JSON.parse(dataMatch[1]);

          if (eventType === "url") {
            setLoginUrl(payload.url);
          } else if (eventType === "done") {
            if (payload.success) {
              setStatus("success");
              setTimeout(onSuccess, 1500);
            } else {
              setStatus("failed");
              setMessage(`Process exited with code ${payload.code}`);
            }
          } else if (eventType === "error") {
            setStatus("failed");
            setMessage(payload.text);
          }
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        setStatus("failed");
        setMessage(e.message);
      }
    }
  };

  const checkStatus = async () => {
    const res = await fetch("/api/claude/auth");
    const data = await res.json();
    if (data.authenticated) {
      setStatus("success");
      setTimeout(onSuccess, 1000);
    } else {
      setMessage("Not authenticated yet.");
    }
  };

  useEffect(() => () => abortRef.current?.abort(), []);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg flex flex-col gap-5 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-100">Claude Login</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">✕</button>
        </div>

        {status === "idle" && (
          <>
            <p className="text-sm text-zinc-400">
              Click the button below to start the Claude login flow. A URL will appear — open it in your browser to authenticate.
            </p>
            <button
              onClick={startLogin}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg text-sm font-medium transition-colors"
            >
              Login with Claude
            </button>
          </>
        )}

        {status === "waiting" && (
          <div className="flex flex-col gap-4">
            {!loginUrl ? (
              <p className="text-sm text-zinc-400 animate-pulse">Starting login flow…</p>
            ) : (
              <>
                <p className="text-sm text-zinc-300">
                  Open the link below in your browser to complete login:
                </p>
                <a
                  href={loginUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 underline break-all bg-black rounded-lg px-3 py-2 font-mono"
                >
                  {loginUrl}
                </a>
                <p className="text-xs text-zinc-500">
                  After completing login in your browser, click <strong className="text-zinc-300">Check Status</strong>.
                </p>
                <button
                  onClick={checkStatus}
                  className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg text-sm font-medium transition-colors"
                >
                  Check Status
                </button>
              </>
            )}
            {message && <p className="text-xs text-zinc-500">{message}</p>}
          </div>
        )}

        {status === "success" && (
          <p className="text-sm text-green-400 text-center">✓ Authenticated! Closing…</p>
        )}

        {status === "failed" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-red-400">Login failed. {message}</p>
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
