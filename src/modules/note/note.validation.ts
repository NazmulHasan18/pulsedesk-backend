// note.validation.ts
import { z } from "zod";

const createNoteValidation = z.object({
  body: z.object({
    content: z.string().min(1, "Note content is required").max(3000),
  }),
});

export const NoteValidation = { createNoteValidation };
