/**
 * lib/chat/validation/chat-schemas.ts
 *
 * Request validation for the chat orchestrator's public surface.
 */

import { z } from "zod";

export const sendMessageSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string().uuid(),
  message: z.string().min(1).max(8000),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const createSessionSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
});
export type CreateSessionInput = z.infer<typeof createSessionSchema>;

export const submitFeedbackSchema = z.object({
  messageId: z.string().uuid(),
  userId: z.string().uuid(),
  rating: z.enum(["thumbs_up", "thumbs_down"]),
  comment: z.string().max(2000).optional(),
});
export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;

export const renameSessionSchema = z.object({
  sessionId: z.string().uuid(),
  title: z.string().min(1).max(200),
});
export type RenameSessionInput = z.infer<typeof renameSessionSchema>;
