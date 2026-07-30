import httpStatus from "http-status";
import { CustomerService } from "./customer.service";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import pick from "../../utils/pick";

const upsertCustomer = catchAsync(async (req, res) => {
  // companyId attached by identifyCompanyFromWidgetKey middleware
  const companyId = req.companyId as string;

  const result = await CustomerService.upsertCustomer(companyId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Customer synced successfully",
    data: result,
  });
});

const getAllCustomers = catchAsync(async (req, res) => {
  const companyId = req.user!.companyId as string;
  const filters = pick(req.query, ["searchTerm", "email"]);
  const options = {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 10,
  };

  const result = await CustomerService.getAllCustomers(companyId, filters, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Customers retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getCustomerByPublicId = catchAsync(async (req, res) => {
  const companyId = req.user!.companyId as string;
  const { publicId } = req.params;

  const result = await CustomerService.getCustomerByPublicId(companyId, publicId as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Customer retrieved successfully",
    data: result,
  });
});

const updateCustomer = catchAsync(async (req, res) => {
  const companyId = req.user!.companyId as string;
  const { publicId } = req.params;

  const result = await CustomerService.updateCustomer(companyId, publicId as string, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Customer updated successfully",
    data: result,
  });
});

const deleteCustomer = catchAsync(async (req, res) => {
  const companyId = req.user!.companyId as string;
  const { publicId } = req.params;

  await CustomerService.deleteCustomer(companyId, publicId as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Customer deleted successfully",
    data: null,
  });
});

export const CustomerController = {
  upsertCustomer,
  getAllCustomers,
  getCustomerByPublicId,
  updateCustomer,
  deleteCustomer,
};
