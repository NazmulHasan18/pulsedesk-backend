import { Router } from "express";
import auth, { Permission } from "../../middlewares/auth.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { ConversationController } from "./conversation.controller.js";
import { ConversationValidation } from "./conversation.validation.js";

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

// Agent inbox (step 1.5). Registered before /:publicId so "inbox" isn't read as an id.
router.get("/inbox", auth(Permission.agent), validateRequest(ConversationValidation.inboxQuerySchema), ConversationController.getInbox);
router.get("/inbox/counts", auth(Permission.agent), ConversationController.getInboxCounts);

router.get("/:publicId", auth(Permission.agent), ConversationController.getConversationDetail);

// Agents take and finish chats through these. Each one is a conditional
// update, so two agents clicking at once can't both win.
router.post("/:publicId/claim", auth(Permission.agent), ConversationController.claimConversation);
router.post("/:publicId/unclaim", auth(Permission.agent), ConversationController.unclaimConversation);
router.post("/:publicId/resolve", auth(Permission.agent), ConversationController.resolveConversation);
router.post("/:publicId/reopen", auth(Permission.agent), ConversationController.reopenConversation);

// Setting any status directly bypasses the claim/resolve rules: admins only.
router.patch(
  "/:publicId/status",
  auth(Permission.agentAdmin),
  validateRequest(ConversationValidation.updateStatusSchema),
  ConversationController.updateStatus,
);

router.patch(
  "/:publicId/priority",
  auth(Permission.agent),
  validateRequest(ConversationValidation.updatePrioritySchema),
  ConversationController.updatePriority,
);

// Assign/reassign is an ADMIN action. Agents take chats via claim/unclaim.
router.patch(
  "/:publicId/assign",
  auth(Permission.agentAdmin),
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
