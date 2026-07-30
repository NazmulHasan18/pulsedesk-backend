import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import AppError from "../utils/AppError.js";
import catchAsync from "../utils/catchAsync.js";
import { verifyToken, TJwtPayload, TUserType } from "../utils/jwt.js";
import env from "../config/env.js";
import { prisma } from "../lib/prisma.js";

declare global {
  namespace Express {
    interface Request {
      widget?: {
        company: { id: string; publicId: string; siteId: string };
        customer: { id: string; publicId: string; externalId: string };
      };
      user?: TJwtPayload;
    }
  }
}

export enum Permission {
  agent = "agent",
  agentAdmin = "agent:ADMIN",
  agentAgent = "agent:AGENT",
  superadmin = "superadmin",
}

const auth = (...permissions: Permission[]) => {
  return catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : undefined;

    if (!token) {
      throw new AppError(httpStatus.UNAUTHORIZED, "You are not authorized!");
    }

    const decoded = verifyToken(token, env.JWT_ACCESS_SECRET);

    // Permission check
    if (permissions.length) {
      let authorized = false;

      for (const permission of permissions) {
        const permissionValue = permission.toString();

        if (permissionValue === Permission.superadmin && decoded.userType === "superadmin") {
          authorized = true;
          break;
        }

        if (permissionValue === Permission.agent && decoded.userType === "agent") {
          authorized = true;
          break;
        }

        if (permissionValue.startsWith("agent:") && decoded.userType === "agent") {
          const role = permissionValue.split(":")[1];

          if (decoded.role === role) {
            authorized = true;
            break;
          }
        }
      }

      if (!authorized) {
        throw new AppError(httpStatus.FORBIDDEN, "Forbidden access!");
      }
    }

    // Token version validation
    if (decoded.userType === "agent") {
      const agent = await prisma.agent.findUnique({
        where: { publicId: decoded.id },
        select: {
          tokenVersion: true,
          isActive: true,
        },
      });

      if (!agent || agent.tokenVersion !== decoded.tokenVersion) {
        throw new AppError(httpStatus.UNAUTHORIZED, "Session expired, please log in again");
      }

      if (!agent.isActive) {
        throw new AppError(httpStatus.FORBIDDEN, "Your account is deactivated");
      }
    } else {
      const superAdmin = await prisma.superAdmin.findUnique({
        where: { publicId: decoded.id },
        select: {
          tokenVersion: true,
        },
      });

      if (!superAdmin || superAdmin.tokenVersion !== decoded.tokenVersion) {
        throw new AppError(httpStatus.UNAUTHORIZED, "Session expired, please log in again");
      }
    }

    req.user = decoded;
    next();
  });
};

export default auth;
