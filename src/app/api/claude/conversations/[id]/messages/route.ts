import { NextRequest, NextResponse } from "next/server";
import { getMessages } from "@/lib/claude-db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const messages = getMessages(id);
  return NextResponse.json({ messages });
}
