import { Router } from "express";
import { AuthRoutes } from "../modules/auth/auth.route.js";
import { CompanyRoutes } from "../modules/company/company.route.js";
import { AgentRoutes } from "../modules/agent/agent.route.js";
import { ConversationRoutes } from "../modules/conversation/conversation.route.js";
import { CustomerRoutes } from "../modules/customer/customer.route.js";
import { MessageRoutes } from "../modules/message/message.route.js";
import { NoteRoutes } from "../modules/note/note.route.js";
import { FaqRoutes } from "../modules/faq/faq.route.js";
import { DashboardRoutes } from "../modules/dashboard/dashboard.route.js";
import { RealtimeRoutes } from "../modules/realtime/realtime.route.js";

const router = Router();

const moduleRoutes: { path: string; route: Router }[] = [
  {
    path: "/auth",
    route: AuthRoutes,
  },
  {
    path: "/companies",
    route: CompanyRoutes,
  },
  {
    path: "/agents",
    route: AgentRoutes,
  },
  {
    path: "/customers",
    route: CustomerRoutes,
  },
  {
    path: "/conversations",
    route: ConversationRoutes,
  },
  {
    path: "/conversations/:conversationId/messages",
    route: MessageRoutes.agentRouter,
  },
  {
    path: "/conversations/:conversationId/notes",
    route: NoteRoutes,
  },
  {
    path: "/widget/conversations/:conversationId/messages",
    route: MessageRoutes.widgetRouter,
  },
  {
    path: "/faq",
    route: FaqRoutes,
  },
  { path: "/dashboard", route: DashboardRoutes },
  { path: "/realtime", route: RealtimeRoutes },
];

moduleRoutes.forEach(({ path, route }) => router.use(path, route));

export default router;
