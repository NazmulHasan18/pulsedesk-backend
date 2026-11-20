// src/modules/realtime/realtime.route.ts

import { Router } from "express";
import auth, { Permission } from "../../middlewares/auth.js";
import { RealtimeController } from "./realtime.controller.js";

const router = Router();

// SSE fallback for agents/admins - equivalent to joining the company's
// Socket.io room, just delivered over a plain HTTP stream.
router.get("/sse", auth(Permission.agent), RealtimeController.streamForAgent);

// The widget SSE stream was removed: it accepted any conversationId without
// authentication. Widget visitors use Socket.io with a widget session token.

export const RealtimeRoutes = router;
