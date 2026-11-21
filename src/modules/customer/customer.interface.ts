import { Prisma } from "@prisma/client";

export interface IUpdateCustomerPayload {
  name?: string;
  email?: string;
  metadata?: Prisma.InputJsonValue;
}

export interface ICustomerFilters {
  searchTerm?: string;
  email?: string;
}
