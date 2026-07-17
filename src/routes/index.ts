import { Router } from 'express';
import { AuthRoutes } from '../modules/auth/auth.route';
import { CompanyRoutes } from '../modules/company/company.route';
import { AgentRoutes } from '../modules/agent/agent.route';

const router = Router();

const moduleRoutes: { path: string; route: Router }[] = [
  {
    path: '/auth',
    route: AuthRoutes,
  },
  {
    path: '/companies',
    route: CompanyRoutes,
  },
  {
    path: '/agents',
    route: AgentRoutes,
  },
];

moduleRoutes.forEach(({ path, route }) => router.use(path, route));

export default router;
