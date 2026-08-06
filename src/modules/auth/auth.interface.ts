import { CompanyPlan } from "@prisma/client";
import { InputJsonValue } from "@prisma/client/runtime/client";

export type TRegisterCompanyPayload = {
  companyName: string;
  adminName: string;
  plan?: CompanyPlan;
  settings?: InputJsonValue;
  email: string;
  password: string;
};

export type TLoginPayload = {
  email: string;
  password: string;
};

export type TChangePasswordPayload = {
  oldPassword: string;
  newPassword: string;
};

export type TAuthTokens = {
  accessToken: string;
  refreshToken: string;
};
