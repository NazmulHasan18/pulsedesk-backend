import { Router } from "express";
import { AuthRoutes } from "../modules/auth/auth.route";
import { CompanyRoutes } from "../modules/company/company.route";
import { AgentRoutes } from "../modules/agent/agent.route";
import { ConversationRoutes } from "../modules/conversation/conversation.route";
import { CustomerRoutes } from "../modules/customer/customer.route";

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
];

moduleRoutes.forEach(({ path, route }) => router.use(path, route));

export default router;
