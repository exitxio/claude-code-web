import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { automationFetch, generateToken } from "@/lib/automation-client";

const automationUrl = () => process.env.AUTOMATION_SERVER_URL || "http://localhost:8080";

export async function GET() {
  const session = await getServerSession(authOptions);
  const username = session?.user?.name || session?.user?.email || "anonymous";

  try {
    const res = await automationFetch("/auth/status", { username });
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
    const body = await req.text();
    const res = await fetch(`${automationUrl()}/auth/exchange`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  // POST /api/claude/auth — start OAuth, get URL
  const res = await fetch(`${automationUrl()}/auth/login`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
