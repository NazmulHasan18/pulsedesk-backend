import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync.js";
import sendResponse from "../../utils/sendResponse.js";
import { ConversationService } from "./conversation.service.js";
import { IActor } from "./conversation.interface.js";
import { InboxService, InboxView } from "./conversation.inbox.js";
import { ConversationValidation } from "./conversation.validation.js";
import AppError from "../../utils/AppError.js";

// Adjust req.user field names to match your actual JWT payload shape
const getActor = (req: Request): IActor => ({
  id: req.user!.id,
  type: req.user!.userType === "superadmin" ? "SUPERADMIN" : "AGENT",
});

// Inbox endpoints are for company agents/admins only (not super admins).
const inboxAgent = (req: Request) => {
  if (!req.agent) throw new AppError(403, "Only company agents can use the inbox");
  return req.agent;
};

const getInbox = catchAsync(async (req: Request, res: Response) => {
  const agent = inboxAgent(req);
  // validateRequest checks the query but doesn't write the parsed values back.
  const { query } = ConversationValidation.inboxQuerySchema.parse({ query: req.query });
  const result = await InboxService.listInbox(agent.companyId, agent, query as { view: InboxView; page?: number; limit?: number });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Inbox retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getInboxCounts = catchAsync(async (req: Request, res: Response) => {
  const agent = inboxAgent(req);
  const result = await InboxService.inboxCounts(agent.companyId, agent);
  sendResponse(res, { statusCode: 200, success: true, message: "Inbox counts retrieved", data: result });
});

const inboxAction = (action: keyof Pick<typeof InboxService, "claim" | "unclaim" | "resolve" | "reopen">, message: string) =>
  catchAsync(async (req: Request, res: Response) => {
    const agent = inboxAgent(req);
    const result = await InboxService[action](agent.companyId, req.params.publicId as string, agent, getActor(req));
    sendResponse(res, { statusCode: 200, success: true, message, data: result });
  });

const claimConversation = inboxAction("claim", "Conversation claimed");
const unclaimConversation = inboxAction("unclaim", "Conversation released to the waiting queue");
const resolveConversation = inboxAction("resolve", "Conversation resolved");
const reopenConversation = inboxAction("reopen", "Conversation reopened");

const createConversation = catchAsync(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId as string;
  const { customerId, source } = req.body;

  const result = await ConversationService.createOrOpenConversation(companyId, customerId, source);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Conversation retrieved or created successfully",
    data: result,
  });
});

const getConversations = catchAsync(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId as string;

  const result = await ConversationService.getConversations(companyId, req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Conversations retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getConversationDetail = catchAsync(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId as string;
  const publicId = req.params.publicId as string;

  const result = await ConversationService.getConversationDetail(companyId, publicId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Conversation detail retrieved successfully",
    data: result,
  });
});

const updateStatus = catchAsync(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId as string;
  const publicId = req.params.publicId as string;

  const result = await ConversationService.updateStatus(companyId, publicId, req.body.status, getActor(req));

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Conversation status updated successfully",
    data: result,
  });
});

const updatePriority = catchAsync(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId as string;
  const publicId = req.params.publicId as string;

  const result = await ConversationService.updatePriority(
    companyId,
    publicId,
    req.body.priority,
    getActor(req),
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Conversation priority updated successfully",
    data: result,
  });
});

const assignAgent = catchAsync(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId as string;
  const publicId = req.params.publicId as string;

  const result = await ConversationService.assignAgent(companyId, publicId, req.body.agentPublicId, getActor(req));

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: req.body.agentPublicId ? "Agent assigned successfully" : "Agent unassigned successfully",
    data: result,
  });
});

const addLabel = catchAsync(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId as string;
  const publicId = req.params.publicId as string;

  const result = await ConversationService.addLabel(companyId, publicId, req.body.label, getActor(req));

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Label added successfully",
    data: result,
  });
});

const removeLabel = catchAsync(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId as string;
  const { publicId, label } = req.params;

  const result = await ConversationService.removeLabel(
    companyId,
    publicId as string,
    label as string,
    getActor(req),
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Label removed successfully",
    data: result,
  });
});

const addNote = catchAsync(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId as string;
  const publicId = req.params.publicId as string;
  const authorId = req.user!.id as string;

  const result = await ConversationService.addNote(
    companyId,
    publicId,
    authorId,
    req.body.content,
    getActor(req),
  );

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Note added successfully",
    data: result,
  });
});

const getNotes = catchAsync(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId as string;
  const publicId = req.params.publicId as string;

  const result = await ConversationService.getNotes(companyId, publicId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Notes retrieved successfully",
    data: result,
  });
});

const getHistory = catchAsync(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId as string;
  const publicId = req.params.publicId as string;

  const result = await ConversationService.getHistory(companyId, publicId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Conversation history retrieved successfully",
    data: result,
  });
});

export const ConversationController = {
  getInbox,
  getInboxCounts,
  claimConversation,
  unclaimConversation,
  resolveConversation,
  reopenConversation,
  createConversation,
  getConversations,
  getConversationDetail,
  updateStatus,
  updatePriority,
  assignAgent,
  addLabel,
  removeLabel,
  addNote,
  getNotes,
  getHistory,
};
