// note.route.ts
import { Router } from "express";
import auth, { Permission } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { NoteValidation } from "./note.validation";
import { NoteController } from "./note.controller";

const router = Router({ mergeParams: true });

router.post(
  "/",
  auth(Permission.agent),
  validateRequest(NoteValidation.createNoteValidation),
  NoteController.createNote,
);
router.get("/", auth(Permission.agent), NoteController.getNotes);

export const NoteRoutes = router;
