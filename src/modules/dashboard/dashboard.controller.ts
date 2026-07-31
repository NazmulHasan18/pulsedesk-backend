import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { DashboardService } from "./dashboard.service";

const getOverview = catchAsync(async (req: Request, res: Response) => {
  const { companyId } = req.user as { companyId: string };

  const result = await DashboardService.getOverview(companyId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Dashboard overview retrieved successfully",
    data: result,
  });
});

const getAgentWorkload = catchAsync(async (req: Request, res: Response) => {
  const { companyId } = req.user as { companyId: string };

  const result = await DashboardService.getAgentWorkload(companyId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Agent workload retrieved successfully",
    data: result,
  });
});

const getAnalytics = catchAsync(async (req: Request, res: Response) => {
  const { companyId } = req.user as { companyId: string };
  const days = req.query.days ? parseInt(req.query.days as string, 10) : undefined;

  const result = await DashboardService.getAnalytics(companyId, days);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Dashboard analytics retrieved successfully",
    data: result,
  });
});

const getPlatformOverview = catchAsync(async (_req: Request, res: Response) => {
  const result = await DashboardService.getPlatformOverview();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Platform overview retrieved successfully",
    data: result,
  });
});

export const DashboardController = {
  getOverview,
  getAgentWorkload,
  getAnalytics,
  getPlatformOverview,
};
