/*
  Warnings:

  - The `plan` column on the `companies` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[email]` on the table `companies` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `email` to the `companies` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CompanyPlan" AS ENUM ('FREE', 'STARTER', 'GROWTH', 'ENTERPRISE');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "email" TEXT NOT NULL,
DROP COLUMN "plan",
ADD COLUMN     "plan" "CompanyPlan" DEFAULT 'FREE';

-- CreateIndex
CREATE UNIQUE INDEX "companies_email_key" ON "companies"("email");
