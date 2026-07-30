import { Router } from "express";
import auth, { Permission } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { ConversationController } from "./conversation.controller";
import { ConversationValidation } from "./conversation.validation";

const router = Router();

router.post(
  "/",
  auth(Permission.agent),
  validateRequest(ConversationValidation.createConversationSchema),
  ConversationController.createConversation,
);

router.get(
  "/",
  auth(Permission.agent),
  validateRequest(ConversationValidation.getConversationsQuerySchema),
  ConversationController.getConversations,
);

router.get("/:publicId", auth(Permission.agent), ConversationController.getConversationDetail);

router.patch(
  "/:publicId/status",
  auth(Permission.agent),
  validateRequest(ConversationValidation.updateStatusSchema),
  ConversationController.updateStatus,
);

router.patch(
  "/:publicId/priority",
  auth(Permission.agent),
  validateRequest(ConversationValidation.updatePrioritySchema),
  ConversationController.updatePriority,
);

router.patch(
  "/:publicId/assign",
  auth(Permission.agent),
  validateRequest(ConversationValidation.assignAgentSchema),
  ConversationController.assignAgent,
);

router.post(
  "/:publicId/labels",
  auth(Permission.agent),
  validateRequest(ConversationValidation.addLabelSchema),
  ConversationController.addLabel,
);

router.delete("/:publicId/labels/:label", auth(Permission.agent), ConversationController.removeLabel);

router.post(
  "/:publicId/notes",
  auth(Permission.agent),
  validateRequest(ConversationValidation.createNoteSchema),
  ConversationController.addNote,
);

router.get("/:publicId/notes", auth(Permission.agent), ConversationController.getNotes);

router.get("/:publicId/history", auth(Permission.agent), ConversationController.getHistory);

export const ConversationRoutes = router;
