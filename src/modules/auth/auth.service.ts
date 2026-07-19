import bcrypt from "bcrypt";
import httpStatus from "http-status";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import env from "../../config/env";
import AppError from "../../utils/AppError";
import generateSiteId from "../../utils/generateSiteId";
import { signToken, verifyToken, TJwtPayload } from "../../utils/jwt";
import { TChangePasswordPayload, TLoginPayload, TRegisterCompanyPayload } from "./auth.interface";

const createTokenPair = (payload: TJwtPayload) => {
  const accessToken = signToken(payload, env.JWT_ACCESS_SECRET, env.JWT_ACCESS_EXPIRES_IN);
  const refreshToken = signToken(payload, env.JWT_REFRESH_SECRET, env.JWT_REFRESH_EXPIRES_IN);

  return { accessToken, refreshToken };
};

/**
 * Creates a new Company along with its first Agent (role: ADMIN).
 * This is the entry point for a company signing up for PulseDesk.
 */
const registerCompany = async (payload: TRegisterCompanyPayload) => {
  const existingAgent = await prisma.agent.findUnique({
    where: { email: payload.email },
  });

  if (existingAgent) {
    throw new AppError(httpStatus.CONFLICT, "Email is already in use");
  }

  const hashedPassword = await bcrypt.hash(payload.password, env.BCRYPT_SALT_ROUNDS);

  // Ensure siteId uniqueness (astronomically unlikely to collide, but guard anyway).
  let siteId = generateSiteId();
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.company.findUnique({ where: { siteId } })) {
    siteId = generateSiteId();
  }

  const { company, agent } = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const company = await tx.company.create({
      data: {
        name: payload.companyName,
        siteId,
      },
    });

    const agent = await tx.agent.create({
      data: {
        name: payload.adminName,
        email: payload.email,
        password: hashedPassword,
        role: "ADMIN",
        companyId: company.id,
      },
    });

    return { company, agent };
  });

  const tokens = createTokenPair({
    id: agent.publicId,
    userType: "agent",
    role: agent.role,
    companyId: company.id,
    tokenVersion: agent.tokenVersion,
  });

  return {
    company: {
      publicId: company.publicId,
      name: company.name,
      siteId: company.siteId,
      plan: company.plan,
    },
    agent: {
      publicId: agent.publicId,
      name: agent.name,
      email: agent.email,
      role: agent.role,
    },
    ...tokens,
  };
};

/**
 * Logs in a company agent/admin by email + password.
 */
const loginAgent = async (payload: TLoginPayload) => {
  const agent = await prisma.agent.findUnique({
    where: { email: payload.email },
    include: { company: true },
  });

  if (!agent) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email address.");
  }

  if (!agent.isActive) {
    throw new AppError(httpStatus.FORBIDDEN, "Your account is deactivated");
  }

  const isPasswordValid = await bcrypt.compare(payload.password, agent.password);

  if (!isPasswordValid) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid password entered.");
  }

  const tokens = createTokenPair({
    id: agent.publicId,
    userType: "agent",
    role: agent.role,
    companyId: agent.companyId,
    tokenVersion: agent.tokenVersion,
  });

  return {
    agent: {
      publicId: agent.publicId,
      name: agent.name,
      email: agent.email,
      role: agent.role,
    },
    company: {
      publicId: agent.company.publicId,
      name: agent.company.name,
      siteId: agent.company.siteId,
    },
    ...tokens,
  };
};

/**
 * Logs in a platform super-admin by email + password.
 */
const loginSuperAdmin = async (payload: TLoginPayload) => {
  const superAdmin = await prisma.superAdmin.findUnique({
    where: { email: payload.email },
  });

  if (!superAdmin) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password");
  }

  const isPasswordValid = await bcrypt.compare(payload.password, superAdmin.password);

  if (!isPasswordValid) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password");
  }

  const tokens = createTokenPair({
    id: superAdmin.publicId,
    userType: "superadmin",
    tokenVersion: superAdmin.tokenVersion,
  });

  return {
    superAdmin: {
      publicId: superAdmin.publicId,
      name: superAdmin.name,
      email: superAdmin.email,
    },
    ...tokens,
  };
};

/**
 * Issues a fresh access token from a valid refresh token.
 */
const refreshToken = async (token: string) => {
  const decoded = verifyToken(token, env.JWT_REFRESH_SECRET);

  if (decoded.userType === "agent") {
    const agent = await prisma.agent.findUnique({
      where: { publicId: decoded.id },
    });

    if (!agent || agent.tokenVersion !== decoded.tokenVersion) {
      throw new AppError(httpStatus.UNAUTHORIZED, "Session expired, please log in again");
    }

    if (!agent.isActive) {
      throw new AppError(httpStatus.FORBIDDEN, "Your account is deactivated");
    }

    const accessToken = signToken(
      {
        id: agent.publicId,
        userType: "agent",
        role: agent.role,
        companyId: agent.companyId,
        tokenVersion: agent.tokenVersion,
      },
      env.JWT_ACCESS_SECRET,
      env.JWT_ACCESS_EXPIRES_IN,
    );

    return { accessToken };
  }

  const superAdmin = await prisma.superAdmin.findUnique({
    where: { publicId: decoded.id },
  });

  if (!superAdmin || superAdmin.tokenVersion !== decoded.tokenVersion) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Session expired, please log in again");
  }

  const accessToken = signToken(
    {
      id: superAdmin.publicId,
      userType: "superadmin",
      tokenVersion: superAdmin.tokenVersion,
    },
    env.JWT_ACCESS_SECRET,
    env.JWT_ACCESS_EXPIRES_IN,
  );

  return { accessToken };
};

/**
 * Changes the current agent's password and bumps tokenVersion,
 * invalidating every previously issued token for that agent.
 */
const changePassword = async (user: TJwtPayload, payload: TChangePasswordPayload) => {
  if (user.userType !== "agent") {
    const superAdmin = await prisma.superAdmin.findUniqueOrThrow({
      where: { publicId: user.id },
    });

    const isPasswordValid = await bcrypt.compare(payload.oldPassword, superAdmin.password);

    if (!isPasswordValid) {
      throw new AppError(httpStatus.UNAUTHORIZED, "Old password is incorrect");
    }

    const hashedPassword = await bcrypt.hash(payload.newPassword, env.BCRYPT_SALT_ROUNDS);

    await prisma.superAdmin.update({
      where: { publicId: user.id },
      data: { password: hashedPassword, tokenVersion: { increment: 1 } },
    });

    return null;
  }

  const agent = await prisma.agent.findUniqueOrThrow({
    where: { publicId: user.id },
  });

  const isPasswordValid = await bcrypt.compare(payload.oldPassword, agent.password);

  if (!isPasswordValid) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Old password is incorrect");
  }

  const hashedPassword = await bcrypt.hash(payload.newPassword, env.BCRYPT_SALT_ROUNDS);

  await prisma.agent.update({
    where: { publicId: user.id },
    data: { password: hashedPassword, tokenVersion: { increment: 1 } },
  });

  return null;
};

/**
 * Invalidates all outstanding tokens for the current user (logout-everywhere).
 */
const logout = async (user: TJwtPayload) => {
  if (user.userType === "agent") {
    await prisma.agent.update({
      where: { publicId: user.id },
      data: { tokenVersion: { increment: 1 } },
    });
  } else {
    await prisma.superAdmin.update({
      where: { publicId: user.id },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  return null;
};

const getMe = async (user: TJwtPayload) => {
  if (user.userType === "agent") {
    const agent = await prisma.agent.findUniqueOrThrow({
      where: { publicId: user.id },
      include: { company: true },
    });

    return {
      userType: "agent",
      publicId: agent.publicId,
      name: agent.name,
      email: agent.email,
      role: agent.role,
      isActive: agent.isActive,
      isOnline: agent.isOnline,
      company: {
        publicId: agent.company.publicId,
        name: agent.company.name,
        siteId: agent.company.siteId,
        plan: agent.company.plan,
      },
    };
  }

  const superAdmin = await prisma.superAdmin.findUniqueOrThrow({
    where: { publicId: user.id },
  });

  return {
    userType: "superadmin",
    publicId: superAdmin.publicId,
    name: superAdmin.name,
    email: superAdmin.email,
  };
};

export const AuthService = {
  registerCompany,
  loginAgent,
  loginSuperAdmin,
  refreshToken,
  changePassword,
  logout,
  getMe,
};
