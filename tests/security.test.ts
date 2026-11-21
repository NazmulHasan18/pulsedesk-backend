import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app.js";
import env from "../src/config/env.js";
import { prisma } from "../src/lib/prisma.js";
import { authenticateSocket, findJoinableConversation } from "../src/realtime/socket.server.js";
import { signToken } from "../src/utils/jwt.js";
import { agentToken, createTenant, deleteTenant, Tenant, widgetToken } from "./helpers.js";

let a: Tenant;
let b: Tenant;

beforeAll(async () => {
  a = await createTenant("a");
  b = await createTenant("b");
});

afterAll(async () => {
  await Promise.all([deleteTenant(a), deleteTenant(b)]);
  await prisma.$disconnect();
});

describe("smoke", () => {
  it("API root responds", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("widget HTTP auth", () => {
  const messagesUrl = (t: Tenant) => `/api/v1/widget/conversations/${t.conversation.id}/messages`;

  it("rejects a customer publicId used as the session token", async () => {
    const res = await request(app).get(messagesUrl(a)).set("x-widget-session-token", a.customer.publicId);
    expect(res.status).toBe(401);
  });

  it("rejects an agent access token used as a widget token", async () => {
    const res = await request(app).get(messagesUrl(a)).set("x-widget-session-token", agentToken(a.agent));
    expect(res.status).toBe(401);
  });

  it("lets a visitor read their own conversation", async () => {
    const res = await request(app).get(messagesUrl(a)).set("x-widget-session-token", widgetToken(a));
    expect(res.status).toBe(200);
  });

  it("blocks a visitor from another company's conversation", async () => {
    const res = await request(app).get(messagesUrl(b)).set("x-widget-session-token", widgetToken(a));
    expect(res.status).toBe(404);
  });

  it("ignores spoofed site/visitor headers", async () => {
    const res = await request(app)
      .get(messagesUrl(b))
      .set("x-widget-session-token", widgetToken(a))
      .set("x-site-id", b.company.siteId)
      .set("x-external-id", b.customer.externalId);
    expect(res.status).toBe(404);
  });

  it("no longer exposes the unauthenticated widget SSE stream", async () => {
    const res = await request(app).get(`/api/v1/realtime/sse/widget?siteId=${a.company.siteId}&externalId=x`);
    expect(res.status).toBe(404);
  });
});

describe("conversation assignment", () => {
  const assign = (t: Tenant, token: string) =>
    request(app)
      .patch(`/api/v1/conversations/${t.conversation.publicId}/assign`)
      .set("authorization", `Bearer ${token}`)
      .send({ agentId: t.agent.id });

  it("is forbidden for a regular agent", async () => {
    const res = await assign(a, agentToken(a.agent));
    expect(res.status).toBe(403);
  });

  it("is allowed for a company admin", async () => {
    const res = await assign(a, agentToken(a.admin));
    expect(res.status).toBe(200);
  });
});

describe("socket authentication", () => {
  it("accepts an active agent", async () => {
    const identity = await authenticateSocket({ token: agentToken(a.agent) });
    expect(identity).toEqual({
      actorType: "AGENT",
      actorId: a.agent.id,
      companyId: a.company.id,
      name: a.agent.name,
    });
  });

  it("rejects a deactivated agent", async () => {
    const deactivated = await prisma.agent.update({ where: { id: b.agent.id }, data: { isActive: false } });
    await expect(authenticateSocket({ token: agentToken(deactivated) })).rejects.toThrow();
    await prisma.agent.update({ where: { id: b.agent.id }, data: { isActive: true } });
  });

  it("rejects an agent token after logout (tokenVersion bumped)", async () => {
    const staleToken = agentToken(b.admin);
    await prisma.agent.update({ where: { id: b.admin.id }, data: { tokenVersion: { increment: 1 } } });
    await expect(authenticateSocket({ token: staleToken })).rejects.toThrow();
  });

  it("rejects a forged token", async () => {
    const forged = signToken(
      { id: a.agent.publicId, userType: "agent", role: "ADMIN", companyId: a.company.id, tokenVersion: 0 },
      "not-the-real-secret-value",
      "5m",
    );
    await expect(authenticateSocket({ token: forged })).rejects.toThrow();
  });

  it("rejects the old siteId + externalId handshake", async () => {
    await expect(
      authenticateSocket({ siteId: a.company.siteId, externalId: a.customer.externalId }),
    ).rejects.toThrow();
  });

  it("identifies a widget visitor from their widget token", async () => {
    const identity = await authenticateSocket({ widgetToken: widgetToken(a) });
    expect(identity).toEqual({ actorType: "CUSTOMER", actorId: a.customer.id, companyId: a.company.id });
  });
});

describe("socket conversation:join", () => {
  it("lets a visitor join only their own conversation", async () => {
    const visitor = await authenticateSocket({ widgetToken: widgetToken(a) });
    expect(await findJoinableConversation(visitor, a.conversation.id)).not.toBeNull();
    expect(await findJoinableConversation(visitor, b.conversation.id)).toBeNull();
  });

  it("blocks a visitor from another visitor's conversation in the same company", async () => {
    const otherCustomer = await prisma.customer.create({
      data: { externalId: `other-${a.company.id}`, companyId: a.company.id },
    });
    const otherConversation = await prisma.conversation.create({
      data: { companyId: a.company.id, customerId: otherCustomer.id },
    });

    const visitor = await authenticateSocket({ widgetToken: widgetToken(a) });
    expect(await findJoinableConversation(visitor, otherConversation.id)).toBeNull();
  });

  it("lets an agent join any conversation in their company, but not another company's", async () => {
    const agent = await authenticateSocket({ token: agentToken(a.agent) });
    expect(await findJoinableConversation(agent, a.conversation.publicId)).not.toBeNull();
    expect(await findJoinableConversation(agent, b.conversation.id)).toBeNull();
  });

  it("does not let a super-admin socket join conversation rooms", async () => {
    expect(
      await findJoinableConversation({ actorType: "SUPERADMIN", actorId: "x", companyId: null }, a.conversation.id),
    ).toBeNull();
  });
});

describe("environment", () => {
  it("uses a dedicated widget secret", () => {
    expect(env.WIDGET_SESSION_SECRET).not.toBe(env.JWT_ACCESS_SECRET);
  });
});
