import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { hashVisitorKey } from "../src/modules/widget/widget.service.js";
import { agentToken, createTenant, deleteTenant, Tenant } from "./helpers.js";

let a: Tenant;
let b: Tenant;

beforeAll(async () => {
  a = await createTenant("wa");
  b = await createTenant("wb");
});

afterAll(async () => {
  await Promise.all([deleteTenant(a), deleteTenant(b)]);
  await prisma.$disconnect();
});

const setSettings = (t: Tenant, settings: object) =>
  prisma.company.update({ where: { id: t.company.id }, data: { settings } });

const startSession = (siteId: string, visitorKey?: string, origin?: string) => {
  const req = request(app).post("/api/v1/widget/sessions");
  if (origin) req.set("origin", origin);
  return req.send({ siteId, ...(visitorKey ? { visitorKey } : {}) });
};

const asVisitor = (token: string) => ({
  open: () => request(app).post("/api/v1/widget/conversations").set("x-widget-session-token", token),
  active: () => request(app).get("/api/v1/widget/conversations/active").set("x-widget-session-token", token),
  send: (conversationId: string, content: string) =>
    request(app)
      .post(`/api/v1/widget/conversations/${conversationId}/messages`)
      .set("x-widget-session-token", token)
      .send({ content }),
  messages: (conversationId: string) =>
    request(app)
      .get(`/api/v1/widget/conversations/${conversationId}/messages`)
      .set("x-widget-session-token", token),
});

describe("GET /widget/config", () => {
  it("returns 404 for an unknown siteId", async () => {
    const res = await request(app).get("/api/v1/widget/config?siteId=does-not-exist");
    expect(res.status).toBe(404);
  });

  it("returns 400 without a siteId", async () => {
    const res = await request(app).get("/api/v1/widget/config");
    expect(res.status).toBe(400);
  });

  it("returns defaults and only public fields", async () => {
    await setSettings(a, { supportEmail: "secret@test.local", allowedOrigins: [] });
    const res = await request(app).get(`/api/v1/widget/config?siteId=${a.company.siteId}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      siteId: a.company.siteId,
      displayName: a.company.name,
      welcomeMessage: expect.any(String),
      primaryColor: "#4B4FE0",
      secondaryColor: expect.stringMatching(/^#[0-9A-F]{6}$/i),
      widgetEnabled: true,
      agentsOnline: false,
    });
  });
});

describe("POST /widget/sessions", () => {
  it("creates a guest and stores only a hash of the visitor key", async () => {
    const res = await startSession(a.company.siteId);

    expect(res.status).toBe(201);
    expect(res.body.data.isNewVisitor).toBe(true);
    expect(res.body.data.sessionToken).toEqual(expect.any(String));
    expect(res.body.data.visitorKey.length).toBeGreaterThanOrEqual(40);

    const customer = await prisma.customer.findUnique({ where: { publicId: res.body.data.customer.publicId } });
    expect(customer?.companyId).toBe(a.company.id);
    expect(customer?.visitorKeyHash).toBe(hashVisitorKey(res.body.data.visitorKey));
    expect(customer?.externalId).toMatch(/^guest_/);
  });

  it("restores the same visitor from the visitor key", async () => {
    const first = await startSession(a.company.siteId);
    const again = await startSession(a.company.siteId, first.body.data.visitorKey);

    expect(again.status).toBe(200);
    expect(again.body.data.isNewVisitor).toBe(false);
    expect(again.body.data.customer.publicId).toBe(first.body.data.customer.publicId);
  });

  it("does not restore a visitor from another company", async () => {
    const onA = await startSession(a.company.siteId);
    const onB = await startSession(b.company.siteId, onA.body.data.visitorKey);

    expect(onB.status).toBe(201);
    expect(onB.body.data.customer.publicId).not.toBe(onA.body.data.customer.publicId);
  });

  it("refuses sessions when the widget is disabled", async () => {
    await setSettings(b, { widgetEnabled: false });
    const res = await startSession(b.company.siteId);
    expect(res.status).toBe(403);
    await setSettings(b, {});
  });
});

describe("allowed origins", () => {
  const allowed = "https://shop.example.com";
  const evil = "https://evil.example.com";

  beforeAll(() => setSettings(b, { allowedOrigins: [allowed] }));
  afterAll(() => setSettings(b, {}));

  it("blocks config and sessions from other websites", async () => {
    const config = await request(app).get(`/api/v1/widget/config?siteId=${b.company.siteId}`).set("origin", evil);
    expect(config.status).toBe(403);
    expect((await startSession(b.company.siteId, undefined, evil)).status).toBe(403);
  });

  it("allows the listed website", async () => {
    const config = await request(app).get(`/api/v1/widget/config?siteId=${b.company.siteId}`).set("origin", allowed);
    expect(config.status).toBe(200);
    expect((await startSession(b.company.siteId, undefined, allowed)).status).toBe(201);
  });

  it("blocks authenticated widget calls from other websites", async () => {
    const session = await startSession(b.company.siteId, undefined, allowed);
    const res = await request(app)
      .get("/api/v1/widget/conversations/active")
      .set("x-widget-session-token", session.body.data.sessionToken)
      .set("origin", evil);
    expect(res.status).toBe(403);
  });
});

describe("widget conversations", () => {
  it("opens one conversation, survives a refresh and keeps the history", async () => {
    const session = await startSession(a.company.siteId);
    const visitor = asVisitor(session.body.data.sessionToken);

    const none = await visitor.active();
    expect(none.status).toBe(200);
    expect(none.body.data).toBeUndefined();

    const opened = await visitor.open();
    expect(opened.status).toBe(200);
    expect(opened.body.data.status).toBe("WAITING");
    const conversationId = opened.body.data.publicId;

    // Opening again returns the same conversation instead of a new one.
    expect((await visitor.open()).body.data.publicId).toBe(conversationId);

    expect((await visitor.send(conversationId, "Hello, I need help")).status).toBe(201);

    // "Refresh": new session from the stored visitor key.
    const refreshed = await startSession(a.company.siteId, session.body.data.visitorKey);
    const sameVisitor = asVisitor(refreshed.body.data.sessionToken);

    const active = await sameVisitor.active();
    expect(active.body.data.publicId).toBe(conversationId);

    const history = await sameVisitor.messages(conversationId);
    expect(history.status).toBe(200);
    expect(history.body.data.map((m: { content: string }) => m.content)).toEqual(["Hello, I need help"]);
  });

  it("never exposes agent details beyond the name", async () => {
    const session = await startSession(a.company.siteId);
    const visitor = asVisitor(session.body.data.sessionToken);
    const opened = await visitor.open();

    await prisma.conversation.update({
      where: { publicId: opened.body.data.publicId },
      data: { assignedAgentId: a.agent.id, status: "ACTIVE" },
    });

    const active = await visitor.active();
    expect(active.body.data.agent).toEqual({ name: a.agent.name });
    expect(JSON.stringify(active.body)).not.toContain(a.agent.email);
  });

  it("stops another visitor from reading or writing the conversation", async () => {
    const owner = asVisitor((await startSession(a.company.siteId)).body.data.sessionToken);
    const conversationId = (await owner.open()).body.data.publicId;

    const sameCompanyStranger = asVisitor((await startSession(a.company.siteId)).body.data.sessionToken);
    expect((await sameCompanyStranger.messages(conversationId)).status).toBe(403);
    expect((await sameCompanyStranger.send(conversationId, "hi")).status).toBe(403);

    const otherCompanyStranger = asVisitor((await startSession(b.company.siteId)).body.data.sessionToken);
    expect((await otherCompanyStranger.messages(conversationId)).status).toBe(404);
  });
});

describe("conversation status rules", () => {
  it("a customer message reopens a resolved conversation into the right queue", async () => {
    const session = await startSession(a.company.siteId);
    const visitor = asVisitor(session.body.data.sessionToken);
    const conversationId = (await visitor.open()).body.data.publicId;

    await prisma.conversation.update({ where: { publicId: conversationId }, data: { status: "RESOLVED" } });
    await visitor.send(conversationId, "One more question");
    expect((await prisma.conversation.findUnique({ where: { publicId: conversationId } }))?.status).toBe("WAITING");

    await prisma.conversation.update({
      where: { publicId: conversationId },
      data: { status: "RESOLVED", assignedAgentId: a.agent.id },
    });
    await visitor.send(conversationId, "And another");
    expect((await prisma.conversation.findUnique({ where: { publicId: conversationId } }))?.status).toBe("ACTIVE");
  });

  it("assigning a waiting conversation makes it active, unassigning puts it back", async () => {
    const conversation = await prisma.conversation.create({
      data: { companyId: a.company.id, customerId: a.customer.id },
    });
    const assign = (agentId: string | null) =>
      request(app)
        .patch(`/api/v1/conversations/${conversation.publicId}/assign`)
        .set("authorization", `Bearer ${agentToken(a.admin)}`)
        .send({ agentId });

    expect((await assign(a.agent.id)).body.data.status).toBe("ACTIVE");
    expect((await assign(null)).body.data.status).toBe("WAITING");
  });
});

describe("company settings", () => {
  const patch = (settings: object) =>
    request(app)
      .patch("/api/v1/companies/me/settings")
      .set("authorization", `Bearer ${agentToken(a.admin)}`)
      .send({ settings });

  beforeAll(() => setSettings(a, {}));

  it("rejects invalid values and unknown keys", async () => {
    expect((await patch({ primaryColor: "blue" })).status).toBe(400);
    expect((await patch({ notARealSetting: true })).status).toBe(400);
    expect((await patch({ allowedOrigins: ["not a url"] })).status).toBe(400);
  });

  it("merges updates and normalises origins", async () => {
    expect((await patch({ supportEmail: "help@test.local" })).status).toBe(200);
    expect((await patch({ primaryColor: "#112233", allowedOrigins: ["https://shop.example.com/some/page"] })).status).toBe(
      200,
    );

    const company = await prisma.company.findUnique({ where: { id: a.company.id } });
    expect(company?.settings).toEqual({
      supportEmail: "help@test.local",
      primaryColor: "#112233",
      allowedOrigins: ["https://shop.example.com"],
    });
    await setSettings(a, {});
  });
});

describe("CORS", () => {
  it("lets any website call the widget API", async () => {
    const res = await request(app)
      .options("/api/v1/widget/config")
      .set("origin", "https://any-customer-site.example")
      .set("access-control-request-method", "GET");
    expect(res.headers["access-control-allow-origin"]).toBe("https://any-customer-site.example");
  });

  it("keeps the dashboard API closed to other websites", async () => {
    const res = await request(app)
      .options("/api/v1/auth/login")
      .set("origin", "https://any-customer-site.example")
      .set("access-control-request-method", "POST");
    expect(res.headers["access-control-allow-origin"]).not.toBe("https://any-customer-site.example");
  });
});
