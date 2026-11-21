import http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { io as connect, Socket } from "socket.io-client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { closeSocketServer, initSocketServer, presence, realtimeEmitter } from "../src/realtime/index.js";
import { agentToken, createTenant, deleteTenant, Tenant, widgetToken } from "./helpers.js";

let server: http.Server;
let url: string;
let a: Tenant;
let b: Tenant;
const sockets: Socket[] = [];

beforeAll(async () => {
  server = http.createServer(app);
  initSocketServer(server);
  await realtimeEmitter.init();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  url = `http://localhost:${(server.address() as AddressInfo).port}`;

  a = await createTenant("ra");
  b = await createTenant("rb");
});

afterEach(() => {
  sockets.splice(0).forEach((s) => s.disconnect());
});

afterAll(async () => {
  await closeSocketServer();
  await Promise.all([realtimeEmitter.shutdown(), presence.shutdown()]);
  await Promise.all([deleteTenant(a), deleteTenant(b)]);
  await prisma.$disconnect();
});

// ---- helpers ---------------------------------------------------------------

const open = (auth: Record<string, string>, origin?: string) =>
  new Promise<Socket>((resolve, reject) => {
    const socket = connect(url, {
      path: "/realtime/socket.io",
      transports: ["websocket"],
      auth,
      extraHeaders: origin ? { origin } : undefined,
      reconnection: false,
      forceNew: true,
    });
    sockets.push(socket);
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });

const asAgent = (agent: Tenant["agent"]) => open({ token: agentToken(agent) });
const asVisitor = (t: Tenant) => open({ widgetToken: widgetToken(t) });

const join = (socket: Socket, conversationId: string) =>
  socket.emitWithAck("conversation:join", conversationId) as Promise<{ ok: boolean; conversationId?: string }>;

// Resolves with the next payload of `event`, or rejects after `ms`.
const next = <T = any>(socket: Socket, event: string, ms = 2000) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no ${event} within ${ms}ms`)), ms);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

// Collects every payload of `event` received during the test.
const record = (socket: Socket, event: string) => {
  const received: any[] = [];
  socket.on(event, (payload) => received.push(payload));
  return received;
};

const settle = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

const sendAsVisitor = (t: Tenant, content: string, clientMessageId?: string) =>
  request(app)
    .post(`/api/v1/widget/conversations/${t.conversation.publicId}/messages`)
    .set("x-widget-session-token", widgetToken(t))
    .send({ content, ...(clientMessageId ? { clientMessageId } : {}) });

const sendAsAgent = (t: Tenant, content: string) =>
  request(app)
    .post(`/api/v1/conversations/${t.conversation.publicId}/messages`)
    .set("authorization", `Bearer ${agentToken(t.agent)}`)
    .send({ content });

// ---- tests -----------------------------------------------------------------

describe("connecting", () => {
  it("rejects sockets without valid credentials", async () => {
    await expect(open({})).rejects.toThrow();
    await expect(open({ widgetToken: "not-a-token" })).rejects.toThrow();
  });

  it("rejects visitors from websites the company did not allow", async () => {
    await prisma.company.update({
      where: { id: a.company.id },
      data: { settings: { allowedOrigins: ["https://shop.example.com"] } },
    });
    try {
      await expect(open({ widgetToken: widgetToken(a) }, "https://evil.example.com")).rejects.toThrow();
      await expect(open({ widgetToken: widgetToken(a) }, "https://shop.example.com")).resolves.toBeTruthy();
    } finally {
      await prisma.company.update({ where: { id: a.company.id }, data: { settings: {} } });
    }
  });

  it("rejects agents connecting from outside the dashboard", async () => {
    await expect(open({ token: agentToken(a.agent) }, "https://evil.example.com")).rejects.toThrow();
  });
});

describe("live messages", () => {
  it("delivers a visitor message to the agent and an agent reply to the visitor, once each", async () => {
    const agent = await asAgent(a.agent);
    const visitor = await asVisitor(a);
    expect(await join(visitor, a.conversation.publicId)).toEqual({ ok: true, conversationId: a.conversation.publicId });
    await join(agent, a.conversation.publicId); // in both the company and the conversation room

    const agentGot = record(agent, "message:created");
    const visitorGot = record(visitor, "message:created");

    const fromVisitor = next(agent, "message:created");
    expect((await sendAsVisitor(a, "Hi, my order is late")).status).toBe(201);
    expect((await fromVisitor).message.content).toBe("Hi, my order is late");

    const fromAgent = next(visitor, "message:created");
    expect((await sendAsAgent(a, "Sorry! Checking now.")).status).toBe(201);
    const reply = await fromAgent;
    expect(reply.conversationId).toBe(a.conversation.publicId);
    expect(reply.message.content).toBe("Sorry! Checking now.");

    await settle();
    expect(agentGot).toHaveLength(2);
    expect(visitorGot).toHaveLength(2);
  });

  it("agents see messages from conversations they have not opened", async () => {
    const agent = await asAgent(a.agent);
    const got = next(agent, "message:created");
    await sendAsVisitor(a, "Anyone there?");
    expect((await got).conversationId).toBe(a.conversation.publicId);
  });

  it("never leaks across companies or to other visitors", async () => {
    const otherAgent = await asAgent(b.agent);
    const otherVisitor = await asVisitor(b);
    await join(otherVisitor, b.conversation.publicId);

    // Same company, different visitor.
    const stranger = await prisma.customer.create({ data: { companyId: a.company.id, externalId: "stranger" } });
    const strangerSocket = await open({ widgetToken: widgetToken({ ...a, customer: stranger }) });

    expect((await join(otherVisitor, a.conversation.publicId)).ok).toBe(false);
    expect((await join(otherAgent, a.conversation.publicId)).ok).toBe(false);
    expect((await join(strangerSocket, a.conversation.publicId)).ok).toBe(false);

    const leaked = [
      ...record(otherAgent, "message:created"),
      ...record(otherVisitor, "message:created"),
      ...record(strangerSocket, "message:created"),
    ];
    await sendAsVisitor(a, "private");
    await sendAsAgent(a, "private reply");
    await settle();
    expect(leaked).toEqual([]);
  });

  it("keeps internal notes away from the visitor", async () => {
    const agent = await asAgent(a.agent);
    const visitor = await asVisitor(a);
    await join(visitor, a.conversation.publicId);
    const visitorNotes = record(visitor, "conversation:note_added");

    const agentGot = next(agent, "conversation:note_added");
    const res = await request(app)
      .post(`/api/v1/conversations/${a.conversation.publicId}/notes`)
      .set("authorization", `Bearer ${agentToken(a.agent)}`)
      .send({ content: "VIP customer" });
    expect(res.status).toBe(201);
    expect((await agentGot).note.content).toBe("VIP customer");

    await settle();
    expect(visitorNotes).toEqual([]);
  });
});

describe("conversation updates", () => {
  it("tells the visitor only the assigned agent's name; agents get the full conversation", async () => {
    const agent = await asAgent(a.admin);
    const visitor = await asVisitor(a);
    await join(visitor, a.conversation.publicId);
    await prisma.conversation.update({
      where: { id: a.conversation.id },
      data: { status: "WAITING", assignedAgentId: null },
    });

    const visitorAssigned = record(visitor, "conversation:assigned");
    const agentAssigned = record(agent, "conversation:assigned");
    const visitorStatus = next(visitor, "conversation:status_changed");

    const res = await request(app)
      .patch(`/api/v1/conversations/${a.conversation.publicId}/assign`)
      .set("authorization", `Bearer ${agentToken(a.admin)}`)
      .send({ agentId: a.agent.id });
    expect(res.status).toBe(200);

    expect(await visitorStatus).toEqual({
      conversationId: a.conversation.publicId,
      status: "ACTIVE",
      previousStatus: "WAITING",
    });
    await settle();

    expect(visitorAssigned).toEqual([{ conversationId: a.conversation.publicId, agent: { name: a.agent.name } }]);
    expect(JSON.stringify(visitorAssigned)).not.toContain(a.agent.email);
    expect(agentAssigned).toHaveLength(1);
    expect(agentAssigned[0].conversation.assignedAgent.email).toBe(a.agent.email);
  });
});

describe("typing", () => {
  it("relays typing to the other side of the conversation only", async () => {
    const agent = await asAgent(a.agent);
    const visitor = await asVisitor(a);
    const otherVisitor = await asVisitor(b);
    await join(agent, a.conversation.publicId);
    await join(visitor, a.conversation.publicId);

    const agentSees = next(agent, "customer:typing");
    visitor.emit("typing", { conversationId: a.conversation.publicId, isTyping: true });
    expect(await agentSees).toEqual({ conversationId: a.conversation.publicId, isTyping: true });

    const visitorSees = next(visitor, "agent:typing");
    agent.emit("typing", { conversationId: a.conversation.publicId, isTyping: true });
    expect(await visitorSees).toEqual({
      conversationId: a.conversation.publicId,
      isTyping: true,
      agent: { name: a.agent.name },
    });

    // A socket that has not joined the conversation cannot fake typing in it.
    const fake = record(agent, "customer:typing");
    otherVisitor.emit("typing", { conversationId: a.conversation.publicId, isTyping: true });
    await settle();
    expect(fake).toEqual([]);
  });

  it("throttles repeated typing events", async () => {
    const agent = await asAgent(a.agent);
    const visitor = await asVisitor(a);
    await join(agent, a.conversation.publicId);
    await join(visitor, a.conversation.publicId);

    const seen = record(agent, "customer:typing");
    for (let i = 0; i < 10; i++) visitor.emit("typing", { conversationId: a.conversation.publicId, isTyping: true });
    visitor.emit("typing", { conversationId: a.conversation.publicId, isTyping: false });
    await settle();

    expect(seen.map((p) => p.isTyping)).toEqual([true, false]);
  });
});

describe("presence", () => {
  const isOnline = async (t: Tenant) =>
    (await prisma.agent.findUniqueOrThrow({ where: { id: t.agent.id } })).isOnline;

  const waitUntil = async (check: () => Promise<boolean>) => {
    for (let i = 0; i < 40; i++) {
      if (await check()) return;
      await settle(50);
    }
    throw new Error("condition not met in time");
  };

  it("an agent stays online until their last tab disconnects", async () => {
    const watcher = await asAgent(a.admin);
    await settle(); // let the watcher's own agent:online pass
    const online = record(watcher, "agent:online");
    const offline = record(watcher, "agent:offline");

    const tab1 = await asAgent(a.agent);
    const tab2 = await asAgent(a.agent);
    await waitUntil(() => isOnline(a));

    tab1.disconnect();
    await settle();
    expect(await isOnline(a)).toBe(true);
    expect(offline).toEqual([]);

    tab2.disconnect();
    await waitUntil(async () => !(await isOnline(a)));
    await settle();

    expect(online).toEqual([{ agentId: a.agent.id, publicId: a.agent.publicId, isOnline: true }]);
    expect(offline).toEqual([{ agentId: a.agent.id, publicId: a.agent.publicId, isOnline: false }]);
  });
});

describe("retries and reconnects", () => {
  it("sending the same clientMessageId twice saves and broadcasts one message", async () => {
    const agent = await asAgent(a.agent);
    const got = record(agent, "message:created");
    const clientMessageId = crypto.randomUUID();

    const first = await sendAsVisitor(a, "only once", clientMessageId);
    const retry = await sendAsVisitor(a, "only once", clientMessageId);
    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.body.data.id).toBe(first.body.data.id);

    expect(await prisma.message.count({ where: { conversationId: a.conversation.id, clientMessageId } })).toBe(1);
    await settle();
    expect(got.filter((p) => p.message.id === first.body.data.id)).toHaveLength(1);
  });

  it("fetches what was missed after the last message the client had", async () => {
    const last = (await sendAsVisitor(a, "before disconnect")).body.data;
    await sendAsAgent(a, "missed 1");
    await sendAsAgent(a, "missed 2");

    const res = await request(app)
      .get(`/api/v1/widget/conversations/${a.conversation.publicId}/messages?after=${last.id}`)
      .set("x-widget-session-token", widgetToken(a));

    expect(res.status).toBe(200);
    expect(res.body.data.map((m: { content: string }) => m.content)).toEqual(["missed 1", "missed 2"]);
  });

  it("rejects an after id from another conversation", async () => {
    const foreign = await prisma.message.create({
      data: { conversationId: b.conversation.id, senderType: "CUSTOMER", content: "b" },
    });
    const res = await request(app)
      .get(`/api/v1/widget/conversations/${a.conversation.publicId}/messages?after=${foreign.id}`)
      .set("x-widget-session-token", widgetToken(a));
    expect(res.status).toBe(404);
  });
});
