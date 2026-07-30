// note.service.ts
import { prisma } from "../../lib/prisma";
import AppError from "../../utils/AppError";
import { ICreateNotePayload } from "./note.interface";

const assertConversationInCompany = async (companyId: string, conversationId: string) => {
  const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, companyId } });
  if (!conversation) throw new AppError(404, "Conversation not found");
  return conversation;
};

const createNote = async (
  companyId: string,
  conversationId: string,
  authorId: string,
  payload: ICreateNotePayload,
) => {
  await assertConversationInCompany(companyId, conversationId);

  const note = await prisma.conversationNote.create({
    data: { conversationId, authorId, content: payload.content },
    include: { author: { select: { id: true, name: true, publicId: true } } },
  });

  await prisma.conversationEvent.create({
    data: { conversationId, type: "NOTE_ADDED", actorId: authorId, actorType: "AGENT" },
  });

  return note;
};

const getNotes = async (companyId: string, conversationId: string) => {
  await assertConversationInCompany(companyId, conversationId);

  return prisma.conversationNote.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true, publicId: true } } },
  });
};

export const NoteService = { createNote, getNotes };
