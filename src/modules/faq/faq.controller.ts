import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { FaqService } from "./faq.service";
import AppError from "../../utils/AppError";

// NOTE: assumes your auth middleware already augments `req.user` with at
// least `{ companyId: string; role: 'ADMIN' | 'AGENT' }` for company-scoped
// tokens (same shape used across the other modules). Adjust field names if
// your JWT payload differs.

// ---------------------------------------------------------------------------
// Category
// ---------------------------------------------------------------------------
const createCategory = catchAsync(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;

  if (!companyId) {
    throw new AppError(400, "company id is required");
  }

  const result = await FaqService.createCategory(companyId, req.body.name);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "FAQ category created successfully",
    data: result,
  });
});

const getCategories = catchAsync(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  if (!companyId) {
    throw new AppError(400, "company id is required");
  }
  const result = await FaqService.getCategories(companyId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "FAQ categories retrieved successfully",
    data: result,
  });
});

const getCategory = catchAsync(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  if (!companyId) {
    throw new AppError(400, "company id is required");
  }
  const result = await FaqService.getCategoryByPublicId(companyId, req.params.id as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "FAQ category retrieved successfully",
    data: result,
  });
});

const updateCategory = catchAsync(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  if (!companyId) {
    throw new AppError(400, "company id is required");
  }
  const result = await FaqService.updateCategory(companyId, req.params.id as string, req.body.name);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "FAQ category updated successfully",
    data: result,
  });
});

const deleteCategory = catchAsync(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  if (!companyId) {
    throw new AppError(400, "company id is required");
  }
  await FaqService.deleteCategory(companyId, req.params.id as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "FAQ category deleted successfully",
    data: null,
  });
});

// ---------------------------------------------------------------------------
// Doc
// ---------------------------------------------------------------------------
const createDoc = catchAsync(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  if (!companyId) {
    throw new AppError(400, "company id is required");
  }
  const result = await FaqService.createDoc(companyId, req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "FAQ doc created successfully",
    data: result,
  });
});

const getDocs = catchAsync(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  if (!companyId) {
    throw new AppError(400, "company id is required");
  }
  const { categoryId, page, limit } = req.query;

  const { docs, meta } = await FaqService.getDocs(companyId, {
    categoryId: categoryId as string | undefined,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "FAQ docs retrieved successfully",
    meta,
    data: docs,
  });
});

const getDoc = catchAsync(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  if (!companyId) {
    throw new AppError(400, "company id is required");
  }
  const result = await FaqService.getDocByPublicId(companyId, req.params.id as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "FAQ doc retrieved successfully",
    data: result,
  });
});

const updateDoc = catchAsync(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  if (!companyId) {
    throw new AppError(400, "company id is required");
  }
  const result = await FaqService.updateDoc(companyId, req.params.id as string, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "FAQ doc updated successfully",
    data: result,
  });
});

const deleteDoc = catchAsync(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  if (!companyId) {
    throw new AppError(400, "company id is required");
  }
  await FaqService.deleteDoc(companyId, req.params.id as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "FAQ doc deleted successfully",
    data: null,
  });
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
const searchDocs = catchAsync(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  if (!companyId) {
    throw new AppError(400, "company id is required");
  }
  const { q, categoryId, limit } = req.query;

  const result = await FaqService.searchDocs(companyId, {
    q: q as string,
    categoryId: categoryId as string | undefined,
    limit: limit ? Number(limit) : undefined,
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "FAQ search results retrieved successfully",
    data: result,
  });
});

export const FaqController = {
  createCategory,
  getCategories,
  getCategory,
  updateCategory,
  deleteCategory,
  createDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  searchDocs,
};
