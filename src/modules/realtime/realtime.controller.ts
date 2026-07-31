// src/modules/realtime/realtime.controller.ts

import { Response } from "express";
import catchAsync from "../../utils/catchAsync";
import AppError from "../../utils/AppError";
import { sseManager, rooms } from "../../realtime";
import { prisma } from "../../lib/prisma";

// Agents/Admins - already authenticated via the `auth()` middleware, which
// is expected to populate req.user with { id, companyId, role, ... }.
const streamForAgent = catchAsync(async (req, res: Response) => {
  const { id: agentId, companyId } = req.user as { id: string; companyId?: string };
  if (!companyId) {
    throw new AppError(403, "Only company agents can subscribe to this stream");
  }

  const clientId = `agent:${agentId}:${Date.now()}`;
  sseManager.addClient(clientId, companyId, res, [rooms.company(companyId)]);
});

// Anonymous widget customers - identified by (siteId, externalId), the same
// pair the widget uses to upsert its Customer row. No JWT involved.
const streamForCustomer = catchAsync(async (req, res: Response) => {
  const { siteId, externalId, conversationId } = req.query as Record<string, string>;
  if (!siteId || !externalId) {
    throw new AppError(400, "siteId and externalId query params are required");
  }

  const company = await prisma.company.findUnique({ where: { siteId } });
  if (!company) {
    throw new AppError(404, "Unknown site");
  }

  const initialRooms = conversationId ? [rooms.conversation(conversationId)] : [];
  const clientId = `customer:${externalId}:${Date.now()}`;
  sseManager.addClient(clientId, company.id, res, initialRooms);
});

export const RealtimeController = { streamForAgent, streamForCustomer };
