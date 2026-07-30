import { z } from "zod";

const upsertCustomer = z.object({
  body: z.object({
    externalId: z.string({ error: "externalId is required" }).min(1, "externalId cannot be empty"),
    name: z.string().optional(),
    email: z.string().email("Invalid email").optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  }),
});

const updateCustomer = z.object({
  body: z.object({
    name: z.string().optional(),
    email: z.string().email("Invalid email").optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  }),
});

export const CustomerValidation = {
  upsertCustomer,
  updateCustomer,
};
