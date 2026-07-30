import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { MessageService } from "./message.service";
import AppError from "../../utils/AppError";

const sendAgentMessage = catchAsync(async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const { companyId } = req.user!;
  if (!companyId) {
    throw new AppError(400, "Company id is required");
  }
  if (!conversationId) {
    throw new AppError(400, "conversation id is required");
  }

  const message = await MessageService.sendMessage(companyId, conversationId as string, "AGENT", req.body);

  sendResponse(res, { statusCode: 201, success: true, message: "Message sent", data: message });
});

const sendCustomerMessage = catchAsync(async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const { company, customer } = req.widget!;

  const message = await MessageService.sendMessage(
    company.id,
    conversationId as string,
    "CUSTOMER",
    req.body,
    {
      customerId: customer.id,
    },
  );

  sendResponse(res, { statusCode: 201, success: true, message: "Message sent", data: message });
});

const getAgentMessages = catchAsync(async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const { companyId } = req.user!;
  const { cursor, limit } = req.query as { cursor?: string; limit?: string };

  if (!companyId) {
    throw new AppError(400, "Company id is required");
  }

  const result = await MessageService.getMessages(companyId, conversationId as string, {
    cursor,
    limit: limit ? Number(limit) : undefined,
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Messages retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getCustomerMessages = catchAsync(async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const { company, customer } = req.widget!;
  const { cursor, limit } = req.query as { cursor?: string; limit?: string };

  const result = await MessageService.getMessages(
    company.id,
    conversationId as string,
    { cursor, limit: limit ? Number(limit) : undefined },
    { customerId: customer.id },
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Messages retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const markReadByAgent = catchAsync(async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const { companyId } = req.user!;
  if (!companyId) {
    throw new AppError(400, "Company id is required");
  }
  const result = await MessageService.markMessagesRead(companyId, conversationId as string, "AGENT");

  sendResponse(res, { statusCode: 200, success: true, message: "Messages marked as read", data: result });
});

const markReadByCustomer = catchAsync(async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const { company, customer } = req.widget!;

  const result = await MessageService.markMessagesRead(company.id, conversationId as string, "CUSTOMER", {
    customerId: customer.id,
  });

  sendResponse(res, { statusCode: 200, success: true, message: "Messages marked as read", data: result });
});

// Placeholder only — no persistence, no broadcast. Once Socket.io is wired
// up, replace the body with io.to(conversationId).emit('typing', {...}) and
// either drop this REST route or keep it as a fallback for non-socket clients.
const notifyTyping = catchAsync(async (_req: Request, res: Response) => {
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Typing event acknowledged (Socket.io broadcast pending)",
    data: null,
  });
});

export const MessageController = {
  sendAgentMessage,
  sendCustomerMessage,
  getAgentMessages,
  getCustomerMessages,
  markReadByAgent,
  markReadByCustomer,
  notifyTyping,
};
