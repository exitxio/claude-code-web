import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { automationFetch } from "@/lib/automation-client";

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

  const automationUrl = process.env.AUTOMATION_SERVER_URL || "http://localhost:8080";
  const { generateToken } = await import("@/lib/automation-client");
  const token = generateToken(username);

  const upstream = await fetch(`${automationUrl}/auth/login`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
