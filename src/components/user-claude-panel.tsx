"use client";

import { useState, useEffect } from "react";
import { useIsMac, modKeyLabel } from "./use-platform";

export function UserClaudePanel() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const isMac = useIsMac();
  const mod = modKeyLabel(isMac);

  useEffect(() => {
    fetch("/api/claude/user-md")
      .then((r) => r.json())
      .then((d) => setContent(d.content ?? ""))
      .catch(() => setError("Failed to load CLAUDE.md"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/claude/user-md", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-6 py-5 max-w-3xl">
      <p className="text-xs text-zinc-600 mb-1">
        Your personal Claude instructions — applied on top of the global CLAUDE.md
      </p>
      <p className="text-xs text-zinc-700 mb-4 font-mono">
        Stored per user in the automation server
      </p>

      {loading ? (
        <div className="text-xs text-zinc-600 animate-pulse">Loading...</div>
      ) : error ? (
        <div className="text-xs text-red-400">{error}</div>
      ) : (
        <>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                e.preventDefault();
                handleSave();
              }
            }}
            placeholder={`## My settings\n- Name: John Doe\n- Prefer TypeScript\n- Reply in English`}
            rows={20}
            className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-zinc-600 resize-y font-mono transition-colors mb-3"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="h-8 px-4 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-zinc-100 rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <span className="text-xs text-zinc-600">{mod}S to save</span>
            {saved && <span className="text-xs text-green-500">Saved</span>}
          </div>
        </>
      )}
    </div>
  );
}
