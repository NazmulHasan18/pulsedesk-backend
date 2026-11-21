import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync.js";
import sendResponse from "../../utils/sendResponse.js";
import { WidgetService } from "./widget.service.js";

const getConfig = catchAsync(async (req: Request, res: Response) => {
  const result = await WidgetService.getConfig(req.query.siteId as string, req.header("origin"));

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Widget configuration retrieved successfully",
    data: result,
  });
});

const createSession = catchAsync(async (req: Request, res: Response) => {
  const result = await WidgetService.createSession(req.body, req.header("origin"));

  sendResponse(res, {
    statusCode: result.isNewVisitor ? httpStatus.CREATED : httpStatus.OK,
    success: true,
    message: result.isNewVisitor ? "Visitor session created" : "Visitor session restored",
    data: result,
  });
});

const openConversation = catchAsync(async (req: Request, res: Response) => {
  const { company, customer } = req.widget!;
  const result = await WidgetService.openConversation(company.id, customer.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Conversation opened successfully",
    data: result,
  });
});

const getActiveConversation = catchAsync(async (req: Request, res: Response) => {
  const { company, customer } = req.widget!;
  const result = await WidgetService.getActiveConversation(company.id, customer.id);

  // `data` is omitted from the response when the visitor has no open conversation.
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result ? "Active conversation retrieved successfully" : "No active conversation",
    data: result,
  });
});

export const WidgetController = { getConfig, createSession, openConversation, getActiveConversation };
