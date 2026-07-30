import express from "express";
import auth, { Permission } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { CustomerValidation } from "./customer.validation";
import { CustomerController } from "./customer.controller";
import identifyCompanyFromWidgetKey from "../../middlewares/identifycompanyfromwidgetkey";

const router = express.Router();

// Public — hit by the embeddable widget for anonymous visitors.
// identifyCompanyFromWidgetKey resolves companyId from the widget's public
// key (header/query) and attaches it to req.companyId. Swap in your actual
// widget-auth middleware here if the name/shape differs.
router.post(
  "/upsert",
  identifyCompanyFromWidgetKey,
  validateRequest(CustomerValidation.upsertCustomer),
  CustomerController.upsertCustomer,
);

// Protected — agent/admin dashboard, scoped to req.user.companyId
router.get("/", auth(Permission.agent, Permission.superadmin), CustomerController.getAllCustomers);

router.get(
  "/:publicId",
  auth(Permission.agent, Permission.superadmin),
  CustomerController.getCustomerByPublicId,
);

router.patch(
  "/:publicId",
  auth(Permission.agent, Permission.superadmin),
  validateRequest(CustomerValidation.updateCustomer),
  CustomerController.updateCustomer,
);

router.delete(
  "/:publicId",
  auth(Permission.agentAdmin, Permission.superadmin),
  CustomerController.deleteCustomer,
);

export const CustomerRoutes = router;
