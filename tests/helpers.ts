import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma.js";
import env from "../src/config/env.js";
import { signToken, signWidgetToken } from "../src/utils/jwt.js";

// Creates an isolated company with one admin, one agent, one customer and one
// conversation. Everything hangs off the company, so deleting it cleans up.
export const createTenant = async (label: string) => {
  const tag = `${label}-${randomUUID().slice(0, 8)}`;

  const company = await prisma.company.create({
    data: { name: `Test ${tag}`, siteId: `site_${tag}`, email: `${tag}@test.local` },
  });

  const makeAgent = (role: "ADMIN" | "AGENT") =>
    prisma.agent.create({
      data: {
        name: `${role} ${tag}`,
        email: `${role.toLowerCase()}-${tag}@test.local`,
        password: "not-used-in-tests",
        role,
        companyId: company.id,
      },
    });

  const admin = await makeAgent("ADMIN");
  const agent = await makeAgent("AGENT");

  const customer = await prisma.customer.create({
    data: { externalId: `visitor-${tag}`, companyId: company.id },
  });

  const conversation = await prisma.conversation.create({
    data: { companyId: company.id, customerId: customer.id },
  });

  return { company, admin, agent, customer, conversation };
};

export type Tenant = Awaited<ReturnType<typeof createTenant>>;

export const deleteTenant = (tenant: Tenant) => prisma.company.delete({ where: { id: tenant.company.id } });

export const agentToken = (agent: Tenant["agent"]) =>
  signToken(
    {
      id: agent.publicId,
      userType: "agent",
      role: agent.role,
      companyId: agent.companyId,
      tokenVersion: agent.tokenVersion,
    },
    env.JWT_ACCESS_SECRET,
    "5m",
  );

export const widgetToken = (tenant: Tenant) =>
  signWidgetToken({ companyId: tenant.company.id, customerId: tenant.customer.id }, env.WIDGET_SESSION_SECRET, "5m");
