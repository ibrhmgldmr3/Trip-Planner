-- Trip + TripPlan (ve kullanılmayan Activity, Accommodation, Transportation,
-- DailyPlan, BudgetItem, AiConversation) tek bir Plan modelinde birleşir.
--
-- DİKKAT: Bu migration eski tabloları siler. TripPlan satırları Plan'a taşınır;
-- yalnızca /api/trip üzerinden oluşturulmuş, bir plana bağlı olmayan Trip kayıtları
-- ile onlara bağlı alt kayıtlar taşınmaz. Gerçek veri içeren bir veritabanında
-- çalıştırmadan önce yedek alın.

-- CreateEnum
CREATE TYPE "PlanSource" AS ENUM ('AI', 'MANUAL');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('PLANNED', 'CANCELLED', 'DONE');

-- CreateEnum
CREATE TYPE "DaySlot" AS ENUM ('MORNING', 'NOON', 'EVENING');

-- CreateEnum
CREATE TYPE "BudgetCategory" AS ENUM ('TRANSPORT', 'ACCOMMODATION', 'FOOD', 'ACTIVITIES', 'SHOPPING', 'OTHER');

-- CreateEnum
CREATE TYPE "BudgetKind" AS ENUM ('ESTIMATE', 'EXPENSE');

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "PlanSource" NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'PLANNED',
    "city" TEXT NOT NULL,
    "country" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "startDate" DATE,
    "endDate" DATE,
    "travelers" INTEGER NOT NULL DEFAULT 1,
    "travelStyle" TEXT,
    "budgetLevel" TEXT,
    "interests" TEXT[],
    "transportPrefs" TEXT[],
    "stayPreference" TEXT,
    "specialRequests" TEXT,
    "cityGuide" TEXT,
    "foodGuide" TEXT,
    "practicalInfo" TEXT,
    "transport" JSONB,
    "accommodation" JSONB,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "totalCost" DOUBLE PRECISION,
    "targetBudget" DOUBLE PRECISION,
    "aiModel" TEXT,
    "legacyDayPlan" TEXT,
    "legacyBudget" TEXT,
    "legacyRaw" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanDay" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "title" TEXT,
    "notes" TEXT,
    "isFree" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PlanDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanStop" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slot" "DaySlot",
    "startTime" TEXT,
    "endTime" TEXT,
    "cost" DOUBLE PRECISION,
    "category" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,

    CONSTRAINT "PlanStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "kind" "BudgetKind" NOT NULL,
    "category" "BudgetCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoCache" (
    "query" TEXT NOT NULL,
    "name" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeoCache_pkey" PRIMARY KEY ("query")
);

-- CreateIndex
CREATE INDEX "Plan_userId_createdAt_idx" ON "Plan"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Plan_userId_status_idx" ON "Plan"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PlanDay_planId_dayNumber_key" ON "PlanDay"("planId", "dayNumber");

-- CreateIndex
CREATE INDEX "PlanStop_dayId_position_idx" ON "PlanStop"("dayId", "position");

-- CreateIndex
CREATE INDEX "BudgetLine_planId_kind_idx" ON "BudgetLine"("planId", "kind");

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanDay" ADD CONSTRAINT "PlanDay_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanStop" ADD CONSTRAINT "PlanStop_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "PlanDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ------------------------------------------------------------------
-- Veri taşıma: TripPlan -> Plan
-- Sahibi belli olmayan (user_id boş ya da silinmiş kullanıcıya ait) planlar
-- hiçbir hesaptan görülemediği için taşınmaz.
-- ------------------------------------------------------------------

CREATE FUNCTION "tp_safe_jsonb"(txt text) RETURNS jsonb AS $$
BEGIN
  RETURN txt::jsonb;
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$ LANGUAGE plpgsql IMMUTABLE;

CREATE FUNCTION "tp_safe_num"(txt text) RETURNS double precision AS $$
BEGIN
  RETURN txt::double precision;
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$ LANGUAGE plpgsql IMMUTABLE;

CREATE FUNCTION "tp_text_array"(txt text) RETURNS text[] AS $$
DECLARE doc jsonb := "tp_safe_jsonb"(txt);
BEGIN
  IF doc IS NULL OR jsonb_typeof(doc) <> 'array' THEN
    RETURN '{}';
  END IF;
  RETURN ARRAY(SELECT value FROM jsonb_array_elements_text(doc) AS t(value) WHERE value <> 'manuel_planlama');
END $$ LANGUAGE plpgsql IMMUTABLE;

INSERT INTO "Plan" (
  "id", "userId", "source", "status", "city", "country", "startDate", "endDate", "travelers",
  "travelStyle", "budgetLevel", "interests", "transportPrefs", "stayPreference",
  "cityGuide", "foodGuide", "practicalInfo", "transport", "accommodation",
  "totalCost", "aiModel", "legacyDayPlan", "legacyBudget", "legacyRaw",
  "completedAt", "createdAt", "updatedAt"
)
SELECT
  tp."id",
  tp."user_id",
  (CASE WHEN tp."ai_model" = 'manual_planning' THEN 'MANUAL' ELSE 'AI' END)::"PlanSource",
  (CASE tp."status"::text WHEN 'CANCELLED' THEN 'CANCELLED' WHEN 'DONE' THEN 'DONE' ELSE 'PLANNED' END)::"PlanStatus",
  tp."city",
  NULLIF(tp."country", ''),
  tp."startDate"::date,
  tp."endDate"::date,
  CASE WHEN tp."ai_model" = 'manual_planning'
    THEN GREATEST(1, COALESCE("tp_safe_num"(substring(tp."pratik_bilgiler" from '^(\d+) kişi'))::int, 1))
    ELSE 1 END,
  tp."travel_style",
  CASE WHEN tp."ai_model" = 'manual_planning' THEN NULL ELSE tp."budget_level" END,
  "tp_text_array"(tp."interests"),
  "tp_text_array"(tp."transportation"),
  CASE WHEN tp."ai_model" = 'manual_planning' OR "tp_safe_jsonb"(tp."accommodation") IS NOT NULL
    THEN NULL ELSE NULLIF(tp."accommodation", '') END,
  CASE WHEN tp."ai_model" = 'manual_planning' THEN NULL ELSE tp."sehir_bilgisi" END,
  tp."yemek_rehberi",
  CASE WHEN tp."ai_model" = 'manual_planning' THEN NULL ELSE tp."pratik_bilgiler" END,
  CASE WHEN jsonb_typeof("tp_safe_jsonb"(tp."transportation")) = 'object' THEN "tp_safe_jsonb"(tp."transportation") END,
  CASE WHEN jsonb_typeof("tp_safe_jsonb"(tp."accommodation")) = 'object' THEN "tp_safe_jsonb"(tp."accommodation") END,
  tp."total_cost",
  CASE WHEN tp."ai_model" = 'manual_planning' THEN NULL ELSE tp."ai_model" END,
  tp."gun_plani",
  tp."butce_tahmini",
  CASE WHEN tp."ai_model" = 'manual_planning' THEN NULL ELSE tp."raw_markdown" END,
  tp."completedAt",
  tp."createdAt",
  tp."updatedAt"
FROM "TripPlan" tp
WHERE tp."user_id" IN (SELECT "id" FROM "User");

-- Manuel planların JSON olarak saklanan günleri -> PlanDay / PlanStop
CREATE TEMP TABLE "_tp_days" AS
SELECT
  'day_' || replace(gen_random_uuid()::text, '-', '') AS "id",
  p."id" AS "planId",
  d.ord::int AS "dayNumber",
  d.elem AS "elem"
FROM "Plan" p
CROSS JOIN LATERAL jsonb_array_elements("tp_safe_jsonb"(p."legacyDayPlan")) WITH ORDINALITY AS d(elem, ord)
WHERE p."source" = 'MANUAL'
  AND jsonb_typeof("tp_safe_jsonb"(p."legacyDayPlan")) = 'array'
  AND jsonb_typeof(d.elem) = 'object';

INSERT INTO "PlanDay" ("id", "planId", "dayNumber", "notes", "isFree")
SELECT "id", "planId", "dayNumber", NULLIF("elem"->>'notes', ''), COALESCE("elem"->>'isEmpty', 'false') = 'true'
FROM "_tp_days";

INSERT INTO "PlanStop" ("id", "dayId", "position", "name", "description", "startTime", "endTime", "cost")
SELECT
  'stop_' || replace(gen_random_uuid()::text, '-', ''),
  d."id",
  a.ord::int,
  COALESCE(NULLIF(a.elem->>'name', ''), 'Aktivite'),
  NULLIF(a.elem->>'description', ''),
  NULLIF(a.elem->>'startTime', ''),
  NULLIF(a.elem->>'endTime', ''),
  "tp_safe_num"(a.elem->>'cost')
FROM "_tp_days" d
CROSS JOIN LATERAL jsonb_array_elements(d."elem"->'activities') WITH ORDINALITY AS a(elem, ord)
WHERE jsonb_typeof(d."elem"->'activities') = 'array'
  AND jsonb_typeof(a.elem) = 'object';

-- Manuel planların bütçe dökümü -> BudgetLine (tahmin)
INSERT INTO "BudgetLine" ("id", "planId", "kind", "category", "description", "amount")
SELECT
  'bl_' || replace(gen_random_uuid()::text, '-', ''),
  p."id",
  'ESTIMATE'::"BudgetKind",
  (CASE b.key
    WHEN 'transport' THEN 'TRANSPORT'
    WHEN 'accommodation' THEN 'ACCOMMODATION'
    WHEN 'activities' THEN 'ACTIVITIES'
    WHEN 'food' THEN 'FOOD'
    ELSE 'OTHER' END)::"BudgetCategory",
  (CASE b.key
    WHEN 'transport' THEN 'Ulaşım'
    WHEN 'accommodation' THEN 'Konaklama'
    WHEN 'activities' THEN 'Aktiviteler'
    WHEN 'food' THEN 'Yeme-içme'
    ELSE 'Diğer' END),
  "tp_safe_num"(b.value)
FROM "Plan" p
CROSS JOIN LATERAL jsonb_each_text("tp_safe_jsonb"(p."legacyBudget")) AS b(key, value)
WHERE p."source" = 'MANUAL'
  AND jsonb_typeof("tp_safe_jsonb"(p."legacyBudget")) = 'object'
  AND "tp_safe_num"(b.value) > 0;

-- Yapılandırılmış hale gelen manuel planlarda eski metin alanlarına gerek kalmadı.
UPDATE "Plan" SET "legacyDayPlan" = NULL, "legacyBudget" = NULL WHERE "source" = 'MANUAL';

DROP TABLE "_tp_days";
DROP FUNCTION "tp_text_array"(text);
DROP FUNCTION "tp_safe_num"(text);
DROP FUNCTION "tp_safe_jsonb"(text);

-- ------------------------------------------------------------------
-- Eski tablolar
-- ------------------------------------------------------------------

-- DropForeignKey
ALTER TABLE "Accommodation" DROP CONSTRAINT "Accommodation_tripId_fkey";

-- DropForeignKey
ALTER TABLE "Accommodation" DROP CONSTRAINT "Accommodation_userEmail_fkey";

-- DropForeignKey
ALTER TABLE "Activity" DROP CONSTRAINT "Activity_tripId_fkey";

-- DropForeignKey
ALTER TABLE "AiConversation" DROP CONSTRAINT "AiConversation_tripId_fkey";

-- DropForeignKey
ALTER TABLE "AiConversation" DROP CONSTRAINT "AiConversation_userEmail_fkey";

-- DropForeignKey
ALTER TABLE "BudgetItem" DROP CONSTRAINT "BudgetItem_tripId_fkey";

-- DropForeignKey
ALTER TABLE "DailyPlan" DROP CONSTRAINT "DailyPlan_tripId_fkey";

-- DropForeignKey
ALTER TABLE "Transportation" DROP CONSTRAINT "Transportation_tripId_fkey";

-- DropForeignKey
ALTER TABLE "Transportation" DROP CONSTRAINT "Transportation_userEmail_fkey";

-- DropForeignKey
ALTER TABLE "Trip" DROP CONSTRAINT "Trip_userId_fkey";

-- DropForeignKey
ALTER TABLE "TripPlan" DROP CONSTRAINT "TripPlan_tripId_fkey";

-- DropForeignKey
ALTER TABLE "TripPlan" DROP CONSTRAINT "TripPlan_userEmail_fkey";

-- DropTable
DROP TABLE "Accommodation";

-- DropTable
DROP TABLE "Activity";

-- DropTable
DROP TABLE "AiConversation";

-- DropTable
DROP TABLE "BudgetItem";

-- DropTable
DROP TABLE "DailyPlan";

-- DropTable
DROP TABLE "Transportation";

-- DropTable
DROP TABLE "Trip";

-- DropTable
DROP TABLE "TripPlan";

-- DropEnum
DROP TYPE "TripStatus";

