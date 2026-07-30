import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { ConversationService } from "./conversation.service";
import { IActor } from "./conversation.interface";

// Adjust req.user field names to match your actual JWT payload shape
const getActor = (req: Request): IActor => ({
  id: req.user!.id,
  type: req.user!.userType === "superadmin" ? "SUPERADMIN" : "AGENT",
});

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

  const result = await ConversationService.assignAgent(companyId, publicId, req.body.agentId, getActor(req));

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: req.body.agentId ? "Agent assigned successfully" : "Agent unassigned successfully",
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
