import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";

export type TUserType = "agent" | "superadmin";

export type TJwtPayload = {
  id: string; // publicId of Agent or SuperAdmin
  userType: TUserType;
  role?: "ADMIN" | "AGENT"; // present only for userType 'agent'
  companyId?: string; // present only for userType 'agent'
  tokenVersion: number;
};

export const signToken = (payload: TJwtPayload, secret: string, expiresIn: string): string => {
  return jwt.sign(payload, secret, { expiresIn } as SignOptions);
};

export const verifyToken = (token: string, secret: string): TJwtPayload => {
  return jwt.verify(token, secret) as JwtPayload as TJwtPayload;
};
