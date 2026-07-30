import { z } from "zod";
import { ConversationStatus, ConversationPriority, ConversationSource } from "@prisma/client";

const createConversationSchema = z.object({
  body: z.object({
    customerId: z.string().cuid(),
    source: z.nativeEnum(ConversationSource).optional(),
  }),
});

const updateStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(ConversationStatus),
  }),
});

const updatePrioritySchema = z.object({
  body: z.object({
    priority: z.nativeEnum(ConversationPriority),
  }),
});

const assignAgentSchema = z.object({
  body: z.object({
    agentId: z.string().cuid().nullable(),
  }),
});

const addLabelSchema = z.object({
  body: z.object({
    label: z.string().trim().min(1).max(50),
  }),
});

const createNoteSchema = z.object({
  body: z.object({
    content: z.string().trim().min(1).max(5000),
  }),
});

const getConversationsQuerySchema = z.object({
  query: z.object({
    status: z.nativeEnum(ConversationStatus).optional(),
    priority: z.nativeEnum(ConversationPriority).optional(),
    assignedAgentId: z.string().cuid().optional(),
    label: z.string().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const ConversationValidation = {
  createConversationSchema,
  updateStatusSchema,
  updatePrioritySchema,
  assignAgentSchema,
  addLabelSchema,
  createNoteSchema,
  getConversationsQuerySchema,
};
