export type TRegisterCompanyPayload = {
  companyName: string;
  adminName: string;
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
