import { CompanyPlan, Prisma } from "@prisma/client";

export type TCreateCompanyPayload = {
  name: string;
  plan?: string;
  settings?: Prisma.InputJsonValue;
};

export type TUpdateCompanyPayload = {
  name?: string;
  plan?: CompanyPlan;
  settings?: Prisma.InputJsonValue;
};

export type TCompanySettingsPayload = {
  settings: Prisma.InputJsonValue;
};

export type TCompanyListQuery = {
  search?: string;
  page?: number;
  limit?: number;
};
