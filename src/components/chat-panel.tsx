"use client";

import { useState, useRef, useEffect } from "react";
import { Markdown } from "./markdown";

function ElapsedTimer() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - start), 100);
    return () => clearInterval(id);
  }, []);
  return <span>{(elapsed / 1000).toFixed(1)}s</span>;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  durationMs?: number;
  error?: boolean;
}

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setSessionId((prev) => prev || crypto.randomUUID());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const newConversation = () => {
    const old = sessionId;
    setSessionId(crypto.randomUUID());
    setMessages([]);
    textareaRef.current?.focus();
    fetch("/api/claude/session", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: old }),
    }).catch(() => {});
  };

  const handleSend = async () => {
    const prompt = input.trim();
    if (!prompt || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: prompt }]);
    setLoading(true);
    const startTime = Date.now();
    try {
      const res = await fetch("/api/claude/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, sessionId }),
      });
      const data = await res.json();
      const durationMs = Date.now() - startTime;
      if (data.error) {
        setMessages((m) => [...m, { role: "assistant", content: data.error, error: true }]);
      } else {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: data.output || "*(empty response)*", durationMs },
        ]);
      }
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: e instanceof Error ? e.message : "Request failed", error: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Session bar */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-zinc-800/60 shrink-0">
        <span className="text-xs text-zinc-600 font-mono">session {sessionId.slice(0, 8)}</span>
        <button
          onClick={newConversation}
          className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-600 px-2.5 py-1 rounded transition-colors"
        >
          New conversation
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <p className="text-xs text-zinc-600 text-center mt-12">
            Context is maintained across turns · ⌘Enter to send
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm ${
                msg.role === "user"
                  ? "bg-zinc-700 text-zinc-100"
                  : msg.error
                  ? "bg-red-950/30 border border-red-900/50 text-red-400"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-100"
              }`}
            >
              {msg.role === "user" ? (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <Markdown>{msg.content}</Markdown>
              )}
              {msg.durationMs != null && (
                <p className="text-xs text-zinc-600 mt-1.5">{(msg.durationMs / 1000).toFixed(1)}s</p>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-500 font-mono">
              <ElapsedTimer />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-zinc-800 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message... (⌘Enter to send)"
            rows={3}
            className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 resize-none font-mono transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="px-4 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-zinc-100 rounded-lg text-sm font-medium transition-colors"
            style={{ height: "72px" }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
