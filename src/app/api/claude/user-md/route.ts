import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { agentFetch } from "@/lib/agent-client";

async function getUsername(): Promise<string> {
  const session = await getServerSession(authOptions);
  return session?.user?.name || session?.user?.email || "anonymous";
}

export async function GET() {
  const username = await getUsername();
  try {
    const res = await agentFetch("/user-claude", {
      method: "GET",
      username,
      timeoutMs: 5000,
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ content: "" });
  }
}

export async function PUT(req: NextRequest) {
  const username = await getUsername();
  let body: { content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const res = await agentFetch("/user-claude", {
      method: "PUT",
      username,
      timeoutMs: 5000,
      body: JSON.stringify({ content: body.content ?? "" }),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Save failed" }, { status: 502 });
  }
}
