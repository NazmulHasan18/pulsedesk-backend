import { Router } from "express";
import auth, { Permission } from "../../middlewares/auth.js";
import { widgetAuth } from "../../middlewares/widgetAuth.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { MessageValidation } from "./message.validation.js";
import { MessageController } from "./message.controller.js";

// Agent/Admin dashboard side — mounted under an authenticated /conversations/:conversationId/messages
const agentRouter = Router({ mergeParams: true });

agentRouter.post(
  "/",
  auth(Permission.agent),
  validateRequest(MessageValidation.sendMessageValidation),
  MessageController.sendAgentMessage,
);
agentRouter.get(
  "/",
  auth(Permission.agent),
  validateRequest(MessageValidation.listMessagesValidation),
  MessageController.getAgentMessages,
);
agentRouter.patch("/read", auth(Permission.agent), MessageController.markReadByAgent);

// Typing indicators are socket-only (the `typing` event), not REST.

// Public widget side — mounted under /widget/conversations/:conversationId/messages
const widgetRouter = Router({ mergeParams: true });

widgetRouter.post(
  "/",
  widgetAuth,
  validateRequest(MessageValidation.sendMessageValidation),
  MessageController.sendCustomerMessage,
);
widgetRouter.get(
  "/",
  widgetAuth,
  validateRequest(MessageValidation.listMessagesValidation),
  MessageController.getCustomerMessages,
);
widgetRouter.patch("/read", widgetAuth, MessageController.markReadByCustomer);

export const MessageRoutes = { agentRouter, widgetRouter };
