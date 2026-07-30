export interface IAttachment {
  url: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface ISendMessagePayload {
  content: string;
  attachments?: IAttachment[];
}

export interface IListMessagesQuery {
  cursor?: string;
  limit?: number;
}
