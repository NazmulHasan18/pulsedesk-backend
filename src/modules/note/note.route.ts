// note.route.ts
import { Router } from "express";
import auth, { Permission } from "../../middlewares/auth.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { NoteValidation } from "./note.validation.js";
import { NoteController } from "./note.controller.js";

const router = Router({ mergeParams: true });

router.post(
  "/",
  auth(Permission.agent),
  validateRequest(NoteValidation.createNoteValidation),
  NoteController.createNote,
);
router.get("/", auth(Permission.agent), NoteController.getNotes);

export const NoteRoutes = router;
