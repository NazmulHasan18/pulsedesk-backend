import { Response } from "express";

type TMeta = {
  page?: number;
  limit?: number;
  total?: number;
  hasNextPage?: boolean;
  nextCursor?: string | null;
};

type TResponse<T> = {
  statusCode: number;
  success: boolean;
  message: string;
  meta?: TMeta;
  data?: T;
};

const sendResponse = <T>(res: Response, payload: TResponse<T>): void => {
  res.status(payload.statusCode).json({
    success: payload.success,
    message: payload.message,
    meta: payload.meta ?? undefined,
    data: payload.data ?? undefined,
  });
};

export default sendResponse;
