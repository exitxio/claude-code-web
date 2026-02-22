import Database from "better-sqlite3";
import path from "path";
import crypto from "crypto";

// ── Database init ───────────────────────────────────────────
const DATA_DIR = process.env.DATA_DIR || process.cwd();
const DB_PATH = path.join(DATA_DIR, "claude-conversations.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS claude_conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_claude_conv_user
      ON claude_conversations (user_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS claude_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL
        REFERENCES claude_conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user','assistant')),
      content TEXT NOT NULL,
      duration_ms INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_claude_msg_conv
      ON claude_messages (conversation_id, created_at ASC);
  `);
}

// ── Types ───────────────────────────────────────────────────
export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  duration_ms: number | null;
  created_at: string;
}

// ── Queries ─────────────────────────────────────────────────

export function listConversations(
  userId: string,
  limit = 50
): Conversation[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM claude_conversations
       WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?`
    )
    .all(userId, limit) as Conversation[];
}

export function createConversation(
  userId: string,
  title = ""
): Conversation {
  const db = getDb();
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO claude_conversations (id, user_id, title)
     VALUES (?, ?, ?)`
  ).run(id, userId, title);
  return db
    .prepare(`SELECT * FROM claude_conversations WHERE id = ?`)
    .get(id) as Conversation;
}

export function deleteConversation(id: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM claude_conversations WHERE id = ?`).run(id);
}

export function updateConversationTitle(
  id: string,
  title: string
): void {
  const db = getDb();
  db.prepare(
    `UPDATE claude_conversations SET title = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(title, id);
}

function touchConversation(id: string): void {
  const db = getDb();
  db.prepare(
    `UPDATE claude_conversations SET updated_at = datetime('now') WHERE id = ?`
  ).run(id);
}

export function addMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  durationMs?: number
): ChatMessage {
  const db = getDb();
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO claude_messages (id, conversation_id, role, content, duration_ms)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, conversationId, role, content, durationMs ?? null);
  touchConversation(conversationId);
  return db
    .prepare(`SELECT * FROM claude_messages WHERE id = ?`)
    .get(id) as ChatMessage;
}

export function getMessages(conversationId: string): ChatMessage[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM claude_messages
       WHERE conversation_id = ? ORDER BY created_at ASC`
    )
    .all(conversationId) as ChatMessage[];
}

export function getRecentMessages(
  conversationId: string,
  limit = 20
): ChatMessage[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM (
         SELECT * FROM claude_messages
         WHERE conversation_id = ?
         ORDER BY created_at DESC LIMIT ?
       ) sub ORDER BY created_at ASC`
    )
    .all(conversationId, limit) as ChatMessage[];
}

// ── Context builder ─────────────────────────────────────────

export function buildContextString(messages: ChatMessage[]): string {
  const MAX_TOTAL = 8000;
  const MAX_ASSISTANT = 500;

  let ctx = "[Previous conversation context]\n";
  for (const msg of messages) {
    const label = msg.role === "user" ? "User" : "Assistant";
    let content = msg.content;
    if (msg.role === "assistant" && content.length > MAX_ASSISTANT) {
      content = content.slice(0, MAX_ASSISTANT) + "...";
    }
    const line = `${label}: ${content}\n`;
    if (ctx.length + line.length > MAX_TOTAL) break;
    ctx += line;
  }
  ctx += "[End of context — continue from here]\n\n";
  return ctx;
}
