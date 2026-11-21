import { z } from "zod";

const siteId = z.string({ error: "siteId is required" }).trim().min(1, "siteId is required").max(100);

const getConfigSchema = z.object({
  query: z.object({ siteId }),
});

const createSessionSchema = z.object({
  body: z.object({
    siteId,
    // Returned by a previous session call and kept in the visitor's localStorage.
    visitorKey: z.string().min(20).max(200).optional(),
  }),
});

export const WidgetValidation = { getConfigSchema, createSessionSchema };
