import { Router } from "express";
import auth, { Permission } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { AgentValidation } from "./agent.validation";
import { AgentController } from "./agent.controller";

const router = Router();

router.post(
  "/",
  auth(Permission.agentAdmin),
  validateRequest(AgentValidation.createAgentSchema),
  AgentController.createAgent,
);

router.post(
  "/invite",
  auth(Permission.agentAdmin),
  validateRequest(AgentValidation.inviteAgentSchema),
  AgentController.inviteAgent,
);

router.get(
  "/",
  auth(Permission.agentAdmin),
  validateRequest(AgentValidation.listAgentsSchema),
  AgentController.listAgents,
);

router.get(
  "/:agentId",
  auth(Permission.agentAdmin),
  validateRequest(AgentValidation.agentIdParamsSchema),
  AgentController.getAgent,
);

router.patch(
  "/:agentId",
  auth(Permission.agentAdmin),
  validateRequest(AgentValidation.agentIdParamsSchema),
  validateRequest(AgentValidation.updateAgentSchema),
  AgentController.updateAgent,
);

router.delete(
  "/:agentId",
  auth(Permission.agentAdmin),
  validateRequest(AgentValidation.agentIdParamsSchema),
  AgentController.deleteAgent,
);

router.patch(
  "/:agentId/status",
  auth(Permission.agentAdmin),
  validateRequest(AgentValidation.agentIdParamsSchema),
  validateRequest(AgentValidation.agentStatusSchema),
  AgentController.setAgentStatus,
);

router.post(
  "/:agentId/reset-password",
  auth(Permission.agentAdmin),
  validateRequest(AgentValidation.agentIdParamsSchema),
  AgentController.resetPassword,
);

export const AgentRoutes = router;
