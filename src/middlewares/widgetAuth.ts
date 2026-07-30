import { prisma } from "../lib/prisma";
import AppError from "../utils/AppError";
import catchAsync from "../utils/catchAsync";

export const widgetAuth = catchAsync(async (req, _res, next) => {
  const siteId = req.header("x-site-id");
  const externalId = req.header("x-external-id") || req.body?.externalId;

  if (!siteId) throw new AppError(400, "Missing x-site-id header");
  if (!externalId) throw new AppError(400, "Missing externalId (x-external-id header or body.externalId)");

  const company = await prisma.company.findUnique({ where: { siteId } });
  if (!company) throw new AppError(404, "Company not found for given site id");

  const customer = await prisma.customer.findUnique({
    where: { companyId_externalId: { companyId: company.id, externalId } },
  });
  if (!customer) throw new AppError(404, "Customer not found — initialize a session first");

  req.widget = {
    company: { id: company.id, publicId: company.publicId, siteId: company.siteId },
    customer: { id: customer.id, publicId: customer.publicId, externalId: customer.externalId },
  };

  next();
});
