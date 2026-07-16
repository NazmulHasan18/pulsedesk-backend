import { Router } from 'express';
import { AuthRoutes } from '../modules/auth/auth.route';

const router = Router();

const moduleRoutes: { path: string; route: Router }[] = [
  {
    path: '/auth',
    route: AuthRoutes,
  },
  // Future modules mount here, e.g.:
  // { path: '/companies', route: CompanyRoutes },
  // { path: '/conversations', route: ConversationRoutes },
  // { path: '/faq-docs', route: FaqDocRoutes },
];

moduleRoutes.forEach(({ path, route }) => router.use(path, route));

export default router;
