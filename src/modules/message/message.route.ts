import { Router } from "express";
import auth, { Permission } from "../../middlewares/auth";
import { widgetAuth } from "../../middlewares/widgetAuth";
import validateRequest from "../../middlewares/validateRequest";
import { MessageValidation } from "./message.validation";
import { MessageController } from "./message.controller";

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
agentRouter.post(
  "/typing",
  auth(Permission.agent),
  validateRequest(MessageValidation.typingValidation),
  MessageController.notifyTyping,
);

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
widgetRouter.post(
  "/typing",
  widgetAuth,
  validateRequest(MessageValidation.typingValidation),
  MessageController.notifyTyping,
);

export const MessageRoutes = { agentRouter, widgetRouter };
