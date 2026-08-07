import { Router } from "express";
import auth, { Permission } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { CompanyValidation } from "./company.validation";
import { CompanyController } from "./company.controller";

const router = Router();

router.post(
  "/",
  auth(Permission.superadmin),
  validateRequest(CompanyValidation.createCompanySchema),
  CompanyController.createCompany,
);

router.get(
  "/",
  auth(Permission.superadmin),
  validateRequest(CompanyValidation.listCompaniesSchema),
  CompanyController.listCompanies,
);

router.get("/me/stats", auth(Permission.agentAdmin), CompanyController.getMyCompanyStats);

router.get(
  "/:companyId/stats",
  auth(Permission.superadmin),
  validateRequest(CompanyValidation.companyIdParamsSchema),
  CompanyController.getCompanyStats,
);

router.get(
  "/:companyId",
  auth(Permission.superadmin),
  validateRequest(CompanyValidation.companyIdParamsSchema),
  CompanyController.getCompany,
);

router.patch(
  "/:companyId",
  auth(Permission.superadmin),
  validateRequest(CompanyValidation.companyIdParamsSchema),
  validateRequest(CompanyValidation.updateCompanySchema),
  CompanyController.updateCompany,
);

router.delete(
  "/:companyId",
  auth(Permission.superadmin),
  validateRequest(CompanyValidation.companyIdParamsSchema),
  CompanyController.deleteCompany,
);

router.get("/me/profile", auth(Permission.agentAdmin), CompanyController.getMyCompany);

router.patch(
  "/me/profile",
  auth(Permission.agentAdmin),
  validateRequest(CompanyValidation.updateCompanySchema),
  CompanyController.updateMyCompany,
);

router.patch(
  "/me/settings",
  auth(Permission.agentAdmin),
  validateRequest(CompanyValidation.updateCompanySettingsSchema),
  CompanyController.updateMyCompanySettings,
);

export const CompanyRoutes = router;
