import { z } from "zod";

// ---------- Category ----------
const createFaqCategory = z.object({
  body: z.object({
    name: z
      .string({ error: "Category name is required" })
      .min(2, "Category name must be at least 2 characters")
      .max(100),
  }),
});

const updateFaqCategory = z.object({
  body: z.object({
    name: z.string().min(2).max(100).optional(),
  }),
});

// ---------- Doc ----------
const createFaqDoc = z.object({
  body: z.object({
    question: z.string({ error: "Question is required" }).min(3, "Question must be at least 3 characters"),
    answer: z.string({ error: "Answer is required" }).min(3, "Answer must be at least 3 characters"),
    categoryId: z.string().cuid().optional(),
  }),
});

const updateFaqDoc = z.object({
  body: z.object({
    question: z.string().min(3).optional(),
    answer: z.string().min(3).optional(),
    categoryId: z.string().cuid().nullable().optional(),
  }),
});

const searchFaqDocs = z.object({
  query: z.object({
    q: z.string({ error: "Search query (q) is required" }).min(1),
    categoryId: z.string().cuid().optional(),
    limit: z.string().regex(/^\d+$/, "limit must be a positive integer").optional(),
  }),
});

export const FaqValidation = {
  createFaqCategory,
  updateFaqCategory,
  createFaqDoc,
  updateFaqDoc,
  searchFaqDocs,
};
