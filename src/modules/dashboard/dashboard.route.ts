import express from "express";
import auth, { Permission } from "../../middlewares/auth.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { DashboardController } from "./dashboard.controller.js";
import { DashboardValidation } from "./dashboard.validation.js";

const router = express.Router();

// Company-scoped — available to ADMIN and AGENT roles
router.get("/overview", auth(Permission.agent), DashboardController.getOverview);

router.get("/agent-workload", auth(Permission.agent), DashboardController.getAgentWorkload);

router.get(
  "/analytics",
  auth(Permission.agent),
  validateRequest(DashboardValidation.getAnalyticsSchema),
  DashboardController.getAnalytics,
);

// Platform-wide — SUPERADMIN only
router.get("/platform", auth(Permission.superadmin), DashboardController.getPlatformOverview);

export const DashboardRoutes = router;
