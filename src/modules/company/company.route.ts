import { Router } from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { CompanyValidation } from './company.validation';
import { CompanyController } from './company.controller';

const router = Router();

router.post(
  '/',
  auth('superadmin'),
  validateRequest(CompanyValidation.createCompanySchema),
  CompanyController.createCompany,
);

router.get(
  '/',
  auth('superadmin'),
  validateRequest(CompanyValidation.listCompaniesSchema),
  CompanyController.listCompanies,
);

router.get(
  '/:companyId/stats',
  auth('superadmin'),
  validateRequest(CompanyValidation.companyIdParamsSchema),
  CompanyController.getCompanyStats,
);

router.get(
  '/:companyId',
  auth('superadmin'),
  validateRequest(CompanyValidation.companyIdParamsSchema),
  CompanyController.getCompany,
);

router.patch(
  '/:companyId',
  auth('superadmin'),
  validateRequest(CompanyValidation.companyIdParamsSchema),
  validateRequest(CompanyValidation.updateCompanySchema),
  CompanyController.updateCompany,
);

router.delete(
  '/:companyId',
  auth('superadmin'),
  validateRequest(CompanyValidation.companyIdParamsSchema),
  CompanyController.deleteCompany,
);

router.get('/me/profile', auth('agent', 'ADMIN'), CompanyController.getMyCompany);

router.patch(
  '/me/profile',
  auth('agent', 'ADMIN'),
  validateRequest(CompanyValidation.updateCompanySchema),
  CompanyController.updateMyCompany,
);

router.patch(
  '/me/settings',
  auth('agent', 'ADMIN'),
  validateRequest(CompanyValidation.updateCompanySettingsSchema),
  CompanyController.updateMyCompanySettings,
);

router.get('/me/stats', auth('agent', 'ADMIN'), CompanyController.getMyCompanyStats);

export const CompanyRoutes = router;
