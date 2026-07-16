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
      user?: TJwtPayload;
    }
  }
}

/**
 * Verifies the access token, re-checks tokenVersion against the DB (so a
 * logout-all / password change immediately invalidates old tokens), and
 * optionally restricts access to a set of userType/role combinations.
 *
 * Usage:
 *   auth()                                -> any authenticated agent or super-admin
 *   auth('agent')                          -> any authenticated agent (ADMIN or AGENT)
 *   auth('agent', 'ADMIN')                 -> only company admins
 *   auth('superadmin')                     -> only super-admins
 */
const auth = (userType?: TUserType, ...allowedRoles: string[]) => {
  return catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : undefined;

    if (!token) {
      throw new AppError(httpStatus.UNAUTHORIZED, "You are not authorized!");
    }

    const decoded = verifyToken(token, env.JWT_ACCESS_SECRET);

    if (userType && decoded.userType !== userType) {
      throw new AppError(httpStatus.FORBIDDEN, "Forbidden access!");
    }

    if (
      decoded.userType === "agent" &&
      allowedRoles.length &&
      decoded.role &&
      !allowedRoles.includes(decoded.role)
    ) {
      throw new AppError(httpStatus.FORBIDDEN, "Forbidden access!");
    }

    // Re-check tokenVersion so revoked/old tokens can't be replayed.
    if (decoded.userType === "agent") {
      const agent = await prisma.agent.findUnique({
        where: { publicId: decoded.id },
        select: { tokenVersion: true },
      });

      if (!agent || agent.tokenVersion !== decoded.tokenVersion) {
        throw new AppError(httpStatus.UNAUTHORIZED, "Session expired, please log in again");
      }
    } else {
      const superAdmin = await prisma.superAdmin.findUnique({
        where: { publicId: decoded.id },
        select: { tokenVersion: true },
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
