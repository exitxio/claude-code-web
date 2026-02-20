"use client";

import { useState, useEffect } from "react";
import { ChatPanel } from "./chat-panel";
import { SinglePanel } from "./single-panel";
import { UserClaudePanel } from "./user-claude-panel";
import { ClaudeLoginModal } from "./claude-login-modal";

type Tab = "chat" | "single" | "my-claude";

const TAB_LABELS: Record<Tab, string> = {
  chat: "Chat",
  single: "Single",
  "my-claude": "My CLAUDE.md",
};

export function ChatInterface() {
  const [tab, setTab] = useState<Tab>("chat");
  const [claudeAuth, setClaudeAuth] = useState<boolean | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    fetch("/api/claude/auth")
      .then((r) => r.json())
      .then((d) => setClaudeAuth(d.authenticated))
      .catch(() => setClaudeAuth(false));
  }, []);

  return (
    <div className="flex flex-col" style={{ height: "100dvh" }}>
      {/* Tab header */}
      <div className="flex items-center gap-1 px-6 py-3 border-b border-zinc-800 shrink-0">
        <span className="text-sm font-medium text-zinc-200 mr-4">Claude Code</span>
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-xs px-3 py-1.5 rounded transition-colors ${
              tab === t ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}

        {/* Claude auth status */}
        <div className="ml-auto flex items-center gap-2">
          {claudeAuth === false && (
            <button
              onClick={() => setShowLogin(true)}
              className="text-xs px-3 py-1.5 rounded bg-amber-900/40 border border-amber-700/50 text-amber-400 hover:bg-amber-900/60 transition-colors"
            >
              Not logged in · Setup
            </button>
          )}
          {claudeAuth === true && (
            <span className="text-xs text-zinc-600">● Claude connected</span>
          )}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
        {tab === "chat" && <ChatPanel />}
        {tab === "single" && <SinglePanel />}
        {tab === "my-claude" && <UserClaudePanel />}
      </div>

      {showLogin && (
        <ClaudeLoginModal
          onClose={() => setShowLogin(false)}
          onSuccess={() => {
            setClaudeAuth(true);
            setShowLogin(false);
          }}
        />
      )}
    </div>
  );
}
