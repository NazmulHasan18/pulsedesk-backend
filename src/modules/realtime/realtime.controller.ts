// src/modules/realtime/realtime.controller.ts

import { Response } from "express";
import catchAsync from "../../utils/catchAsync.js";
import AppError from "../../utils/AppError.js";
import { sseManager, rooms } from "../../realtime/index.js";

// Agents/Admins - already authenticated via the `auth()` middleware, which
// populates req.user with { id, companyId, role, ... }.
const streamForAgent = catchAsync(async (req, res: Response) => {
  const { id: agentId, companyId } = req.user as { id: string; companyId?: string };
  if (!companyId) {
    throw new AppError(403, "Only company agents can subscribe to this stream");
  }

  const clientId = `agent:${agentId}:${Date.now()}`;
  sseManager.addClient(clientId, companyId, res, [rooms.company(companyId)]);
});

export const RealtimeController = { streamForAgent };
