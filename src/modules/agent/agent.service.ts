import bcrypt from "bcrypt";
import httpStatus from "http-status";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import AppError from "../../utils/AppError";
import env from "../../config/env";
import generateTemporaryPassword from "../../utils/generateTemporaryPassword";
import {
  TAgentListQuery,
  TAgentStatusPayload,
  TCreateAgentPayload,
  TInviteAgentPayload,
  TUpdateAgentPayload,
} from "./agent.interface";

const buildAgentWhere = (companyId: string, query: TAgentListQuery): Prisma.AgentWhereInput => {
  console.log(query);
  const where: Prisma.AgentWhereInput = {
    companyId,
  };

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { email: { contains: query.search, mode: "insensitive" } },
      { publicId: { contains: query.search, mode: "insensitive" } },
    ];
  }

  if (query.role) {
    where.role = query.role;
  }

  if (query.isActive === "true") {
    where.isActive = true;
  } else if (query.isActive === "false") {
    where.isActive = false;
  }

  return where;
};

const formatAgent = (agent: {
  publicId: string;
  name: string;
  email: string;
  role: "ADMIN" | "AGENT";
  isActive: boolean;
  isOnline: boolean;
  createdAt: Date;
  updatedAt: Date;
}) => {
  return {
    publicId: agent.publicId,
    name: agent.name,
    email: agent.email,
    role: agent.role,
    isActive: agent.isActive,
    isOnline: agent.isOnline,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
  };
};

const ensureEmailAvailable = async (email: string, currentAgentId?: string) => {
  const existing = await prisma.agent.findUnique({
    where: { email },
  });

  if (existing && existing.publicId !== currentAgentId) {
    throw new AppError(httpStatus.CONFLICT, "Email is already in use");
  }
};

const createAgentInternal = async (
  companyId: string,
  payload: TCreateAgentPayload | TInviteAgentPayload,
  password: string,
) => {
  await ensureEmailAvailable(payload.email);

  const hashedPassword = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);

  const agent = await prisma.agent.create({
    data: {
      name: payload.name,
      email: payload.email,
      password: hashedPassword,
      role: payload.role ?? "AGENT",
      companyId,
    },
  });

  return formatAgent(agent);
};

const createAgent = async (companyId: string, payload: TCreateAgentPayload) => {
  return createAgentInternal(companyId, payload, payload.password);
};

const inviteAgent = async (companyId: string, payload: TInviteAgentPayload) => {
  const tempPassword = generateTemporaryPassword();
  const agent = await createAgentInternal(companyId, payload, tempPassword);

  return {
    agent,
    tempPassword,
  };
};

const listAgents = async (companyId: string, query: TAgentListQuery) => {
  const page = Number(query.page) ?? 1;
  const limit = Number(query.limit) ?? 10;
  const skip = (page - 1) * limit;
  const where = buildAgentWhere(companyId, query);

  const [total, agents] = await prisma.$transaction([
    prisma.agent.count({ where }),
    prisma.agent.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    meta: { page, limit, total },
    data: agents.map(formatAgent),
  };
};

const getAgent = async (companyId: string, agentPublicId: string) => {
  const agent = await prisma.agent.findUnique({
    where: { publicId: agentPublicId },
  });

  if (!agent || agent.companyId !== companyId) {
    throw new AppError(httpStatus.NOT_FOUND, "Agent not found");
  }

  return formatAgent(agent);
};

const updateAgent = async (companyId: string, agentPublicId: string, payload: TUpdateAgentPayload) => {
  const agent = await prisma.agent.findUnique({
    where: { publicId: agentPublicId },
  });

  if (!agent || agent.companyId !== companyId) {
    throw new AppError(httpStatus.NOT_FOUND, "Agent not found");
  }

  if (payload.email) {
    await ensureEmailAvailable(payload.email, agent.publicId);
  }

  const updated = await prisma.agent.update({
    where: { publicId: agentPublicId },
    data: {
      ...(payload.name ? { name: payload.name } : {}),
      ...(payload.email ? { email: payload.email } : {}),
      ...(payload.role ? { role: payload.role } : {}),
    },
  });

  return formatAgent(updated);
};

const deleteAgent = async (companyId: string, agentPublicId: string, currentAgentPublicId: string) => {
  if (agentPublicId === currentAgentPublicId) {
    throw new AppError(httpStatus.BAD_REQUEST, "You cannot delete your own account");
  }

  const agent = await prisma.agent.findUnique({
    where: { publicId: agentPublicId },
  });

  if (!agent || agent.companyId !== companyId) {
    throw new AppError(httpStatus.NOT_FOUND, "Agent not found");
  }

  await prisma.agent.delete({
    where: { publicId: agentPublicId },
  });

  return null;
};

const setAgentStatus = async (
  companyId: string,
  agentPublicId: string,
  currentAgentPublicId: string,
  payload: TAgentStatusPayload,
) => {
  if (agentPublicId === currentAgentPublicId) {
    throw new AppError(httpStatus.BAD_REQUEST, "You cannot change your own activation status");
  }

  const agent = await prisma.agent.findUnique({
    where: { publicId: agentPublicId },
  });

  if (!agent || agent.companyId !== companyId) {
    throw new AppError(httpStatus.NOT_FOUND, "Agent not found");
  }

  const updated = await prisma.agent.update({
    where: { publicId: agentPublicId },
    data: {
      isActive: payload.isActive,
      ...(payload.isActive ? {} : { tokenVersion: { increment: 1 } }),
    },
  });

  return formatAgent(updated);
};

const resetPassword = async (companyId: string, agentPublicId: string, currentAgentPublicId: string) => {
  if (agentPublicId === currentAgentPublicId) {
    throw new AppError(httpStatus.BAD_REQUEST, "You cannot reset your own password here");
  }

  const agent = await prisma.agent.findUnique({
    where: { publicId: agentPublicId },
  });

  if (!agent || agent.companyId !== companyId) {
    throw new AppError(httpStatus.NOT_FOUND, "Agent not found");
  }

  const tempPassword = generateTemporaryPassword();
  const hashedPassword = await bcrypt.hash(tempPassword, env.BCRYPT_SALT_ROUNDS);

  const updated = await prisma.agent.update({
    where: { publicId: agentPublicId },
    data: {
      password: hashedPassword,
      tokenVersion: { increment: 1 },
    },
  });

  return {
    agent: formatAgent(updated),
    tempPassword,
  };
};

export const AgentService = {
  createAgent,
  inviteAgent,
  listAgents,
  getAgent,
  updateAgent,
  deleteAgent,
  setAgentStatus,
  resetPassword,
};
