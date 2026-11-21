import { z } from "zod";

const updateCustomer = z.object({
  body: z.object({
    name: z.string().optional(),
    email: z.string().email("Invalid email").optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  }),
});

export const CustomerValidation = {
  updateCustomer,
};
