import { Router } from "express";
import validateRequest from "../../middlewares/validateRequest.js";
import { widgetAuth } from "../../middlewares/widgetAuth.js";
import { WidgetController } from "./widget.controller.js";
import { WidgetValidation } from "./widget.validation.js";

// Public endpoints used by the embeddable widget on customer websites.
// Message endpoints live in the message module under /widget/conversations/:id/messages.
const router = Router();

router.get("/config", validateRequest(WidgetValidation.getConfigSchema), WidgetController.getConfig);

router.post("/sessions", validateRequest(WidgetValidation.createSessionSchema), WidgetController.createSession);

router.post("/conversations", widgetAuth, WidgetController.openConversation);

router.get("/conversations/active", widgetAuth, WidgetController.getActiveConversation);

export const WidgetRoutes = router;
