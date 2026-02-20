import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { automationFetch } from "@/lib/automation-client";

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const username = session?.user?.name || session?.user?.email || "anonymous";

  let body: { sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  try {
    const res = await automationFetch("/session", {
      method: "DELETE",
      username,
      timeoutMs: 5000,
      body: JSON.stringify({ sessionId: body.sessionId }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ closed: true });
  }
}
