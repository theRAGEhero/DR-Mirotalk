import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const settings =
    (await prisma.registrationSettings.findFirst()) ??
    (await prisma.registrationSettings.create({ data: {} }));

  if (!settings.registrationOpen) {
    return NextResponse.json({ error: "Registration is closed" }, { status: 403 });
  }

  const code = parsed.data.code?.trim() || "";
  if (settings.requireCode) {
    if (!code) {
      return NextResponse.json({ error: "Registration code required" }, { status: 400 });
    }
    const validCode = await prisma.registrationCode.findFirst({
      where: { code, enabled: true }
    });
    if (!validCode) {
      return NextResponse.json({ error: "Invalid registration code" }, { status: 400 });
    }
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email }
  });

  if (existing) {
    return NextResponse.json({ error: "Email already exists" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      passwordHash,
      role: "USER",
      mustChangePassword: false
    }
  });

  return NextResponse.json({ id: user.id });
}
