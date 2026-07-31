import express from "express";
import auth, { Permission } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { DashboardController } from "./dashboard.controller";
import { DashboardValidation } from "./dashboard.validation";

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
