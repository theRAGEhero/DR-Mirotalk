import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { profileSettingsSchema } from "@/lib/validators";

function normalizeTelegramHandle(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = profileSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const telegramHandle = normalizeTelegramHandle(parsed.data.telegramHandle ?? null);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { telegramHandle }
  });

  return NextResponse.json({ message: "Profile updated" });
}
