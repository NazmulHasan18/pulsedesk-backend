import httpStatus from 'http-status';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import AppError from '../../utils/AppError';
import generateSiteId from '../../utils/generateSiteId';
import { TCompanyListQuery, TCompanySettingsPayload, TCreateCompanyPayload, TUpdateCompanyPayload } from './company.interface';

const buildCompanyWhere = (search?: string): Prisma.CompanyWhereInput => {
  if (!search) {
    return {};
  }

  return {
    OR: [
      { name: { contains: search, mode: 'insensitive' } },
      { siteId: { contains: search, mode: 'insensitive' } },
      { plan: { contains: search, mode: 'insensitive' } },
      { publicId: { contains: search, mode: 'insensitive' } },
    ],
  };
};

const formatCompany = (company: {
  publicId: string;
  name: string;
  siteId: string;
  plan: string;
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

const ensureUniqueSiteId = async () => {
  let siteId = generateSiteId();

  // eslint-disable-next-line no-await-in-loop
  while (await prisma.company.findUnique({ where: { siteId } })) {
    siteId = generateSiteId();
  }

  return siteId;
};

const createCompany = async (payload: TCreateCompanyPayload) => {
  const siteId = await ensureUniqueSiteId();

  const company = await prisma.company.create({
    data: {
      name: payload.name,
      plan: payload.plan ?? 'free',
      settings: payload.settings,
      siteId,
    },
  });

  return formatCompany(company);
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
      take: limit,
      orderBy: { createdAt: 'desc' },
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
    throw new AppError(httpStatus.NOT_FOUND, 'Company not found');
  }

  return {
    ...formatCompany(company),
    counts: company._count,
  };
};

const updateCompany = async (publicId: string, payload: TUpdateCompanyPayload) => {
  const company = await prisma.company.findUnique({ where: { publicId } });

  if (!company) {
    throw new AppError(httpStatus.NOT_FOUND, 'Company not found');
  }

  const updated = await prisma.company.update({
    where: { publicId },
    data: {
      ...(payload.name ? { name: payload.name } : {}),
      ...(payload.plan ? { plan: payload.plan } : {}),
      ...(payload.settings ? { settings: payload.settings } : {}),
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
    throw new AppError(httpStatus.NOT_FOUND, 'Company not found');
  }

  await prisma.company.delete({ where: { publicId } });

  return null;
};

const buildStats = async (companyId: string) => {
  const conversationIds = await prisma.conversation.findMany({
    where: { companyId },
    select: { id: true },
  });

  const [totalAgents, activeAgents, inactiveAgents, totalCustomers, totalConversations, openConversations, pendingConversations, closedConversations, totalFaqDocs] = await Promise.all([
    prisma.agent.count({ where: { companyId } }),
    prisma.agent.count({ where: { companyId, isActive: true } }),
    prisma.agent.count({ where: { companyId, isActive: false } }),
    prisma.customer.count({ where: { companyId } }),
    prisma.conversation.count({ where: { companyId } }),
    prisma.conversation.count({ where: { companyId, status: 'OPEN' } }),
    prisma.conversation.count({ where: { companyId, status: 'PENDING' } }),
    prisma.conversation.count({ where: { companyId, status: 'CLOSED' } }),
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

  return {
    agents: {
      total: totalAgents,
      active: activeAgents,
      inactive: inactiveAgents,
    },
    customers: totalCustomers,
    conversations: {
      total: totalConversations,
      open: openConversations,
      pending: pendingConversations,
      closed: closedConversations,
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
    throw new AppError(httpStatus.NOT_FOUND, 'Company not found');
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
    throw new AppError(httpStatus.NOT_FOUND, 'Company not found');
  }

  return {
    ...formatCompany(company),
    counts: company._count,
  };
};

const updateMyCompany = async (companyId: string, payload: TUpdateCompanyPayload) => {
  const company = await prisma.company.findUnique({ where: { id: companyId } });

  if (!company) {
    throw new AppError(httpStatus.NOT_FOUND, 'Company not found');
  }

  const updated = await prisma.company.update({
    where: { id: companyId },
    data: {
      ...(payload.name ? { name: payload.name } : {}),
      ...(payload.plan ? { plan: payload.plan } : {}),
      ...(payload.settings ? { settings: payload.settings } : {}),
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
    throw new AppError(httpStatus.NOT_FOUND, 'Company not found');
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
  createCompany,
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
