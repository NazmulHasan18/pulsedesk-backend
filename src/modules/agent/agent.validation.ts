import { z } from 'zod';

const agentIdParamsSchema = z.object({
  params: z.object({
    agentId: z.string({ error: 'Agent id is required' }).min(1, 'Agent id is required'),
  }),
});

const createAgentSchema = z.object({
  body: z.object({
    name: z.string({ error: 'Name is required' }).min(2, 'Name must be at least 2 characters'),
    email: z.string({ error: 'Email is required' }).email('Invalid email address'),
    role: z.enum(['ADMIN', 'AGENT']).optional(),
    password: z.string({ error: 'Password is required' }).min(8, 'Password must be at least 8 characters'),
  }),
});

const inviteAgentSchema = z.object({
  body: z.object({
    name: z.string({ error: 'Name is required' }).min(2, 'Name must be at least 2 characters'),
    email: z.string({ error: 'Email is required' }).email('Invalid email address'),
    role: z.enum(['ADMIN', 'AGENT']).optional(),
  }),
});

const updateAgentSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').optional(),
    email: z.string().email('Invalid email address').optional(),
    role: z.enum(['ADMIN', 'AGENT']).optional(),
  }),
});

const agentStatusSchema = z.object({
  body: z.object({
    isActive: z.boolean({ error: 'isActive is required' }),
  }),
});

const listAgentsSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    role: z.enum(['ADMIN', 'AGENT']).optional(),
    isActive: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const AgentValidation = {
  agentIdParamsSchema,
  createAgentSchema,
  inviteAgentSchema,
  updateAgentSchema,
  agentStatusSchema,
  listAgentsSchema,
};
