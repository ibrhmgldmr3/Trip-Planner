/*
  Warnings:

  - The values [DONE] on the enum `TripStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `priceUnit` on the `Accommodation` table. All the data in the column will be lost.
  - The `type` column on the `Accommodation` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `Accommodation` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `category` column on the `Activity` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `Transportation` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `category` on the `BudgetItem` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `type` on the `Transportation` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "public"."BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."PriceType" AS ENUM ('PER_PERSON', 'TOTAL');

-- CreateEnum
CREATE TYPE "public"."TransportType" AS ENUM ('FLIGHT', 'TRAIN', 'BUS', 'FERRY', 'RENTAL_CAR', 'TAXI', 'PUBLIC', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."AccommodationType" AS ENUM ('HOTEL', 'HOSTEL', 'APARTMENT', 'GUESTHOUSE', 'CAMPING', 'RESORT', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."ActivityType" AS ENUM ('SIGHTSEEING', 'CULTURE', 'NATURE', 'ADVENTURE', 'RELAXATION', 'SHOPPING', 'FOOD', 'ENTERTAINMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."BudgetCategory" AS ENUM ('TRANSPORT', 'ACCOMMODATION', 'FOOD', 'ACTIVITIES', 'SHOPPING', 'ENTERTAINMENT', 'OTHER');

-- AlterEnum
BEGIN;
CREATE TYPE "public"."TripStatus_new" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');
ALTER TABLE "public"."Trip" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."TripPlan" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."Trip" ALTER COLUMN "status" TYPE "public"."TripStatus_new" USING ("status"::text::"public"."TripStatus_new");
ALTER TABLE "public"."TripPlan" ALTER COLUMN "status" TYPE "public"."TripStatus_new" USING ("status"::text::"public"."TripStatus_new");
ALTER TYPE "public"."TripStatus" RENAME TO "TripStatus_old";
ALTER TYPE "public"."TripStatus_new" RENAME TO "TripStatus";
DROP TYPE "public"."TripStatus_old";
ALTER TABLE "public"."Trip" ALTER COLUMN "status" SET DEFAULT 'PLANNED';
ALTER TABLE "public"."TripPlan" ALTER COLUMN "status" SET DEFAULT 'PLANNED';
COMMIT;

-- AlterTable
ALTER TABLE "public"."Accommodation" DROP COLUMN "priceUnit",
ADD COLUMN     "priceType" "public"."PriceType" NOT NULL DEFAULT 'TOTAL',
DROP COLUMN "type",
ADD COLUMN     "type" "public"."AccommodationType" NOT NULL DEFAULT 'HOTEL',
DROP COLUMN "status",
ADD COLUMN     "status" "public"."BookingStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "public"."Activity" DROP COLUMN "category",
ADD COLUMN     "category" "public"."ActivityType" NOT NULL DEFAULT 'OTHER';

-- AlterTable
ALTER TABLE "public"."BudgetItem" ADD COLUMN     "isPerPerson" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "category",
ADD COLUMN     "category" "public"."BudgetCategory" NOT NULL;

-- AlterTable
ALTER TABLE "public"."DailyPlan" ADD COLUMN     "isEmpty" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."Transportation" ADD COLUMN     "priceType" "public"."PriceType" NOT NULL DEFAULT 'PER_PERSON',
DROP COLUMN "type",
ADD COLUMN     "type" "public"."TransportType" NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "public"."BookingStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "public"."Trip" ADD COLUMN     "budget_level" TEXT,
ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "total_cost" DOUBLE PRECISION,
ADD COLUMN     "travel_style" TEXT,
ADD COLUMN     "travelers" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."TripPlan" ADD COLUMN     "travelers" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "public"."BudgetBreakdown" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "transport" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "accommodation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activities" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "food" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "other" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimatedTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentBudget" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "BudgetBreakdown_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BudgetBreakdown_tripId_key" ON "public"."BudgetBreakdown"("tripId");

-- AddForeignKey
ALTER TABLE "public"."BudgetBreakdown" ADD CONSTRAINT "BudgetBreakdown_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "public"."Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
