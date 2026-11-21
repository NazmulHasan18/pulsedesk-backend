import type { Request } from "express";
import { prisma } from "../lib/prisma.js";
import env from "../config/env.js";
import AppError from "../utils/AppError.js";
import catchAsync from "../utils/catchAsync.js";
import { verifyWidgetToken } from "../utils/jwt.js";
import { isOriginAllowed, resolveWidgetSettings } from "../modules/company/company.settings.js";

const extractSessionToken = (req: Request): string => {
  const rawToken = req.header("x-widget-session-token") || req.header("authorization");

  if (!rawToken) {
    throw new AppError(401, "Missing widget session token");
  }

  return rawToken.replace(/^Bearer\s+/i, "").trim();
};

// Authenticates an anonymous widget visitor. The only accepted credential is a
// server-signed widget session token; company and customer identity come from
// its verified claims alone - never from headers, body fields or raw ids.
export const widgetAuth = catchAsync(async (req, _res, next) => {
  const token = extractSessionToken(req);

  let claims;
  try {
    claims = verifyWidgetToken(token, env.WIDGET_SESSION_SECRET);
  } catch {
    throw new AppError(401, "Invalid or expired widget session token");
  }

  const customer = await prisma.customer.findFirst({
    where: { id: claims.customerId, companyId: claims.companyId },
    select: {
      id: true,
      publicId: true,
      externalId: true,
      company: { select: { id: true, publicId: true, siteId: true, name: true, settings: true } },
    },
  });

  if (!customer) {
    throw new AppError(401, "Widget session is no longer valid");
  }

  const { allowedOrigins } = resolveWidgetSettings(customer.company);
  if (!isOriginAllowed(req.header("origin"), allowedOrigins)) {
    throw new AppError(403, "This website is not allowed to use this chat widget");
  }

  req.widget = {
    company: { id: customer.company.id, publicId: customer.company.publicId, siteId: customer.company.siteId },
    customer: { id: customer.id, publicId: customer.publicId, externalId: customer.externalId },
  };

  next();
});
