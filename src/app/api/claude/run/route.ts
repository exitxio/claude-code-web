import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { agentFetch } from "@/lib/agent-client";
import {
  addMessage,
  getRecentMessages,
  buildContextString,
  updateConversationTitle,
} from "@/lib/claude-db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const username = session?.user?.name || session?.user?.email || "anonymous";

  let body: {
    prompt?: string;
    sessionId?: string;
    timeoutMs?: number;
    idleTimeoutMs?: number;
    conversationId?: string;
    resume?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.prompt) {
    return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
  }

  const { conversationId, resume } = body;

  // Save user message & build context
  let finalPrompt = body.prompt;
  if (conversationId) {
    addMessage(conversationId, "user", body.prompt);

    if (resume) {
      const recent = getRecentMessages(conversationId);
      // Exclude the message we just added (last one) from context
      const contextMessages = recent.slice(0, -1);
      if (contextMessages.length > 0) {
        finalPrompt = buildContextString(contextMessages) + body.prompt;
      }
    }
  }

  const timeoutMs = body.timeoutMs ?? 120_000;

  try {
    const res = await agentFetch("/run", {
      method: "POST",
      username,
      timeoutMs: timeoutMs + 5000,
      body: JSON.stringify({
        prompt: finalPrompt,
        sessionId: body.sessionId,
        timeoutMs: body.timeoutMs,
        idleTimeoutMs: body.idleTimeoutMs,
      }),
    });

    const data = await res.json();

    // Save assistant message
    if (conversationId && !data.error) {
      const output = data.output || "";
      addMessage(conversationId, "assistant", output, data.durationMs);

      // Auto-set title on first message pair
      const recent = getRecentMessages(conversationId, 4);
      const userMsgs = recent.filter((m) => m.role === "user");
      if (userMsgs.length === 1) {
        const title = body.prompt.split("\n")[0].slice(0, 80);
        updateConversationTitle(conversationId, title);
        data._title = title;
      }
    }

    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return NextResponse.json({ error: "Request timed out" }, { status: 504 });
    }
    console.error("[Claude Run] Error:", err);
    return NextResponse.json(
      { error: "Cannot connect to agent server. Run: docker compose up api" },
      { status: 502 }
    );
  }
}
