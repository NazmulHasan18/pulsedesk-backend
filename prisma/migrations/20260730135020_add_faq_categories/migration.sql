-- AlterTable
ALTER TABLE "faq_docs" ADD COLUMN     "categoryId" TEXT;

-- CreateTable
CREATE TABLE "faq_categories" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "faq_categories_publicId_key" ON "faq_categories"("publicId");

-- CreateIndex
CREATE INDEX "faq_categories_companyId_idx" ON "faq_categories"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "faq_categories_companyId_name_key" ON "faq_categories"("companyId", "name");

-- CreateIndex
CREATE INDEX "faq_docs_categoryId_idx" ON "faq_docs"("categoryId");

-- AddForeignKey
ALTER TABLE "faq_categories" ADD CONSTRAINT "faq_categories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faq_docs" ADD CONSTRAINT "faq_docs_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "faq_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
