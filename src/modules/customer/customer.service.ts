import httpStatus from "http-status";
import { Prisma } from "@prisma/client";
import { IUpsertCustomerPayload, IUpdateCustomerPayload, ICustomerFilters } from "./customer.interface";
import { prisma } from "../../lib/prisma";
import AppError from "../../utils/AppError";

// Called by the embeddable widget on every session init.
// companyId is resolved upstream by the widget-key middleware, never trusted from the body.
const upsertCustomer = async (companyId: string, payload: IUpsertCustomerPayload) => {
  const { externalId, name, email, metadata } = payload;

  const customer = await prisma.customer.upsert({
    where: {
      companyId_externalId: {
        companyId,
        externalId,
      },
    },
    update: {
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email }),
      ...(metadata !== undefined && { metadata }),
    },
    create: {
      companyId,
      externalId,
      name,
      email,
      metadata,
    },
  });

  return customer;
};

const getAllCustomers = async (
  companyId: string,
  filters: ICustomerFilters,
  options: { page: number; limit: number },
) => {
  const { searchTerm, email } = filters;
  const { page, limit } = options;
  const skip = (page - 1) * limit;

  const andConditions: Prisma.CustomerWhereInput[] = [{ companyId }];

  if (searchTerm) {
    andConditions.push({
      OR: [
        { name: { contains: searchTerm, mode: "insensitive" } },
        { email: { contains: searchTerm, mode: "insensitive" } },
        { externalId: { contains: searchTerm, mode: "insensitive" } },
      ],
    });
  }

  if (email) {
    andConditions.push({ email: { equals: email, mode: "insensitive" } });
  }

  const whereConditions: Prisma.CustomerWhereInput = { AND: andConditions };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where: whereConditions,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.customer.count({ where: whereConditions }),
  ]);

  return {
    meta: { page, limit, total },
    data: customers,
  };
};

const getCustomerByPublicId = async (companyId: string, publicId: string) => {
  const customer = await prisma.customer.findFirst({
    where: { publicId, companyId },
    include: {
      conversations: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!customer) {
    throw new AppError(httpStatus.NOT_FOUND, "Customer not found");
  }

  return customer;
};

const updateCustomer = async (companyId: string, publicId: string, payload: IUpdateCustomerPayload) => {
  const existing = await prisma.customer.findFirst({
    where: { publicId, companyId },
  });

  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, "Customer not found");
  }

  const customer = await prisma.customer.update({
    where: { id: existing.id },
    data: payload,
  });

  return customer;
};

const deleteCustomer = async (companyId: string, publicId: string) => {
  const existing = await prisma.customer.findFirst({
    where: { publicId, companyId },
  });

  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, "Customer not found");
  }

  await prisma.customer.delete({ where: { id: existing.id } });

  return null;
};

export const CustomerService = {
  upsertCustomer,
  getAllCustomers,
  getCustomerByPublicId,
  updateCustomer,
  deleteCustomer,
};
