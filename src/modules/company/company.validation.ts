import { CompanyPlan } from "@prisma/client";
import { z } from "zod";

const companyIdParamsSchema = z.object({
  params: z.object({
    companyId: z.string({ error: "Company id is required" }).min(1, "Company id is required"),
  }),
});

const createCompanySchema = z.object({
  body: z.object({
    companyName: z
      .string({ error: "Company name is required" })
      .min(2, "Company name must be at least 2 characters"),
    adminName: z.string({ error: "Admin name is required" }).min(2, "Name must be at least 2 characters"),
    email: z.string({ error: "Email is required" }).email("Invalid email address"),
    plan: z.enum(CompanyPlan).optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
  }),
});

const updateCompanySchema = z.object({
  body: z.object({
    name: z.string().min(2, "Company name must be at least 2 characters").optional(),
    plan: z.string().optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
  }),
});

const updateCompanySettingsSchema = z.object({
  body: z.object({
    settings: z
      .object({})
      .passthrough()
      .refine((value) => Object.keys(value).length > 0, {
        message: "Settings object is required",
      }),
  }),
});

const listCompaniesSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const CompanyValidation = {
  companyIdParamsSchema,
  createCompanySchema,
  updateCompanySchema,
  updateCompanySettingsSchema,
  listCompaniesSchema,
};
