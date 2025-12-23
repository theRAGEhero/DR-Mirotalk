import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (session.user.id === params.id) {
    return NextResponse.json({ error: "You cannot delete yourself" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { id: params.id }
  });

  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const createdMeetings = await prisma.meeting.count({
    where: { createdById: params.id }
  });

  if (createdMeetings > 0) {
    return NextResponse.json(
      { error: "User has created meetings and cannot be deleted" },
      { status: 400 }
    );
  }

  await prisma.user.delete({
    where: { id: params.id }
  });

  return NextResponse.json({ message: "User deleted" });
}
