import { Prisma } from "@prisma/client";

export interface IAttachment {
  url: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface ISendMessagePayload {
  content: string;
  attachments?: IAttachment[] | Prisma.InputJsonValue;
  clientMessageId?: string;
}

export interface IListMessagesQuery {
  cursor?: string; // older page: messages before this id
  after?: string; // catch-up: messages after this id
  limit?: number;
}
