-- AlterEnum
ALTER TYPE "public"."TripStatus" ADD VALUE 'DONE';

-- AlterTable
ALTER TABLE "public"."Accommodation" ADD COLUMN     "userEmail" TEXT;

-- AlterTable
ALTER TABLE "public"."AiConversation" ADD COLUMN     "userEmail" TEXT;

-- AlterTable
ALTER TABLE "public"."Transportation" ADD COLUMN     "userEmail" TEXT;

-- CreateTable
CREATE TABLE "public"."TripPlan" (
    "id" TEXT NOT NULL,
    "tripId" TEXT,
    "city" TEXT NOT NULL,
    "country" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "duration" TEXT,
    "sehir_bilgisi" TEXT,
    "gun_plani" TEXT,
    "yemek_rehberi" TEXT,
    "pratik_bilgiler" TEXT,
    "butce_tahmini" TEXT,
    "raw_markdown" TEXT,
    "raw_html" TEXT,
    "ai_model" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT,
    "total_cost" DOUBLE PRECISION,
    "daily_cost" DOUBLE PRECISION,
    "interests" TEXT,
    "budget_level" TEXT,
    "travel_style" TEXT,
    "accommodation" TEXT,
    "transportation" TEXT,
    "status" "public"."TripStatus" NOT NULL DEFAULT 'PLANNED',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userEmail" TEXT,

    CONSTRAINT "TripPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TripPlan_city_country_idx" ON "public"."TripPlan"("city", "country");

-- CreateIndex
CREATE INDEX "TripPlan_generated_at_idx" ON "public"."TripPlan"("generated_at");

-- CreateIndex
CREATE INDEX "TripPlan_user_id_idx" ON "public"."TripPlan"("user_id");

-- CreateIndex
CREATE INDEX "TripPlan_userEmail_idx" ON "public"."TripPlan"("userEmail");

-- CreateIndex
CREATE INDEX "Accommodation_userEmail_idx" ON "public"."Accommodation"("userEmail");

-- CreateIndex
CREATE INDEX "AiConversation_userEmail_idx" ON "public"."AiConversation"("userEmail");

-- CreateIndex
CREATE INDEX "Transportation_userEmail_idx" ON "public"."Transportation"("userEmail");

-- AddForeignKey
ALTER TABLE "public"."AiConversation" ADD CONSTRAINT "AiConversation_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "public"."User"("email") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Accommodation" ADD CONSTRAINT "Accommodation_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "public"."User"("email") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transportation" ADD CONSTRAINT "Transportation_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "public"."User"("email") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TripPlan" ADD CONSTRAINT "TripPlan_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "public"."Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TripPlan" ADD CONSTRAINT "TripPlan_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "public"."User"("email") ON DELETE SET NULL ON UPDATE CASCADE;
