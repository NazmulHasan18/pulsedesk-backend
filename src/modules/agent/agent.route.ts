import { Router } from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { AgentValidation } from './agent.validation';
import { AgentController } from './agent.controller';

const router = Router();

router.post(
  '/',
  auth('agent', 'ADMIN'),
  validateRequest(AgentValidation.createAgentSchema),
  AgentController.createAgent,
);

router.post(
  '/invite',
  auth('agent', 'ADMIN'),
  validateRequest(AgentValidation.inviteAgentSchema),
  AgentController.inviteAgent,
);

router.get(
  '/',
  auth('agent', 'ADMIN'),
  validateRequest(AgentValidation.listAgentsSchema),
  AgentController.listAgents,
);

router.get(
  '/:agentId',
  auth('agent', 'ADMIN'),
  validateRequest(AgentValidation.agentIdParamsSchema),
  AgentController.getAgent,
);

router.patch(
  '/:agentId',
  auth('agent', 'ADMIN'),
  validateRequest(AgentValidation.agentIdParamsSchema),
  validateRequest(AgentValidation.updateAgentSchema),
  AgentController.updateAgent,
);

router.delete(
  '/:agentId',
  auth('agent', 'ADMIN'),
  validateRequest(AgentValidation.agentIdParamsSchema),
  AgentController.deleteAgent,
);

router.patch(
  '/:agentId/status',
  auth('agent', 'ADMIN'),
  validateRequest(AgentValidation.agentIdParamsSchema),
  validateRequest(AgentValidation.agentStatusSchema),
  AgentController.setAgentStatus,
);

router.post(
  '/:agentId/reset-password',
  auth('agent', 'ADMIN'),
  validateRequest(AgentValidation.agentIdParamsSchema),
  AgentController.resetPassword,
);

export const AgentRoutes = router;
