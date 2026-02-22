import { NextRequest, NextResponse } from "next/server";
import { deleteConversation } from "@/lib/claude-db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  deleteConversation(id);
  return NextResponse.json({ ok: true });
}
