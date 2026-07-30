// note.controller.ts
import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { NoteService } from "./note.service";
import AppError from "../../utils/AppError";

const createNote = catchAsync(async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const { companyId, id: agentId } = req.user!;
  if (!companyId) {
    throw new AppError(400, "Company id is required");
  }
  const note = await NoteService.createNote(companyId, conversationId as string, agentId, req.body);

  sendResponse(res, { statusCode: 201, success: true, message: "Internal note added", data: note });
});

const getNotes = catchAsync(async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const { companyId } = req.user!;
  if (!companyId) {
    throw new AppError(400, "Company id is required");
  }
  const notes = await NoteService.getNotes(companyId, conversationId as string);

  sendResponse(res, { statusCode: 200, success: true, message: "Notes retrieved successfully", data: notes });
});

export const NoteController = { createNote, getNotes };
