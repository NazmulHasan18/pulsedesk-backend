import AppError from "../../utils/AppError";
// NOTE: adjust this import to wherever your shared Prisma client instance lives
// (e.g. '../../lib/prisma' or '../../shared/prisma') — swap in your existing
// singleton instead of instantiating a new PrismaClient here.
import { prisma } from "../../lib/prisma";
import { ICreateFaqDocPayload, IFaqSearchQuery, IUpdateFaqDocPayload } from "./faq.interface";

// ---------------------------------------------------------------------------
// Embeddings placeholder
// ---------------------------------------------------------------------------
// TODO(pgvector): once pgvector is wired into the schema (embedding
// Unsupported("vector") + raw SQL), replace this with a real embedding call
// (e.g. via Groq/OpenAI) and swap `searchDocs` below for a cosine-similarity
// ORDER BY using $queryRaw. Keeping the same function signatures means the
// controller/route layer won't need to change when that happens.
const generatePlaceholderEmbedding = (text: string): number[] => {
  const dims = 32;
  const vector = new Array(dims).fill(0);
  for (let i = 0; i < text.length; i += 1) {
    const idx = i % dims;
    vector[idx] += text.charCodeAt(i);
  }
  const max = Math.max(...vector, 1);
  return vector.map((v) => Number((v / max).toFixed(4)));
};

// ---------------------------------------------------------------------------
// FAQ Category
// ---------------------------------------------------------------------------
const createCategory = async (companyId: string, name: string) => {
  const existing = await prisma.faqCategory.findUnique({
    where: { companyId_name: { companyId, name } },
  });
  if (existing) {
    throw new AppError(409, "A category with this name already exists");
  }
  return prisma.faqCategory.create({ data: { companyId, name } });
};

const getCategories = async (companyId: string) => {
  return prisma.faqCategory.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    include: { _count: { select: { faqDocs: true } } },
  });
};

const getCategoryByPublicId = async (companyId: string, publicId: string) => {
  const category = await prisma.faqCategory.findFirst({
    where: { companyId, publicId },
  });
  if (!category) {
    throw new AppError(404, "FAQ category not found");
  }
  return category;
};

const updateCategory = async (companyId: string, publicId: string, name: string) => {
  const category = await getCategoryByPublicId(companyId, publicId);

  const duplicate = await prisma.faqCategory.findUnique({
    where: { companyId_name: { companyId, name } },
  });
  if (duplicate && duplicate.id !== category.id) {
    throw new AppError(409, "A category with this name already exists");
  }

  return prisma.faqCategory.update({
    where: { id: category.id },
    data: { name },
  });
};

const deleteCategory = async (companyId: string, publicId: string) => {
  const category = await getCategoryByPublicId(companyId, publicId);
  // FaqDoc.categoryId is onDelete: SetNull, so docs are preserved, just uncategorized.
  await prisma.faqCategory.delete({ where: { id: category.id } });
  return null;
};

// ---------------------------------------------------------------------------
// FAQ Doc
// ---------------------------------------------------------------------------
const resolveCategoryDbId = async (
  companyId: string,
  categoryPublicId?: string | null,
): Promise<string | null | undefined> => {
  if (categoryPublicId === undefined) return undefined; // not touched
  if (categoryPublicId === null) return null; // explicit unset
  const category = await getCategoryByPublicId(companyId, categoryPublicId);
  return category.id;
};

const createDoc = async (companyId: string, payload: ICreateFaqDocPayload) => {
  const categoryDbId = await resolveCategoryDbId(companyId, payload.categoryId);
  const embedding = generatePlaceholderEmbedding(`${payload.question} ${payload.answer}`);

  return prisma.faqDoc.create({
    data: {
      companyId,
      question: payload.question,
      answer: payload.answer,
      categoryId: categoryDbId ?? undefined,
      embedding,
    },
    include: { category: true },
  });
};

const getDocs = async (
  companyId: string,
  filters: { categoryId?: string; page?: number; limit?: number },
) => {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const limit = filters.limit && filters.limit > 0 ? filters.limit : 20;

  let categoryDbId: string | undefined;
  if (filters.categoryId) {
    const category = await getCategoryByPublicId(companyId, filters.categoryId);
    categoryDbId = category.id;
  }

  const where = {
    companyId,
    ...(categoryDbId ? { categoryId: categoryDbId } : {}),
  };

  const [docs, total] = await Promise.all([
    prisma.faqDoc.findMany({
      where,
      include: { category: true },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.faqDoc.count({ where }),
  ]);

  return { docs, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

const getDocByPublicId = async (companyId: string, publicId: string) => {
  const doc = await prisma.faqDoc.findFirst({
    where: { companyId, publicId },
    include: { category: true },
  });
  if (!doc) {
    throw new AppError(404, "FAQ doc not found");
  }
  return doc;
};

const updateDoc = async (companyId: string, publicId: string, payload: IUpdateFaqDocPayload) => {
  const doc = await getDocByPublicId(companyId, publicId);
  const categoryDbId = await resolveCategoryDbId(companyId, payload.categoryId);

  const nextQuestion = payload.question ?? doc.question;
  const nextAnswer = payload.answer ?? doc.answer;
  const contentChanged = payload.question !== undefined || payload.answer !== undefined;

  return prisma.faqDoc.update({
    where: { id: doc.id },
    data: {
      question: payload.question,
      answer: payload.answer,
      ...(categoryDbId !== undefined ? { categoryId: categoryDbId } : {}),
      ...(contentChanged ? { embedding: generatePlaceholderEmbedding(`${nextQuestion} ${nextAnswer}`) } : {}),
    },
    include: { category: true },
  });
};

const deleteDoc = async (companyId: string, publicId: string) => {
  const doc = await getDocByPublicId(companyId, publicId);
  await prisma.faqDoc.delete({ where: { id: doc.id } });
  return null;
};

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
// NOTE: naive ILIKE-based relevance search over question/answer. This is a
// stand-in for the AI module's RAG lookup until pgvector similarity search
// replaces it (see TODO(pgvector) above).
const searchDocs = async (companyId: string, params: IFaqSearchQuery) => {
  const { q, categoryId, limit = 10 } = params;

  let categoryDbId: string | undefined;
  if (categoryId) {
    const category = await getCategoryByPublicId(companyId, categoryId);
    categoryDbId = category.id;
  }

  return prisma.faqDoc.findMany({
    where: {
      companyId,
      ...(categoryDbId ? { categoryId: categoryDbId } : {}),
      OR: [
        { question: { contains: q, mode: "insensitive" } },
        { answer: { contains: q, mode: "insensitive" } },
      ],
    },
    include: { category: true },
    take: limit,
    orderBy: { updatedAt: "desc" },
  });
};

export const FaqService = {
  // categories
  createCategory,
  getCategories,
  getCategoryByPublicId,
  updateCategory,
  deleteCategory,
  // docs
  createDoc,
  getDocs,
  getDocByPublicId,
  updateDoc,
  deleteDoc,
  // search
  searchDocs,
};
