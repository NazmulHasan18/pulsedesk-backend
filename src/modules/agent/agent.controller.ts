import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import AppError from '../../utils/AppError';
import { AgentService } from './agent.service';

const createAgent = catchAsync(async (req, res) => {
  if (!req.user?.companyId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized!');
  }

  const result = await AgentService.createAgent(req.user.companyId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Agent created successfully',
    data: result,
  });
});

const inviteAgent = catchAsync(async (req, res) => {
  if (!req.user?.companyId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized!');
  }

  const result = await AgentService.inviteAgent(req.user.companyId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Agent invited successfully',
    data: result,
  });
});

const listAgents = catchAsync(async (req, res) => {
  if (!req.user?.companyId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized!');
  }

  const result = await AgentService.listAgents(req.user.companyId, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Agents retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

const getAgent = catchAsync(async (req, res) => {
  if (!req.user?.companyId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized!');
  }

  const agentId = String(req.params.agentId);
  const result = await AgentService.getAgent(req.user.companyId, agentId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Agent retrieved successfully',
    data: result,
  });
});

const updateAgent = catchAsync(async (req, res) => {
  if (!req.user?.companyId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized!');
  }

  const agentId = String(req.params.agentId);
  const result = await AgentService.updateAgent(req.user.companyId, agentId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Agent updated successfully',
    data: result,
  });
});

const deleteAgent = catchAsync(async (req, res) => {
  if (!req.user?.companyId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized!');
  }

  const agentId = String(req.params.agentId);
  await AgentService.deleteAgent(req.user.companyId, agentId, req.user.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Agent deleted successfully',
  });
});

const setAgentStatus = catchAsync(async (req, res) => {
  if (!req.user?.companyId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized!');
  }

  const agentId = String(req.params.agentId);
  const result = await AgentService.setAgentStatus(
    req.user.companyId,
    agentId,
    req.user.id,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Agent status updated successfully',
    data: result,
  });
});

const resetPassword = catchAsync(async (req, res) => {
  if (!req.user?.companyId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized!');
  }

  const agentId = String(req.params.agentId);
  const result = await AgentService.resetPassword(req.user.companyId, agentId, req.user.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Agent password reset successfully',
    data: result,
  });
});

export const AgentController = {
  createAgent,
  inviteAgent,
  listAgents,
  getAgent,
  updateAgent,
  deleteAgent,
  setAgentStatus,
  resetPassword,
};
