import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync.js";
import sendResponse from "../../utils/sendResponse.js";
import { MessageService } from "./message.service.js";
import AppError from "../../utils/AppError.js";
import { Message } from "@prisma/client";

const sendSendResult = (res: Response, result: { message: Message; created: boolean }) =>
  sendResponse(res, {
    statusCode: result.created ? 201 : 200,
    success: true,
    message: result.created ? "Message sent" : "Message already sent",
    data: result.message,
  });

const sendAgentMessage = catchAsync(async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const { companyId } = req.user!;
  if (!companyId) {
    throw new AppError(400, "Company id is required");
  }
  if (!conversationId) {
    throw new AppError(400, "conversation id is required");
  }

  const result = await MessageService.sendMessage(companyId, conversationId as string, "AGENT", req.body);

  sendSendResult(res, result);
});

const sendCustomerMessage = catchAsync(async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const { company, customer } = req.widget!;

  const result = await MessageService.sendMessage(
    company.id,
    conversationId as string,
    "CUSTOMER",
    req.body,
    {
      customerId: customer.id,
    },
  );

  sendSendResult(res, result);
});

const getAgentMessages = catchAsync(async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const { companyId } = req.user!;
  const { cursor, after, limit } = req.query as { cursor?: string; after?: string; limit?: string };

  if (!companyId) {
    throw new AppError(400, "Company id is required");
  }

  const result = await MessageService.getMessages(companyId, conversationId as string, {
    cursor,
    after,
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
  const { cursor, after, limit } = req.query as { cursor?: string; after?: string; limit?: string };

  const result = await MessageService.getMessages(
    company.id,
    conversationId as string,
    { cursor, after, limit: limit ? Number(limit) : undefined },
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

export const MessageController = {
  sendAgentMessage,
  sendCustomerMessage,
  getAgentMessages,
  getCustomerMessages,
  markReadByAgent,
  markReadByCustomer,
};
