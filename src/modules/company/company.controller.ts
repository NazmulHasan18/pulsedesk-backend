import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import AppError from "../../utils/AppError";
import { CompanyService } from "./company.service";
import { AuthService } from "../auth/auth.service";

const createCompany = catchAsync(async (req, res) => {
  const result = await AuthService.registerCompany({ ...req.body, password: "TemporaryPassword123!" });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Company created successfully",
    data: result,
  });
});

const listCompanies = catchAsync(async (req, res) => {
  const result = await CompanyService.listCompanies(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Companies retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getCompany = catchAsync(async (req, res) => {
  const companyId = String(req.params.companyId);
  const result = await CompanyService.getCompanyByPublicId(companyId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Company retrieved successfully",
    data: result,
  });
});

const updateCompany = catchAsync(async (req, res) => {
  const companyId = String(req.params.companyId);
  const result = await CompanyService.updateCompany(companyId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Company updated successfully",
    data: result,
  });
});

const deleteCompany = catchAsync(async (req, res) => {
  const companyId = String(req.params.companyId);
  await CompanyService.deleteCompany(companyId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Company deleted successfully",
  });
});

const getCompanyStats = catchAsync(async (req, res) => {
  const companyId = String(req.params.companyId);
  const result = await CompanyService.getCompanyStatsByPublicId(companyId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Company statistics retrieved successfully",
    data: result,
  });
});

const getMyCompany = catchAsync(async (req, res) => {
  if (!req.user?.companyId) {
    throw new AppError(httpStatus.UNAUTHORIZED, "You are not authorized!");
  }

  const result = await CompanyService.getMyCompany(req.user.companyId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Company profile retrieved successfully",
    data: result,
  });
});

const updateMyCompany = catchAsync(async (req, res) => {
  if (!req.user?.companyId) {
    throw new AppError(httpStatus.UNAUTHORIZED, "You are not authorized!");
  }

  const result = await CompanyService.updateMyCompany(req.user.companyId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Company profile updated successfully",
    data: result,
  });
});

const updateMyCompanySettings = catchAsync(async (req, res) => {
  if (!req.user?.companyId) {
    throw new AppError(httpStatus.UNAUTHORIZED, "You are not authorized!");
  }

  const result = await CompanyService.updateMyCompanySettings(req.user.companyId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Company settings updated successfully",
    data: result,
  });
});

const getMyCompanyStats = catchAsync(async (req, res) => {
  if (!req.user?.companyId) {
    throw new AppError(httpStatus.UNAUTHORIZED, "You are not authorized!");
  }

  const result = await CompanyService.getMyCompanyStats(req.user.companyId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Company statistics retrieved successfully",
    data: result,
  });
});

export const CompanyController = {
  createCompany,
  listCompanies,
  getCompany,
  updateCompany,
  deleteCompany,
  getCompanyStats,
  getMyCompany,
  updateMyCompany,
  updateMyCompanySettings,
  getMyCompanyStats,
};
