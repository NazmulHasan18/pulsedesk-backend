import { Router } from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { AuthValidation } from './auth.validation';
import { AuthController } from './auth.controller';

const router = Router();

// Company sign-up: creates a Company + its first ADMIN Agent.
router.post(
  '/register-company',
  validateRequest(AuthValidation.registerCompanySchema),
  AuthController.registerCompany,
);

// Company agent/admin login.
router.post(
  '/login',
  validateRequest(AuthValidation.loginSchema),
  AuthController.login,
);

// Platform super-admin login (super-admins are seeded, not self-registered).
router.post(
  '/super-admin/login',
  validateRequest(AuthValidation.superAdminLoginSchema),
  AuthController.superAdminLogin,
);

router.post(
  '/refresh-token',
  validateRequest(AuthValidation.refreshTokenSchema),
  AuthController.refreshToken,
);

router.post(
  '/change-password',
  auth(),
  validateRequest(AuthValidation.changePasswordSchema),
  AuthController.changePassword,
);

router.post('/logout', auth(), AuthController.logout);

router.get('/me', auth(), AuthController.getMe);

export const AuthRoutes = router;
