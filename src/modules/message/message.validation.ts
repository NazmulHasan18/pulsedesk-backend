import { z } from "zod";

const attachmentSchema = z.object({
  url: z.string().url(),
  name: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().positive(),
});

const sendMessageValidation = z.object({
  body: z.object({
    content: z.string().min(1, "Message content is required").max(5000),
    attachments: z.array(attachmentSchema).max(10).optional(),
  }),
});

const listMessagesValidation = z.object({
  query: z.object({
    cursor: z.string().cuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

const typingValidation = z.object({
  body: z.object({
    isTyping: z.boolean().optional().default(true),
  }),
});

export const MessageValidation = {
  sendMessageValidation,
  listMessagesValidation,
  typingValidation,
};
