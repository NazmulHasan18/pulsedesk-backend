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

export type TWidgetSessionPayload = {
  typ: "widget";
  companyId: string; // internal Company.id
  customerId: string; // internal Customer.id
};

export const signWidgetToken = (
  payload: Omit<TWidgetSessionPayload, "typ">,
  secret: string,
  expiresIn: string,
): string => {
  return jwt.sign({ ...payload, typ: "widget" }, secret, { expiresIn } as SignOptions);
};

// Throws if the signature, expiry or shape is wrong.
export const verifyWidgetToken = (token: string, secret: string): TWidgetSessionPayload => {
  const decoded = jwt.verify(token, secret) as JwtPayload;

  if (
    decoded.typ !== "widget" ||
    typeof decoded.companyId !== "string" ||
    typeof decoded.customerId !== "string"
  ) {
    throw new Error("Not a widget session token");
  }

  return { typ: "widget", companyId: decoded.companyId, customerId: decoded.customerId };
};
