import { prisma } from "../lib/prisma";
import env from "../config/env";
import AppError from "../utils/AppError";
import catchAsync from "../utils/catchAsync";
import { verifyToken } from "../utils/jwt";

type WidgetSessionClaims = {
  companyId?: string;
  companyPublicId?: string;
  siteId?: string;
  customerId?: string;
  customerPublicId?: string;
  externalId?: string;
};

const extractSessionToken = (req: any) => {
  const headerToken =
    req.header("x-session-token") || req.header("x-widget-session-token") || req.header("authorization");
  const bodyToken = req.body?.sessionToken || req.body?.token;
  const rawToken = headerToken || bodyToken;

  if (!rawToken) {
    throw new AppError(400, "Missing customer session token");
  }

  if (typeof rawToken === "string" && rawToken.startsWith("Bearer ")) {
    return rawToken.replace(/^Bearer\s+/i, "").trim();
  }

  return rawToken;
};

const resolveSessionClaims = async (token: string): Promise<WidgetSessionClaims> => {
  const parts = token.split(".");

  if (parts.length === 3) {
    try {
      return verifyToken(token, env.JWT_ACCESS_SECRET) as WidgetSessionClaims;
    } catch {
      throw new AppError(401, "Invalid or expired customer session token");
    }
  }

  const customer = await prisma.customer.findFirst({
    where: { OR: [{ id: token }, { publicId: token }] },
    select: { id: true, publicId: true, companyId: true, externalId: true },
  });

  if (!customer) {
    throw new AppError(401, "Invalid customer session token");
  }

  return {
    companyId: customer.companyId,
    customerId: customer.id,
    customerPublicId: customer.publicId,
    externalId: customer.externalId,
  };
};

export const widgetAuth = catchAsync(async (req, _res, next) => {
  const token = extractSessionToken(req);
  const claims = await resolveSessionClaims(token);

  const siteId = req.header("x-site-id");
  const externalId = req.header("x-external-id") || req.body?.externalId;

  if (siteId && claims.siteId && siteId !== claims.siteId) {
    throw new AppError(401, "Customer session token does not match the provided site id");
  }

  if (externalId && claims.externalId && externalId !== claims.externalId) {
    throw new AppError(401, "Customer session token does not match the provided external id");
  }

  if (!claims.companyId && !claims.companyPublicId && !claims.siteId) {
    throw new AppError(401, "Customer session token is missing company identity");
  }

  if (!claims.customerId && !claims.customerPublicId) {
    throw new AppError(401, "Customer session token is missing customer identity");
  }

  const company = await prisma.company.findFirst({
    where: {
      OR: [
        ...(claims.companyId ? [{ id: claims.companyId }] : []),
        ...(claims.companyPublicId ? [{ publicId: claims.companyPublicId }] : []),
        ...(claims.siteId ? [{ siteId: claims.siteId }] : []),
        ...(siteId ? [{ siteId }] : []),
      ],
    },
    select: { id: true, publicId: true, siteId: true },
  });

  if (!company) {
    throw new AppError(404, "Company not found for the authenticated widget session");
  }

  const customer = await prisma.customer.findFirst({
    where: {
      companyId: company.id,
      OR: [
        ...(claims.customerId ? [{ id: claims.customerId }] : []),
        ...(claims.customerPublicId ? [{ publicId: claims.customerPublicId }] : []),
        ...(claims.externalId ? [{ externalId: claims.externalId }] : []),
        ...(externalId ? [{ externalId }] : []),
      ],
    },
    select: { id: true, publicId: true, externalId: true },
  });

  if (!customer) {
    throw new AppError(404, "Customer not found for the authenticated widget session");
  }

  req.widget = {
    company: { id: company.id, publicId: company.publicId, siteId: company.siteId },
    customer: { id: customer.id, publicId: customer.publicId, externalId: customer.externalId },
  };

  next();
});
