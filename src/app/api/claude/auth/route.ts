import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { agentFetch, generateToken } from "@/lib/agent-client";

const agentUrl = () => process.env.AUTOMATION_SERVER_URL || "http://localhost:8080";

export async function GET() {
  const session = await getServerSession(authOptions);
  const username = session?.user?.name || session?.user?.email || "anonymous";

  try {
    const res = await agentFetch("/auth/status", { username });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const username = session?.user?.name || session?.user?.email || "anonymous";
  const token = generateToken(username);

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  // POST /api/claude/auth?action=exchange — exchange CODE#STATE for tokens
  if (action === "exchange") {
    try {
      const body = await req.text();
      const res = await fetch(`${agentUrl()}/auth/exchange`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body,
      });
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    } catch (err) {
      console.error("[Auth] Exchange error:", err);
      return NextResponse.json({ error: "Failed to reach agent server" }, { status: 502 });
    }
  }

  // POST /api/claude/auth — start OAuth, get URL
  try {
    const res = await fetch(`${agentUrl()}/auth/login`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[Auth] Login error:", err);
    return NextResponse.json({ error: "Failed to reach agent server" }, { status: 502 });
  }
}
