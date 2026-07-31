import { z } from 'zod';

// Adjust to match your existing validateRequest middleware's expected shape
// (some setups validate { body }, others { body, query, params } — shown here
// assuming query validation is supported the same way body validation is).
const getAnalyticsSchema = z.object({
  query: z.object({
    days: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined))
      .refine((val) => val === undefined || (Number.isFinite(val) && val > 0), {
        message: 'days must be a positive integer',
      }),
  }),
});

export const DashboardValidation = {
  getAnalyticsSchema,
};
