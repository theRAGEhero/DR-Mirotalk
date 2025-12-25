import { z } from "zod";

export const createMeetingSchema = z.object({
  title: z.string().min(1, "Title is required"),
  date: z.string().optional(),
  startTime: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
  inviteEmails: z.array(z.string().email("Invalid email")).optional(),
  language: z.enum(["EN", "IT"]).default("EN"),
  transcriptionProvider: z.enum(["DEEPGRAM", "VOSK"]).default("DEEPGRAM"),
  dataspaceId: z.string().optional().nullable()
});

export const inviteMemberSchema = z.object({
  email: z.string().email("Invalid email")
});

export const linkTranscriptionSchema = z.object({
  roundId: z.string().min(1, "Round ID is required")
});

export const deactivateMeetingSchema = z.object({
  confirm: z.boolean().optional()
});

export const createPlanSchema = z.object({
  title: z.string().min(1, "Title is required"),
  startAt: z.string().min(1, "Start time is required"),
  roundDurationMinutes: z.number().int().positive().max(240),
  roundsCount: z.number().int().positive().max(100),
  participantIds: z.array(z.string().min(1)).min(2, "Select at least two participants"),
  syncMode: z.enum(["SERVER", "CLIENT"]).default("SERVER"),
  maxParticipantsPerRoom: z.number().int().min(2).max(12).default(2),
  dataspaceId: z.string().optional().nullable()
});

export const createUserSchema = z.object({
  email: z.string().email("Invalid email"),
  role: z.enum(["ADMIN", "USER"])
});

export const registerSchema = z
  .object({
    email: z.string().email("Invalid email"),
    password: z.string().min(12, "Minimum 12 characters"),
    confirmPassword: z.string().min(12)
  })
  .refine((data) => /[a-zA-Z]/.test(data.password), {
    message: "Password must include at least one letter",
    path: ["password"]
  })
  .refine((data) => /[0-9]/.test(data.password), {
    message: "Password must include at least one number",
    path: ["password"]
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });

export const createDataspaceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().max(500).optional().or(z.literal(""))
});

export const changePasswordSchema = z
  .object({
    newPassword: z.string().min(12, "Minimum 12 characters"),
    confirmPassword: z.string().min(12)
  })
  .refine((data) => /[a-zA-Z]/.test(data.newPassword), {
    message: "Password must include at least one letter",
    path: ["newPassword"]
  })
  .refine((data) => /[0-9]/.test(data.newPassword), {
    message: "Password must include at least one number",
    path: ["newPassword"]
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });

export const profileSettingsSchema = z.object({
  telegramHandle: z
    .string()
    .trim()
    .max(64, "Telegram handle is too long")
    .optional()
    .or(z.literal(""))
});
