import { ConversationPriority, ConversationSource, ConversationStatus } from '@prisma/client';

export type StatusCounts = Record<ConversationStatus, number>;
export type SourceCounts = Record<ConversationSource, number>;
export type PriorityCounts = Record<ConversationPriority, number>;

export interface DashboardOverview {
  conversations: {
    total: number;
    byStatus: StatusCounts;
    bySource: SourceCounts;
    byPriority: PriorityCounts;
    unassignedOpen: number;
  };
  agents: {
    total: number;
    online: number;
  };
  customers: {
    total: number;
  };
}

export interface AgentWorkloadItem {
  agentId: string;
  publicId: string;
  name: string;
  email: string;
  isOnline: boolean;
  isActive: boolean;
  assigned: {
    total: number;
    byStatus: StatusCounts;
  };
}

export interface AnalyticsQuery {
  days?: number;
}

export interface AnalyticsDayBucket {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface AnalyticsResult {
  rangeDays: number;
  conversationsCreated: {
    total: number;
    byDay: AnalyticsDayBucket[];
  };
  byPriority: PriorityCounts;
  bySource: SourceCounts;
  byStatus: StatusCounts;
  topLabels: { label: string; count: number }[];
}

export interface PlatformCompanyBreakdown {
  companyId: string;
  publicId: string;
  name: string;
  plan: string;
  agents: number;
  customers: number;
  conversations: number;
}

export interface PlatformOverview {
  totals: {
    companies: number;
    agents: number;
    customers: number;
    conversations: number;
  };
  companies: PlatformCompanyBreakdown[];
}
