import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { agentToken, createTenant, deleteTenant, Tenant } from "./helpers.js";

let a: Tenant;
let b: Tenant;
let agent2: Tenant["agent"];

beforeAll(async () => {
  a = await createTenant("ia");
  b = await createTenant("ib");
  agent2 = await prisma.agent.create({
    data: {
      name: "Second agent",
      email: `second-${a.company.siteId}@test.local`,
      password: "not-used-in-tests",
      role: "AGENT",
      companyId: a.company.id,
    },
  });
});

afterAll(async () => {
  await Promise.all([deleteTenant(a), deleteTenant(b)]);
  await prisma.$disconnect();
});

// Each test starts from an empty inbox for company A.
beforeEach(async () => {
  await prisma.conversation.deleteMany({ where: { companyId: a.company.id } });
});

type Agent = Tenant["agent"];

const as = (agent: Agent) => {
  const auth = { authorization: `Bearer ${agentToken(agent)}` };
  return {
    action: (publicId: string, action: "claim" | "unclaim" | "resolve" | "reopen") =>
      request(app).post(`/api/v1/conversations/${publicId}/${action}`).set(auth),
    reply: (publicId: string, content: string) =>
      request(app).post(`/api/v1/conversations/${publicId}/messages`).set(auth).send({ content }),
    read: (publicId: string) => request(app).patch(`/api/v1/conversations/${publicId}/messages/read`).set(auth),
    inbox: (view: string) => request(app).get(`/api/v1/conversations/inbox?view=${view}`).set(auth),
    counts: () => request(app).get("/api/v1/conversations/inbox/counts").set(auth),
    setStatus: (publicId: string, status: string) =>
      request(app).patch(`/api/v1/conversations/${publicId}/status`).set(auth).send({ status }),
  };
};

let seq = 0;
const newConversation = async (
  t: Tenant,
  data: { status?: "WAITING" | "ACTIVE" | "RESOLVED"; assignedAgentId?: string | null; createdAt?: Date } = {},
) => {
  const customer = await prisma.customer.create({
    data: { companyId: t.company.id, externalId: `guest_${++seq}_${Date.now()}`, name: `Visitor ${seq}` },
  });
  return prisma.conversation.create({ data: { companyId: t.company.id, customerId: customer.id, ...data } });
};

const customerSays = (conversationId: string, content: string, createdAt?: Date) =>
  prisma.message.create({ data: { conversationId, senderType: "CUSTOMER", content, createdAt } });

const statusOf = async (id: string) => prisma.conversation.findUniqueOrThrow({ where: { id } });

describe("claim", () => {
  it("lets exactly one of two agents win a simultaneous claim", async () => {
    const conversation = await newConversation(a);

    const [first, second] = await Promise.all([
      as(a.agent).action(conversation.publicId, "claim"),
      as(agent2).action(conversation.publicId, "claim"),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);
    const winner = first.status === 200 ? a.agent : agent2;
    const loser = first.status === 200 ? second : first;

    const saved = await statusOf(conversation.id);
    expect(saved.status).toBe("ACTIVE");
    expect(saved.assignedAgentId).toBe(winner.id);
    expect(loser.body.message).toContain(winner.name);
    expect(
      await prisma.conversationEvent.count({ where: { conversationId: conversation.id, type: "ASSIGNED" } }),
    ).toBe(1);
  });

  it("claiming your own conversation again is harmless", async () => {
    const conversation = await newConversation(a);
    expect((await as(a.agent).action(conversation.publicId, "claim")).status).toBe(200);
    expect((await as(a.agent).action(conversation.publicId, "claim")).status).toBe(200);
  });

  it("can't claim a conversation from another company", async () => {
    const foreign = await newConversation(b);
    expect((await as(a.agent).action(foreign.publicId, "claim")).status).toBe(404);
  });
});

describe("replying", () => {
  it("requires the agent to have claimed the conversation; admins may always reply", async () => {
    const conversation = await newConversation(a);

    expect((await as(a.agent).reply(conversation.publicId, "hi")).status).toBe(403);
    expect((await as(a.admin).reply(conversation.publicId, "admin here")).status).toBe(201);

    await as(a.agent).action(conversation.publicId, "claim");
    expect((await as(a.agent).reply(conversation.publicId, "hi")).status).toBe(201);
    expect((await as(agent2).reply(conversation.publicId, "me too")).status).toBe(403);
  });
});

describe("unclaim, resolve, reopen", () => {
  it("only the assigned agent or an admin can release a conversation", async () => {
    const conversation = await newConversation(a, { status: "ACTIVE", assignedAgentId: a.agent.id });

    expect((await as(agent2).action(conversation.publicId, "unclaim")).status).toBe(403);
    expect((await as(a.agent).action(conversation.publicId, "unclaim")).status).toBe(200);
    expect(await statusOf(conversation.id)).toMatchObject({ status: "WAITING", assignedAgentId: null });

    await as(a.agent).action(conversation.publicId, "claim");
    expect((await as(a.admin).action(conversation.publicId, "unclaim")).status).toBe(200);
  });

  it("resolving keeps the agent, so reopening returns it to them", async () => {
    const conversation = await newConversation(a, { status: "ACTIVE", assignedAgentId: a.agent.id });

    expect((await as(agent2).action(conversation.publicId, "resolve")).status).toBe(403);
    expect((await as(a.agent).action(conversation.publicId, "resolve")).status).toBe(200);
    expect(await statusOf(conversation.id)).toMatchObject({ status: "RESOLVED", assignedAgentId: a.agent.id });
    expect((await as(a.agent).action(conversation.publicId, "resolve")).status).toBe(200); // already resolved

    expect((await as(agent2).action(conversation.publicId, "reopen")).status).toBe(403);
    expect((await as(a.agent).action(conversation.publicId, "reopen")).status).toBe(200);
    expect(await statusOf(conversation.id)).toMatchObject({ status: "ACTIVE", assignedAgentId: a.agent.id });
  });

  it("anyone can reopen an unassigned conversation; it goes back to the waiting queue", async () => {
    const conversation = await newConversation(a, { status: "RESOLVED", assignedAgentId: null });
    expect((await as(agent2).action(conversation.publicId, "reopen")).status).toBe(200);
    expect((await statusOf(conversation.id)).status).toBe("WAITING");
  });

  it("setting a status directly is for admins only", async () => {
    const conversation = await newConversation(a);
    expect((await as(a.agent).setStatus(conversation.publicId, "RESOLVED")).status).toBe(403);
    expect((await as(a.admin).setStatus(conversation.publicId, "RESOLVED")).status).toBe(200);
  });
});

describe("conversation detail", () => {
  it("has no message dump, counts the customer's conversations and hides the visitor key hash", async () => {
    const conversation = await newConversation(a);
    await prisma.customer.update({ where: { id: conversation.customerId }, data: { visitorKeyHash: "secret-hash" } });
    await prisma.conversation.create({ data: { companyId: a.company.id, customerId: conversation.customerId, status: "RESOLVED" } });

    const res = await request(app)
      .get(`/api/v1/conversations/${conversation.publicId}`)
      .set("authorization", `Bearer ${agentToken(a.agent)}`);

    expect(res.status).toBe(200);
    expect(res.body.data.customerConversationCount).toBe(2);
    expect(res.body.data).not.toHaveProperty("messages");
    expect(JSON.stringify(res.body)).not.toContain("secret-hash");
  });

  it("action responses hide the visitor key hash too", async () => {
    const conversation = await newConversation(a);
    await prisma.customer.update({ where: { id: conversation.customerId }, data: { visitorKeyHash: "secret-hash-2" } });
    const res = await as(a.agent).action(conversation.publicId, "claim");
    expect(JSON.stringify(res.body)).not.toContain("secret-hash-2");
  });
});

describe("inbox list", () => {
  it("waiting is a queue: oldest first, with last message and unread count", async () => {
    const older = await newConversation(a, { createdAt: new Date(Date.now() - 60_000) });
    const newer = await newConversation(a);
    await customerSays(older.id, "first", new Date(Date.now() - 50_000));
    await customerSays(older.id, "second", new Date(Date.now() - 40_000));
    await newConversation(b); // other company: never listed

    const res = await as(a.agent).inbox("waiting");
    expect(res.status).toBe(200);
    expect(res.body.data.map((c: { publicId: string }) => c.publicId)).toEqual([older.publicId, newer.publicId]);
    expect(res.body.data[0]).toMatchObject({ lastMessage: { content: "second" }, unreadCount: 2 });
    expect(res.body.data[1]).toMatchObject({ lastMessage: null, unreadCount: 0 });
    expect(res.body.data[0].customer.name).toEqual(expect.any(String));
    expect(res.body.data[0]).not.toHaveProperty("id"); // public ids only
    expect(res.body.meta.total).toBe(2);
  });

  it("mine, all and resolved views, plus counts", async () => {
    const waiting = await newConversation(a);
    const mine = await newConversation(a, { status: "ACTIVE", assignedAgentId: a.agent.id });
    const theirs = await newConversation(a, { status: "ACTIVE", assignedAgentId: agent2.id });
    const resolved = await newConversation(a, { status: "RESOLVED", assignedAgentId: a.agent.id });

    const ids = async (view: string) =>
      (await as(a.agent).inbox(view)).body.data.map((c: { publicId: string }) => c.publicId).sort();

    expect(await ids("mine")).toEqual([mine.publicId]);
    expect(await ids("all")).toEqual([waiting.publicId, mine.publicId, theirs.publicId].sort());
    expect(await ids("resolved")).toEqual([resolved.publicId]);
    expect((await as(a.agent).counts()).body.data).toEqual({ waiting: 1, mine: 1, all: 3 });
    expect((await as(agent2).counts()).body.data).toEqual({ waiting: 1, mine: 1, all: 3 });
  });

  it("a new message moves the conversation to the top", async () => {
    const quiet = await newConversation(a, { status: "ACTIVE", assignedAgentId: a.agent.id });
    const busy = await newConversation(a, { status: "ACTIVE", assignedAgentId: a.agent.id });
    await as(a.agent).reply(busy.publicId, "first"); // busy is the most recent
    await as(a.agent).reply(quiet.publicId, "now this one");

    const order = (await as(a.agent).inbox("mine")).body.data.map((c: { publicId: string }) => c.publicId);
    expect(order).toEqual([quiet.publicId, busy.publicId]);
  });

  it("reading clears the unread count", async () => {
    const conversation = await newConversation(a, { status: "ACTIVE", assignedAgentId: a.agent.id });
    await customerSays(conversation.id, "hello?");
    expect((await as(a.agent).inbox("mine")).body.data[0].unreadCount).toBe(1);

    await as(a.agent).read(conversation.publicId);
    expect((await as(a.agent).inbox("mine")).body.data[0].unreadCount).toBe(0);
  });

  it("rejects an unknown view", async () => {
    expect((await as(a.agent).inbox("everything")).status).toBe(400);
  });
});

describe("admin assign", () => {
  const assign = (by: Agent, publicId: string, agentPublicId: string | null) =>
    request(app)
      .patch(`/api/v1/conversations/${publicId}/assign`)
      .set("authorization", `Bearer ${agentToken(by)}`)
      .send({ agentPublicId });

  it("assigns a waiting conversation by agent publicId and makes it active", async () => {
    const conversation = await newConversation(a);
    const res = await assign(a.admin, conversation.publicId, agent2.publicId);

    expect(res.status).toBe(200);
    const row = await statusOf(conversation.id);
    expect(row.status).toBe("ACTIVE");
    expect(row.assignedAgentId).toBe(agent2.id);
    // The new owner can reply straight away, without claiming.
    expect((await as(agent2).reply(conversation.publicId, "hi")).status).toBe(201);
  });

  it("transfers an active conversation to another agent, keeping it active", async () => {
    const conversation = await newConversation(a, { status: "ACTIVE", assignedAgentId: a.agent.id });
    expect((await assign(a.admin, conversation.publicId, agent2.publicId)).status).toBe(200);

    const row = await statusOf(conversation.id);
    expect(row.status).toBe("ACTIVE");
    expect(row.assignedAgentId).toBe(agent2.id);
    // The previous owner lost the right to reply.
    expect((await as(a.agent).reply(conversation.publicId, "still me?")).status).toBe(403);
  });

  it("unassigning puts an active conversation back in the waiting queue", async () => {
    const conversation = await newConversation(a, { status: "ACTIVE", assignedAgentId: a.agent.id });
    expect((await assign(a.admin, conversation.publicId, null)).status).toBe(200);

    const row = await statusOf(conversation.id);
    expect(row.status).toBe("WAITING");
    expect(row.assignedAgentId).toBeNull();
  });

  it("logs one ASSIGNED event, and nothing when the assignee doesn't change", async () => {
    const conversation = await newConversation(a);
    await assign(a.admin, conversation.publicId, agent2.publicId);
    expect((await assign(a.admin, conversation.publicId, agent2.publicId)).status).toBe(200);

    const events = await prisma.conversationEvent.findMany({ where: { conversationId: conversation.id, type: "ASSIGNED" } });
    expect(events).toHaveLength(1);
  });

  it("is forbidden for a regular agent", async () => {
    const conversation = await newConversation(a, { status: "ACTIVE", assignedAgentId: a.agent.id });
    expect((await assign(a.agent, conversation.publicId, agent2.publicId)).status).toBe(403);
  });

  it("rejects a deactivated agent", async () => {
    const conversation = await newConversation(a);
    await prisma.agent.update({ where: { id: agent2.id }, data: { isActive: false } });
    try {
      expect((await assign(a.admin, conversation.publicId, agent2.publicId)).status).toBe(400);
    } finally {
      await prisma.agent.update({ where: { id: agent2.id }, data: { isActive: true } });
    }
    expect((await statusOf(conversation.id)).assignedAgentId).toBeNull();
  });

  it("rejects an agent from another company, and the internal id", async () => {
    const conversation = await newConversation(a);
    expect((await assign(a.admin, conversation.publicId, b.agent.publicId)).status).toBe(404);
    expect((await assign(a.admin, conversation.publicId, agent2.id)).status).toBe(404);
  });
});
