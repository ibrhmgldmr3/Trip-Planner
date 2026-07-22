-- Yapılandırılmış LLM çıktısı için additive (yalnızca ekleme) migration.
--
-- plan_json           : Zod ile doğrulanmış yapılandırılmış plan.
-- plan_schema_version : null = eski markdown satırı, 1 = tripPlanStructuredSchema v1.
--
-- Her iki sütun da nullable; mevcut satırlar etkilenmez, geri alınabilir.
-- Geriye dönük veri taşıma (backfill) BİLEREK yapılmıyor: eski markdown
-- satırlarını yeniden yapılandırmak LLM maliyeti gerektirir ve kayıplıdır.

-- AlterTable
ALTER TABLE "public"."TripPlan" ADD COLUMN     "plan_json" JSONB,
ADD COLUMN     "plan_schema_version" INTEGER;

-- Geri alma (rollback):
--   ALTER TABLE "public"."TripPlan" DROP COLUMN "plan_schema_version";
--   ALTER TABLE "public"."TripPlan" DROP COLUMN "plan_json";
