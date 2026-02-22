import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { listConversations, createConversation } from "@/lib/claude-db";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.email || session?.user?.name || "anonymous";

  const conversations = listConversations(userId);
  return NextResponse.json({ conversations });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.email || session?.user?.name || "anonymous";

  let body: { title?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }

  const conversation = createConversation(userId, body.title || "");
  return NextResponse.json({ conversation }, { status: 201 });
}
