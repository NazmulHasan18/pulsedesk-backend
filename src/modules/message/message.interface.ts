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
}

export interface IListMessagesQuery {
  cursor?: string;
  limit?: number;
}
