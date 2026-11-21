import express from "express";
import auth, { Permission } from "../../middlewares/auth.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { CustomerValidation } from "./customer.validation.js";
import { CustomerController } from "./customer.controller.js";

const router = express.Router();

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
