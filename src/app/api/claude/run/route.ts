import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { automationFetch } from "@/lib/automation-client";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const username = session?.user?.name || session?.user?.email || "anonymous";

  let body: { prompt?: string; sessionId?: string; timeoutMs?: number; idleTimeoutMs?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.prompt) {
    return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
  }

  const timeoutMs = body.timeoutMs ?? 120_000;

  try {
    const res = await automationFetch("/run", {
      method: "POST",
      username,
      timeoutMs: timeoutMs + 5000,
      body: JSON.stringify({
        prompt: body.prompt,
        sessionId: body.sessionId,
        timeoutMs: body.timeoutMs,
        idleTimeoutMs: body.idleTimeoutMs,
      }),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return NextResponse.json({ error: "Request timed out" }, { status: 504 });
    }
    console.error("[Claude Run] Error:", err);
    return NextResponse.json(
      { error: "Cannot connect to automation-server. Run: docker compose up automation-server" },
      { status: 502 }
    );
  }
}
