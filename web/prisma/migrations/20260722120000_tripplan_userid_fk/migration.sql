-- Faz 1: TripPlan sahipliğini user_id (User.id) üzerinde tekilleştir.
-- userEmail sütunu KORUNUYOR; ayrı bir migration'da düşürülecek.
--
-- ÖN KOŞUL: Bu migration, 20250904121801_enhanced_schema ile schema.prisma
-- arasındaki sapma çözüldükten sonra uygulanmalı. Buradaki ifadeler yalnızca
-- "TripPlan" ve "User" tablolarına dokunduğu için sapmadan bağımsızdır, ancak
-- prisma migrate deploy tüm bekleyen migration'ları sırayla çalıştırır.

-- 1) Sadece userEmail ile sahiplenmiş satırları doldur.
--    E-posta karşılaştırması lower() ile: kayıt/giriş akışları e-postayı
--    küçük harfe çevirirken Google sağlayıcısı bunu garanti etmiyor.
UPDATE "public"."TripPlan" tp
SET "user_id" = u."id"
FROM "public"."User" u
WHERE tp."user_id" IS NULL
  AND tp."userEmail" IS NOT NULL
  AND lower(u."email") = lower(tp."userEmail");

-- 2) Güvenlik ağı: yetim user_id değerlerini FK'den önce ayıkla.
--    Bu satırlar zaten hiçbir kullanıcıya görünmüyordu (plan.user_id !== user.id).
CREATE TABLE IF NOT EXISTS "public"."_TripPlanOrphanUserId" (
  "tripPlanId" TEXT PRIMARY KEY,
  "user_id"    TEXT NOT NULL,
  "kaydedildi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "public"."_TripPlanOrphanUserId" ("tripPlanId", "user_id")
SELECT tp."id", tp."user_id"
FROM "public"."TripPlan" tp
WHERE tp."user_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "public"."User" u WHERE u."id" = tp."user_id")
ON CONFLICT DO NOTHING;

UPDATE "public"."TripPlan" tp
SET "user_id" = NULL
WHERE tp."user_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "public"."User" u WHERE u."id" = tp."user_id");

-- 3) FK. (prisma migrate diff'in ürettiği ifadenin aynısı, şema niteleyicisi eklendi.)
--    Büyük tablolarda ACCESS EXCLUSIVE kilidi kısaltmak için bu ifade
--    "... NOT VALID;" + ayrı bir "VALIDATE CONSTRAINT" adımına bölünebilir.
-- AddForeignKey
ALTER TABLE "public"."TripPlan" ADD CONSTRAINT "TripPlan_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Geri alma (rollback):
--   ALTER TABLE "public"."TripPlan" DROP CONSTRAINT "TripPlan_user_id_fkey";
--   Backfill geri alınmaz ve alınmamalıdır (user_id değerleri doğru).
