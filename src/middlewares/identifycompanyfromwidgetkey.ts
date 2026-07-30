import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync";
import AppError from "../utils/AppError";
import { prisma } from "../lib/prisma";

// Widget sends its public embed key on every request, either as a header
// (preferred, since it doesn't get logged in URLs) or a query param fallback
// for environments where custom headers are awkward (e.g. simple <script> tags).
//
// Adjust the header/query key names and the Company field name
// (assumed here as `widgetKey`) to match your actual schema.
const identifyCompanyFromWidgetKey = catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
  const widgetKey = (req.headers["x-widget-key"] as string) || (req.query.widgetKey as string);

  if (!widgetKey) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Widget key is required");
  }

  const company = await prisma.company.findUnique({
    where: { widgetKey },
    select: { id: true, isActive: true },
  });

  if (!company) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid widget key");
  }

  if (!company.isActive) {
    throw new AppError(httpStatus.FORBIDDEN, "This company account is currently inactive");
  }

  req.companyId = company.id;

  next();
});

export default identifyCompanyFromWidgetKey;
