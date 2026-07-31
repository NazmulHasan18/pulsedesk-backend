// src/modules/realtime/realtime.route.ts

import { Router } from "express";
import auth, { Permission } from "../../middlewares/auth";
import { RealtimeController } from "./realtime.controller";

const router = Router();

// SSE fallback for agents/admins - equivalent to joining the company's
// Socket.io room, just delivered over a plain HTTP stream.
router.get("/sse", auth(Permission.agent), RealtimeController.streamForAgent);

// SSE fallback for anonymous widget customers.
router.get("/sse/widget", RealtimeController.streamForCustomer);

export const RealtimeRoutes = router;
