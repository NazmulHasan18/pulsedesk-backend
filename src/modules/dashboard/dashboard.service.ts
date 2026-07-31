import { ConversationPriority, ConversationSource, ConversationStatus, Prisma } from "@prisma/client";
import {
  AgentWorkloadItem,
  AnalyticsDayBucket,
  AnalyticsResult,
  DashboardOverview,
  PlatformCompanyBreakdown,
  PlatformOverview,
  PriorityCounts,
  SourceCounts,
  StatusCounts,
} from "./dashboard.interface";
import { prisma } from "../../lib/prisma";

// ---------- helpers: zero-fill enum-keyed count maps ----------

const zeroStatusCounts = (): StatusCounts => ({
  OPEN: 0,
  PENDING: 0,
  CLOSED: 0,
});

const zeroSourceCounts = (): SourceCounts => ({
  AI: 0,
  AGENT: 0,
});

const zeroPriorityCounts = (): PriorityCounts => ({
  LOW: 0,
  MEDIUM: 0,
  HIGH: 0,
  URGENT: 0,
});

const fillStatusCounts = (rows: { status: ConversationStatus; _count: number }[]): StatusCounts => {
  const out = zeroStatusCounts();
  rows.forEach((r) => {
    out[r.status] = r._count;
  });
  return out;
};

const fillSourceCounts = (rows: { source: ConversationSource; _count: number }[]): SourceCounts => {
  const out = zeroSourceCounts();
  rows.forEach((r) => {
    out[r.source] = r._count;
  });
  return out;
};

const fillPriorityCounts = (rows: { priority: ConversationPriority; _count: number }[]): PriorityCounts => {
  const out = zeroPriorityCounts();
  rows.forEach((r) => {
    out[r.priority] = r._count;
  });
  return out;
};

// ---------- overview ----------

const getOverview = async (companyId: string): Promise<DashboardOverview> => {
  const [
    statusRows,
    sourceRows,
    priorityRows,
    totalConversations,
    unassignedOpen,
    totalAgents,
    onlineAgents,
    totalCustomers,
  ] = await Promise.all([
    prisma.conversation.groupBy({
      by: ["status"],
      where: { companyId },
      _count: true,
    }),
    prisma.conversation.groupBy({
      by: ["source"],
      where: { companyId },
      _count: true,
    }),
    prisma.conversation.groupBy({
      by: ["priority"],
      where: { companyId },
      _count: true,
    }),
    prisma.conversation.count({ where: { companyId } }),
    prisma.conversation.count({
      where: {
        companyId,
        assignedAgentId: null,
        status: { not: ConversationStatus.CLOSED },
      },
    }),
    prisma.agent.count({ where: { companyId, isActive: true } }),
    prisma.agent.count({ where: { companyId, isActive: true, isOnline: true } }),
    prisma.customer.count({ where: { companyId } }),
  ]);

  return {
    conversations: {
      total: totalConversations,
      byStatus: fillStatusCounts(statusRows.map((r) => ({ status: r.status, _count: r._count }))),
      bySource: fillSourceCounts(sourceRows.map((r) => ({ source: r.source, _count: r._count }))),
      byPriority: fillPriorityCounts(priorityRows.map((r) => ({ priority: r.priority, _count: r._count }))),
      unassignedOpen,
    },
    agents: {
      total: totalAgents,
      online: onlineAgents,
    },
    customers: {
      total: totalCustomers,
    },
  };
};

// ---------- agent workload ----------

const getAgentWorkload = async (companyId: string): Promise<AgentWorkloadItem[]> => {
  const agents = await prisma.agent.findMany({
    where: { companyId, isActive: true },
    select: {
      id: true,
      publicId: true,
      name: true,
      email: true,
      isOnline: true,
      isActive: true,
    },
    orderBy: { name: "asc" },
  });

  if (agents.length === 0) return [];

  const agentIds = agents.map((a) => a.id);

  const grouped = await prisma.conversation.groupBy({
    by: ["assignedAgentId", "status"],
    where: { companyId, assignedAgentId: { in: agentIds } },
    _count: true,
  });

  const byAgent = new Map<string, StatusCounts>();
  agentIds.forEach((id) => byAgent.set(id, zeroStatusCounts()));

  grouped.forEach((row) => {
    if (!row.assignedAgentId) return;
    const counts = byAgent.get(row.assignedAgentId) ?? zeroStatusCounts();
    counts[row.status] = row._count;
    byAgent.set(row.assignedAgentId, counts);
  });

  return agents.map((agent) => {
    const byStatus = byAgent.get(agent.id) ?? zeroStatusCounts();
    const total = byStatus.OPEN + byStatus.PENDING + byStatus.CLOSED;
    return {
      agentId: agent.id,
      publicId: agent.publicId,
      name: agent.name,
      email: agent.email,
      isOnline: agent.isOnline,
      isActive: agent.isActive,
      assigned: { total, byStatus },
    };
  });
};

// ---------- analytics ----------

const MAX_ANALYTICS_DAYS = 90;
const DEFAULT_ANALYTICS_DAYS = 7;

const getAnalytics = async (companyId: string, daysInput?: number): Promise<AnalyticsResult> => {
  const rangeDays = Math.min(Math.max(daysInput ?? DEFAULT_ANALYTICS_DAYS, 1), MAX_ANALYTICS_DAYS);

  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (rangeDays - 1));

  const [statusRows, sourceRows, priorityRows, total, dailyRows, labelRows] = await Promise.all([
    prisma.conversation.groupBy({
      by: ["status"],
      where: { companyId, createdAt: { gte: since } },
      _count: true,
    }),
    prisma.conversation.groupBy({
      by: ["source"],
      where: { companyId, createdAt: { gte: since } },
      _count: true,
    }),
    prisma.conversation.groupBy({
      by: ["priority"],
      where: { companyId, createdAt: { gte: since } },
      _count: true,
    }),
    prisma.conversation.count({
      where: { companyId, createdAt: { gte: since } },
    }),
    // Postgres-specific day bucketing — more efficient than pulling every row into JS.
    prisma.$queryRaw<{ day: Date; count: bigint }[]>(
      Prisma.sql`
          SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS count
          FROM "conversations"
          WHERE "companyId" = ${companyId} AND "createdAt" >= ${since}
          GROUP BY day
          ORDER BY day ASC
        `,
    ),
    prisma.$queryRaw<{ label: string; count: bigint }[]>(
      Prisma.sql`
          SELECT label, COUNT(*)::bigint AS count
          FROM "conversations", unnest(labels) AS label
          WHERE "companyId" = ${companyId} AND "createdAt" >= ${since}
          GROUP BY label
          ORDER BY count DESC
          LIMIT 10
        `,
    ),
  ]);

  // Zero-fill every day in the range so the frontend gets a continuous series.
  const dayMap = new Map<string, number>();
  for (let i = 0; i < rangeDays; i += 1) {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    dayMap.set(d.toISOString().slice(0, 10), 0);
  }
  dailyRows.forEach((row) => {
    const key = new Date(row.day).toISOString().slice(0, 10);
    dayMap.set(key, Number(row.count));
  });
  const byDay: AnalyticsDayBucket[] = Array.from(dayMap.entries()).map(([date, count]) => ({ date, count }));

  return {
    rangeDays,
    conversationsCreated: { total, byDay },
    byPriority: fillPriorityCounts(priorityRows.map((r) => ({ priority: r.priority, _count: r._count }))),
    bySource: fillSourceCounts(sourceRows.map((r) => ({ source: r.source, _count: r._count }))),
    byStatus: fillStatusCounts(statusRows.map((r) => ({ status: r.status, _count: r._count }))),
    topLabels: labelRows.map((r) => ({ label: r.label, count: Number(r.count) })),
  };
};

// ---------- platform (superadmin) ----------

const getPlatformOverview = async (): Promise<PlatformOverview> => {
  const [companies, totalAgents, totalCustomers, totalConversations] = await Promise.all([
    prisma.company.findMany({
      select: { id: true, publicId: true, name: true, plan: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.agent.count(),
    prisma.customer.count(),
    prisma.conversation.count(),
  ]);

  const [agentCounts, customerCounts, conversationCounts] = await Promise.all([
    prisma.agent.groupBy({ by: ["companyId"], _count: true }),
    prisma.customer.groupBy({ by: ["companyId"], _count: true }),
    prisma.conversation.groupBy({ by: ["companyId"], _count: true }),
  ]);

  const agentMap = new Map(agentCounts.map((r) => [r.companyId, r._count]));
  const customerMap = new Map(customerCounts.map((r) => [r.companyId, r._count]));
  const conversationMap = new Map(conversationCounts.map((r) => [r.companyId, r._count]));

  const breakdown: PlatformCompanyBreakdown[] = companies.map((c) => ({
    companyId: c.id,
    publicId: c.publicId,
    name: c.name,
    plan: c.plan,
    agents: agentMap.get(c.id) ?? 0,
    customers: customerMap.get(c.id) ?? 0,
    conversations: conversationMap.get(c.id) ?? 0,
  }));

  return {
    totals: {
      companies: companies.length,
      agents: totalAgents,
      customers: totalCustomers,
      conversations: totalConversations,
    },
    companies: breakdown,
  };
};

export const DashboardService = {
  getOverview,
  getAgentWorkload,
  getAnalytics,
  getPlatformOverview,
};
