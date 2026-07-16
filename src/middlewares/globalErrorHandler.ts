import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import jwt from "jsonwebtoken";
import httpStatus from "http-status";
import env from "../config/env.js";
import AppError from "../utils/AppError.js";

type TErrorSource = { path: string | number; message: string }[];

const globalErrorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
  let message: string = "Something went wrong!";
  let errorSources: TErrorSource = [{ path: "", message: "Something went wrong!" }];

  if (err instanceof ZodError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = "Validation error";
    errorSources = err.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      statusCode = httpStatus.CONFLICT;
      const target = (err.meta?.target as string[] | undefined)?.join(", ");
      message = `Duplicate value for unique field${target ? `: ${target}` : ""}`;
      errorSources = [{ path: target || "", message }];
    } else if (err.code === "P2025") {
      statusCode = httpStatus.NOT_FOUND;
      message = "Requested record was not found";
      errorSources = [{ path: "", message }];
    } else {
      statusCode = httpStatus.BAD_REQUEST;
      message = "Database request error";
      errorSources = [{ path: "", message: err.message }];
    }
  } else if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
    statusCode = httpStatus.UNAUTHORIZED;
    message = "Invalid or expired token";
    errorSources = [{ path: "", message }];
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errorSources = [{ path: "", message: err.message }];
  } else if (err instanceof Error) {
    message = err.message;
    errorSources = [{ path: "", message: err.message }];
  }

  res.status(statusCode).json({
    success: false,
    message,
    errorSources,
    stack: env.NODE_ENV === "development" ? (err as Error)?.stack : undefined,
  });
};

export default globalErrorHandler;
