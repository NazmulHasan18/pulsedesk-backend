import httpStatus from "http-status";
import { CompanyPlan, ConversationStatus, Prisma } from "@prisma/client";
import { OPEN_CONVERSATION_STATUSES } from "../conversation/conversation.constants.js";
import { prisma } from "../../lib/prisma.js";
import AppError from "../../utils/AppError.js";

import { mergeCompanySettings } from "./company.settings.js";
import { TCompanyListQuery, TCompanySettingsPayload, TUpdateCompanyPayload } from "./company.interface.js";

const buildCompanyWhere = (search?: string, plan?: CompanyPlan): Prisma.CompanyWhereInput => {
  const where: Prisma.CompanyWhereInput = {};

  if (search) {
    where.OR = [
      {
        name: {
          contains: search,
          mode: Prisma.QueryMode.insensitive,
        },
      },
      {
        siteId: {
          contains: search,
          mode: Prisma.QueryMode.insensitive,
        },
      },
      {
        publicId: {
          contains: search,
          mode: Prisma.QueryMode.insensitive,
        },
      },
    ];
  }

  if (plan) {
    where.plan = plan;
  }

  return where;
};

const formatCompany = (company: {
  publicId: string;
  name: string;
  siteId: string;
  plan: CompanyPlan | null;
  settings: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}) => {
  return {
    publicId: company.publicId,
    name: company.name,
    siteId: company.siteId,
    plan: company.plan,
    settings: company.settings,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
  };
};

const listCompanies = async (query: TCompanyListQuery) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;
  const where = buildCompanyWhere(query.search);

  const [total, companies] = await prisma.$transaction([
    prisma.company.count({ where }),
    prisma.company.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            agents: true,
            customers: true,
            conversations: true,
            faqDocs: true,
          },
        },
      },
    }),
  ]);

  return {
    meta: { page, limit, total },
    data: companies.map((company) => ({
      ...formatCompany(company),
      counts: company._count,
    })),
  };
};

const getCompanyByPublicId = async (publicId: string) => {
  const company = await prisma.company.findUnique({
    where: { publicId },
    include: {
      _count: {
        select: {
          agents: true,
          customers: true,
          conversations: true,
          faqDocs: true,
        },
      },
    },
  });

  if (!company) {
    throw new AppError(httpStatus.NOT_FOUND, "Company not found");
  }

  return {
    ...formatCompany(company),
    counts: company._count,
  };
};

const updateCompany = async (publicId: string, payload: TUpdateCompanyPayload) => {
  const company = await prisma.company.findUnique({ where: { publicId } });

  if (!company) {
    throw new AppError(httpStatus.NOT_FOUND, "Company not found");
  }

  const updated = await prisma.company.update({
    where: { publicId },
    data: {
      ...(payload.name ? { name: payload.name } : {}),
      ...(payload.plan ? { plan: payload.plan } : {}),
      ...(payload.settings ? { settings: mergeCompanySettings(company.settings, payload.settings) } : {}),
    },
  });

  return formatCompany(updated);
};

const updateCompanySettings = async (publicId: string, payload: TCompanySettingsPayload) => {
  return updateCompany(publicId, { settings: payload.settings });
};

const deleteCompany = async (publicId: string) => {
  const company = await prisma.company.findUnique({ where: { publicId } });

  if (!company) {
    throw new AppError(httpStatus.NOT_FOUND, "Company not found");
  }

  await prisma.$transaction([
    prisma.conversationNote.deleteMany({ where: { conversation: { companyId: company.id } } }),
    prisma.company.delete({ where: { publicId } }),
  ]);

  return null;
};

const buildStats = async (companyId: string) => {
  const conversationIds = await prisma.conversation.findMany({
    where: { companyId },
    select: { id: true },
  });

  const [
    totalAgents,
    activeAgents,
    inactiveAgents,
    totalCustomers,
    totalConversations,
    conversationsByStatus,
    totalFaqDocs,
  ] = await Promise.all([
    prisma.agent.count({ where: { companyId } }),
    prisma.agent.count({ where: { companyId, isActive: true } }),
    prisma.agent.count({ where: { companyId, isActive: false } }),
    prisma.customer.count({ where: { companyId } }),
    prisma.conversation.count({ where: { companyId } }),
    prisma.conversation.groupBy({ by: ["status"], where: { companyId }, _count: true }),
    prisma.faqDoc.count({ where: { companyId } }),
  ]);

  const totalMessages = conversationIds.length
    ? await prisma.message.count({
        where: {
          conversationId: {
            in: conversationIds.map((conversation) => conversation.id),
          },
        },
      })
    : 0;

  const countStatuses = (...statuses: ConversationStatus[]) =>
    conversationsByStatus
      .filter((row) => statuses.includes(row.status))
      .reduce((sum, row) => sum + row._count, 0);

  return {
    agents: {
      total: totalAgents,
      active: activeAgents,
      inactive: inactiveAgents,
    },
    customers: totalCustomers,
    conversations: {
      total: totalConversations,
      open: countStatuses(...OPEN_CONVERSATION_STATUSES),
      waiting: countStatuses(ConversationStatus.WAITING),
      active: countStatuses(ConversationStatus.ACTIVE),
      aiHandled: countStatuses(ConversationStatus.AI_HANDLED),
      resolved: countStatuses(ConversationStatus.RESOLVED),
      closed: countStatuses(ConversationStatus.CLOSED),
    },
    messages: totalMessages,
    faqDocs: totalFaqDocs,
  };
};

const getCompanyStatsByPublicId = async (publicId: string) => {
  const company = await prisma.company.findUnique({
    where: { publicId },
    select: { id: true, publicId: true, name: true, siteId: true, plan: true, settings: true },
  });

  if (!company) {
    throw new AppError(httpStatus.NOT_FOUND, "Company not found");
  }

  const stats = await buildStats(company.id);

  return {
    company: {
      publicId: company.publicId,
      name: company.name,
      siteId: company.siteId,
      plan: company.plan,
      settings: company.settings,
    },
    stats,
  };
};

const getMyCompany = async (companyId: string) => {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      _count: {
        select: {
          agents: true,
          customers: true,
          conversations: true,
          faqDocs: true,
        },
      },
    },
  });

  if (!company) {
    throw new AppError(httpStatus.NOT_FOUND, "Company not found");
  }

  return {
    ...formatCompany(company),
    counts: company._count,
  };
};

const updateMyCompany = async (companyId: string, payload: TUpdateCompanyPayload) => {
  const company = await prisma.company.findUnique({ where: { id: companyId } });

  if (!company) {
    throw new AppError(httpStatus.NOT_FOUND, "Company not found");
  }

  const updated = await prisma.company.update({
    where: { id: companyId },
    data: {
      ...(payload.name ? { name: payload.name } : {}),
      ...(payload.plan ? { plan: payload.plan } : {}),
      ...(payload.settings ? { settings: mergeCompanySettings(company.settings, payload.settings) } : {}),
    },
  });

  return formatCompany(updated);
};

const updateMyCompanySettings = async (companyId: string, payload: TCompanySettingsPayload) => {
  return updateMyCompany(companyId, { settings: payload.settings });
};

const getMyCompanyStats = async (companyId: string) => {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, publicId: true, name: true, siteId: true, plan: true, settings: true },
  });

  if (!company) {
    throw new AppError(httpStatus.NOT_FOUND, "Company not found");
  }

  const stats = await buildStats(company.id);

  return {
    company: {
      publicId: company.publicId,
      name: company.name,
      siteId: company.siteId,
      plan: company.plan,
      settings: company.settings,
    },
    stats,
  };
};

export const CompanyService = {
  listCompanies,
  getCompanyByPublicId,
  updateCompany,
  updateCompanySettings,
  deleteCompany,
  getCompanyStatsByPublicId,
  getMyCompany,
  updateMyCompany,
  updateMyCompanySettings,
  getMyCompanyStats,
};
