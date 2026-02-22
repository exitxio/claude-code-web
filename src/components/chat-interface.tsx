"use client";

import { useState, useEffect, useCallback } from "react";
import { signOut, useSession } from "next-auth/react";
import { ChatPanel } from "./chat-panel";
import { SinglePanel } from "./single-panel";
import { UserClaudePanel } from "./user-claude-panel";
import { ClaudeLoginModal } from "./claude-login-modal";

type Tab = "chat" | "single" | "my-claude";

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

const TAB_LABELS: Record<Tab, { full: string; short: string }> = {
  chat: { full: "Chat", short: "Chat" },
  single: { full: "Single", short: "Single" },
  "my-claude": { full: "My CLAUDE.md", short: "CLAUDE" },
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  if (diff < 604800_000) return `${Math.floor(diff / 86400_000)}d ago`;
  return d.toLocaleDateString("en", { month: "short", day: "numeric" });
}

function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onDelete,
  onNew,
  open,
  onToggle,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      {/* Overlay on mobile */}
      {open && (
        <div className="sm:hidden fixed inset-0 bg-black/50 z-30" onClick={onToggle} />
      )}

      {/* Sidebar */}
      <div
        className={`${
          open ? "translate-x-0" : "-translate-x-full sm:translate-x-0"
        } fixed sm:static z-40 sm:z-auto top-0 left-0 h-full w-[260px] shrink-0 bg-zinc-950 border-r border-zinc-800 flex flex-col transition-transform duration-200`}
      >
        <div className="p-3 border-b border-zinc-800">
          <button
            onClick={onNew}
            className="w-full text-xs px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            + New conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`group flex items-start gap-2 px-3 py-2.5 cursor-pointer border-b border-zinc-900 transition-colors ${
                activeId === c.id ? "bg-zinc-800/80" : "hover:bg-zinc-900/60"
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-300 truncate">
                  {c.title || "New conversation"}
                </p>
                <p className="text-[10px] text-zinc-600 mt-0.5">
                  {formatTime(c.updated_at)}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(c.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 text-xs p-0.5 transition-opacity"
                title="Delete"
              >
                ✕
              </button>
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="text-xs text-zinc-700 text-center mt-8">No conversations</p>
          )}
        </div>
      </div>
    </>
  );
}

export function ChatInterface() {
  const [tab, setTab] = useState<Tab>("chat");
  const [claudeAuth, setClaudeAuth] = useState<boolean | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const { data: session } = useSession();

  // Conversation state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetch("/api/claude/auth")
      .then((r) => r.json())
      .then((d) => setClaudeAuth(d.authenticated))
      .catch(() => setClaudeAuth(false));
  }, []);

  const loadConversations = useCallback(() => {
    fetch("/api/claude/conversations")
      .then((r) => r.json())
      .then((d) => setConversations(d.conversations || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleSelectConv = (id: string) => {
    setActiveConvId(id);
    setSidebarOpen(false);
    if (tab !== "chat") setTab("chat");
  };

  const handleNewConv = () => {
    setActiveConvId(null);
    setSidebarOpen(false);
    if (tab !== "chat") setTab("chat");
  };

  const handleDeleteConv = async (id: string) => {
    await fetch(`/api/claude/conversations/${id}`, { method: "DELETE" });
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConvId === id) setActiveConvId(null);
  };

  const handleConvCreated = (id: string) => {
    setActiveConvId(id);
    loadConversations();
  };

  const handleTitleUpdate = (id: string, title: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c))
    );
  };

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Sidebar — only visible on chat tab */}
      {tab === "chat" && (
        <ConversationSidebar
          conversations={conversations}
          activeId={activeConvId}
          onSelect={handleSelectConv}
          onDelete={handleDeleteConv}
          onNew={handleNewConv}
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />
      )}

      <div className="flex flex-col flex-1 min-w-0">
        {/* Tab header */}
        <div className="border-b border-zinc-800 shrink-0">
          <div className="flex items-center justify-between px-4 sm:px-6 py-2 sm:py-3">
            <div className="flex items-center gap-1 min-w-0">
              {tab === "chat" && (
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="sm:hidden text-zinc-400 mr-2 p-1"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              )}
              <span className="text-sm font-medium text-zinc-200 mr-2 sm:mr-4 shrink-0 hidden sm:inline">Claude Code Web</span>
              <span className="text-sm font-medium text-zinc-200 mr-2 shrink-0 sm:hidden">CCW</span>
              {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`text-xs px-2 sm:px-3 py-1.5 rounded transition-colors whitespace-nowrap ${
                    tab === t ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <span className="sm:hidden">{TAB_LABELS[t].short}</span>
                  <span className="hidden sm:inline">{TAB_LABELS[t].full}</span>
                </button>
              ))}
            </div>

            {/* Claude auth status + user logout */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-2">
              {claudeAuth === false && (
                <button
                  onClick={() => setShowLogin(true)}
                  className="text-xs px-2 sm:px-3 py-1.5 rounded bg-amber-900/40 border border-amber-700/50 text-amber-400 hover:bg-amber-900/60 transition-colors whitespace-nowrap"
                >
                  <span className="hidden sm:inline">Not logged in · </span>Setup
                </button>
              )}
              {claudeAuth === true && (
                <span className="text-xs text-zinc-600 hidden sm:inline">● Claude connected</span>
              )}
              {session?.user && (
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  title={`Signed in as ${session.user.name || session.user.email}`}
                  className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors whitespace-nowrap"
                >
                  <span className="hidden sm:inline">{session.user.name || session.user.email} · </span>Sign out
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab content — always mounted, hidden when inactive */}
        <div className={`flex-1 min-h-0 flex flex-col${tab === "chat" ? "" : " hidden"}`}>
          <ChatPanel
            conversationId={activeConvId}
            onConversationCreated={handleConvCreated}
            onTitleUpdate={handleTitleUpdate}
          />
        </div>
        <div className={`flex-1 min-h-0 flex flex-col${tab === "single" ? "" : " hidden"}`}>
          <SinglePanel />
        </div>
        <div className={`flex-1 min-h-0 flex flex-col${tab === "my-claude" ? "" : " hidden"}`}>
          <UserClaudePanel />
        </div>
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
