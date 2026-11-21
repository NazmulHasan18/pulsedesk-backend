import { createHash, randomBytes, randomUUID } from "node:crypto";
import httpStatus from "http-status";
import { prisma } from "../../lib/prisma.js";
import env from "../../config/env.js";
import AppError from "../../utils/AppError.js";
import { signWidgetToken } from "../../utils/jwt.js";
import { isOriginAllowed, resolveWidgetSettings } from "../company/company.settings.js";
import { ConversationService } from "../conversation/conversation.service.js";
import { OPEN_CONVERSATION_STATUSES } from "../conversation/conversation.constants.js";
import { areAgentsOnline } from "../../realtime/presence.js";

export const hashVisitorKey = (visitorKey: string) => createHash("sha256").update(visitorKey).digest("hex");

const assertOriginAllowed = (origin: string | undefined, allowedOrigins: string[]) => {
  if (!isOriginAllowed(origin, allowedOrigins)) {
    throw new AppError(httpStatus.FORBIDDEN, "This website is not allowed to use this chat widget");
  }
};

const findCompanyBySiteId = async (siteId: string) => {
  const company = await prisma.company.findUnique({
    where: { siteId },
    select: { id: true, siteId: true, name: true, settings: true },
  });

  if (!company) {
    throw new AppError(httpStatus.NOT_FOUND, "Unknown site");
  }

  return company;
};

// Public, unauthenticated: only what the widget needs to render. Never secrets.
const getConfig = async (siteId: string, origin?: string) => {
  const company = await findCompanyBySiteId(siteId);
  const settings = resolveWidgetSettings(company);
  assertOriginAllowed(origin, settings.allowedOrigins);

  return {
    siteId: company.siteId,
    displayName: settings.displayName,
    welcomeMessage: settings.welcomeMessage,
    primaryColor: settings.primaryColor,
    secondaryColor: settings.secondaryColor,
    widgetEnabled: settings.widgetEnabled,
    // Live updates arrive over the socket as widget:availability.
    agentsOnline: await areAgentsOnline(company.id),
  };
};

// Creates a new guest visitor, or restores an existing one from the
// visitorKey the widget stored on a previous visit. Always returns a fresh
// short-lived session token.
const createSession = async (payload: { siteId: string; visitorKey?: string }, origin?: string) => {
  const company = await findCompanyBySiteId(payload.siteId);
  const settings = resolveWidgetSettings(company);
  assertOriginAllowed(origin, settings.allowedOrigins);

  if (!settings.widgetEnabled) {
    throw new AppError(httpStatus.FORBIDDEN, "Chat is currently disabled for this website");
  }

  let visitorKey = payload.visitorKey;
  let customer = visitorKey
    ? await prisma.customer.findFirst({
        where: { companyId: company.id, visitorKeyHash: hashVisitorKey(visitorKey) },
        select: { id: true, publicId: true },
      })
    : null;

  const isNewVisitor = !customer;

  if (!customer) {
    visitorKey = randomBytes(32).toString("base64url");
    customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        externalId: `guest_${randomUUID()}`,
        visitorKeyHash: hashVisitorKey(visitorKey),
      },
      select: { id: true, publicId: true },
    });
  }

  const sessionToken = signWidgetToken(
    { companyId: company.id, customerId: customer.id },
    env.WIDGET_SESSION_SECRET,
    env.WIDGET_SESSION_EXPIRES_IN,
  );

  return {
    sessionToken,
    expiresIn: env.WIDGET_SESSION_EXPIRES_IN,
    visitorKey: visitorKey as string,
    isNewVisitor,
    customer: { publicId: customer.publicId },
  };
};

// What a visitor may see about their own conversation.
const toPublicConversation = (conversation: {
  publicId: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  assignedAgent: { name: string } | null;
}) => ({
  publicId: conversation.publicId,
  status: conversation.status,
  agent: conversation.assignedAgent ? { name: conversation.assignedAgent.name } : null,
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt,
});

const openConversation = async (companyId: string, customerId: string) => {
  const conversation = await ConversationService.createOrOpenConversation(companyId, customerId);
  return toPublicConversation(conversation);
};

const getActiveConversation = async (companyId: string, customerId: string) => {
  const conversation = await prisma.conversation.findFirst({
    where: { companyId, customerId, status: { in: OPEN_CONVERSATION_STATUSES } },
    orderBy: { updatedAt: "desc" },
    include: { assignedAgent: { select: { name: true } } },
  });

  return conversation ? toPublicConversation(conversation) : null;
};

export const WidgetService = { getConfig, createSession, openConversation, getActiveConversation };
