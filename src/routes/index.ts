import { Router } from "express";
import { AuthRoutes } from "../modules/auth/auth.route";
import { CompanyRoutes } from "../modules/company/company.route";
import { AgentRoutes } from "../modules/agent/agent.route";
import { ConversationRoutes } from "../modules/conversation/conversation.route";
import { CustomerRoutes } from "../modules/customer/customer.route";
import { MessageRoutes } from "../modules/message/message.route";
import { NoteRoutes } from "../modules/note/note.route";
import { FaqRoutes } from "../modules/faq/faq.route";

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
];

moduleRoutes.forEach(({ path, route }) => router.use(path, route));

export default router;
