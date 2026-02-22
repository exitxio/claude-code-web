"use client";

import { useState, useRef, useEffect } from "react";
import { Markdown } from "./markdown";
import { ElapsedTimer } from "./elapsed-timer";
import { useIsMac, useIsMobile, modKeyLabel } from "./use-platform";

interface Message {
  role: "user" | "assistant";
  content: string;
  durationMs?: number;
  error?: boolean;
}

export function ChatPanel({
  conversationId,
  onConversationCreated,
  onTitleUpdate,
}: {
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
  onTitleUpdate: (id: string, title: string) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [needsResume, setNeedsResume] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isMac = useIsMac();
  const isMobile = useIsMobile();
  const mod = modKeyLabel(isMac);

  // Generate or reuse session from conversationId
  useEffect(() => {
    if (conversationId) {
      setSessionId(conversationId);
      setNeedsResume(true);
      // Load existing messages
      setLoadingHistory(true);
      fetch(`/api/claude/conversations/${conversationId}/messages`)
        .then((r) => r.json())
        .then((d) => {
          const msgs: Message[] = (d.messages || []).map(
            (m: { role: string; content: string; duration_ms?: number }) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
              durationMs: m.duration_ms ?? undefined,
            })
          );
          setMessages(msgs);
        })
        .catch(() => {})
        .finally(() => setLoadingHistory(false));
    } else {
      setSessionId(crypto.randomUUID());
      setMessages([]);
      setNeedsResume(false);
    }
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    const prompt = input.trim();
    if (!prompt || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: prompt }]);
    setLoading(true);

    let convId = conversationId;

    try {
      // Create conversation on first message if none exists
      if (!convId) {
        const res = await fetch("/api/claude/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const d = await res.json();
        convId = d.conversation.id;
        setSessionId(convId!);
        onConversationCreated(convId!);
      }

      const res = await fetch("/api/claude/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          sessionId: convId,
          conversationId: convId,
          resume: needsResume,
        }),
      });
      const data = await res.json();

      // After first resume message, SDK session maintains context
      if (needsResume) setNeedsResume(false);

      if (data.error) {
        setMessages((m) => [...m, { role: "assistant", content: data.error, error: true }]);
      } else {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: data.output || "*(empty response)*", durationMs: data.durationMs },
        ]);
        if (data._title) {
          onTitleUpdate(convId!, data._title);
        }
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
      <div className="flex items-center justify-between px-4 sm:px-6 py-2 border-b border-zinc-800/60 shrink-0">
        <span className="text-xs text-zinc-600 font-mono truncate">
          session {sessionId.slice(0, 8)}
          {needsResume && (
            <span className="ml-2 text-amber-600">(resume pending)</span>
          )}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 min-h-0">
        {loadingHistory ? (
          <p className="text-xs text-zinc-600 text-center mt-12">Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-zinc-600 text-center mt-12">
            Context is maintained across turns{!isMobile && <> · {mod}Enter to send</>}
          </p>
        ) : null}
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
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-zinc-800 shrink-0">
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
            placeholder={isMobile ? "Type a message..." : `Type a message... (${mod}Enter to send)`}
            rows={2}
            className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 resize-none font-mono transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="px-3 sm:px-4 py-2 min-h-[44px] self-stretch bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-zinc-100 rounded-lg text-sm font-medium transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
