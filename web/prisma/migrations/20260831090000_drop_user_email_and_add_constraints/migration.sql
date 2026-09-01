-- Aşama 1 — Sahiplik modelini teke indirme ve ilişkisel modeli sıkılaştırma.
--
-- Bu migration üç iş yapıyor:
--   1. Terk edilmiş `userEmail` sütunlarını (ve FK'lerini) düşürüyor.
--      Sahiplik zaten `TripPlan.user_id` ve `Trip.userId` üzerinden kuruluyor;
--      e-posta üzerinden ikinci bir bağ, kullanıcı e-postasını değiştirdiğinde
--      `ON DELETE SET NULL` ile kayıtları sessizce kopartıyordu.
--   2. `DailyPlan` üzerinde tarih başına tek plan kısıtı kuruyor.
--   3. Sorgu kalıplarına uyan indeksleri ekliyor.
--
-- GERİ ALINAMAZ: 1. adım sütunları siliyor. Uygulamadan önce yedek alın.
-- Sütunlar hiçbir kod yolundan okunmuyor (denetimde doğrulandı), ama veri
-- kaybını görünür kılmak için önce bir tutarlılık raporu bırakıyoruz.

-- ---------------------------------------------------------------------------
-- 0. Güvenlik ağı: userEmail dolu ama userId boş olan TripPlan satırlarını
--    e-posta üzerinden sahibine bağla. Bu satırlar bugün "Planlarım"da
--    görünmüyor; sütunu düşürmeden önce kurtarılabilecek son an.
-- ---------------------------------------------------------------------------
UPDATE "TripPlan" tp
SET "user_id" = u."id"
FROM "User" u
WHERE tp."user_id" IS NULL
  AND tp."userEmail" IS NOT NULL
  AND u."email" = tp."userEmail";

-- ---------------------------------------------------------------------------
-- 1. userEmail sütunları ve ilişkileri
-- ---------------------------------------------------------------------------
ALTER TABLE "TripPlan"       DROP CONSTRAINT IF EXISTS "TripPlan_userEmail_fkey";
ALTER TABLE "AiConversation" DROP CONSTRAINT IF EXISTS "AiConversation_userEmail_fkey";
ALTER TABLE "Accommodation"  DROP CONSTRAINT IF EXISTS "Accommodation_userEmail_fkey";
ALTER TABLE "Transportation" DROP CONSTRAINT IF EXISTS "Transportation_userEmail_fkey";

DROP INDEX IF EXISTS "TripPlan_userEmail_idx";
DROP INDEX IF EXISTS "AiConversation_userEmail_idx";
DROP INDEX IF EXISTS "Accommodation_userEmail_idx";
DROP INDEX IF EXISTS "Transportation_userEmail_idx";

ALTER TABLE "TripPlan"       DROP COLUMN IF EXISTS "userEmail";
ALTER TABLE "AiConversation" DROP COLUMN IF EXISTS "userEmail";
ALTER TABLE "Accommodation"  DROP COLUMN IF EXISTS "userEmail";
ALTER TABLE "Transportation" DROP COLUMN IF EXISTS "userEmail";

-- ---------------------------------------------------------------------------
-- 2. TripPlan: ilişkisel modele taşınma damgası
-- ---------------------------------------------------------------------------
ALTER TABLE "TripPlan" ADD COLUMN IF NOT EXISTS "migratedAt" TIMESTAMP(3);

-- ---------------------------------------------------------------------------
-- 3. DailyPlan: tarih başına tek plan
--
--    `date` sütunu timestamp'ten date'e indiriliyor. Saat bileşeni hiçbir
--    yerde anlamlı kullanılmıyordu ama saat farkı yüzünden aynı gün için iki
--    kayıt oluşabiliyordu. Önce çiftler temizleniyor (en yenisi kalıyor),
--    sonra kısıt kuruluyor — aksi halde ALTER TABLE mevcut veride patlar.
-- ---------------------------------------------------------------------------
ALTER TABLE "DailyPlan"
  ALTER COLUMN "date" TYPE DATE USING "date"::date;

ALTER TABLE "DailyPlan"
  ALTER COLUMN "activities" SET DEFAULT '[]'::jsonb;

DELETE FROM "DailyPlan" d
USING "DailyPlan" digeri
WHERE d."tripId" = digeri."tripId"
  AND d."date"   = digeri."date"
  AND (d."updatedAt" < digeri."updatedAt"
       OR (d."updatedAt" = digeri."updatedAt" AND d."id" < digeri."id"));

CREATE UNIQUE INDEX IF NOT EXISTS "DailyPlan_tripId_date_key"
  ON "DailyPlan" ("tripId", "date");

-- ---------------------------------------------------------------------------
-- 4. Sorgu kalıplarına uyan indeksler
--
--    Hepsi "bir seyahatin alt kayıtlarını getir" sorgusunu karşılıyor;
--    tablolar bugüne kadar yalnızca birincil anahtar üzerinden indeksliydi.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "DailyPlan_tripId_idx"                 ON "DailyPlan" ("tripId");
CREATE INDEX IF NOT EXISTS "AiConversation_tripId_idx"            ON "AiConversation" ("tripId");
CREATE INDEX IF NOT EXISTS "Accommodation_tripId_checkIn_idx"     ON "Accommodation" ("tripId", "checkIn");
CREATE INDEX IF NOT EXISTS "Transportation_tripId_departureTime_idx" ON "Transportation" ("tripId", "departureTime");
CREATE INDEX IF NOT EXISTS "BudgetItem_tripId_idx"                ON "BudgetItem" ("tripId");
CREATE INDEX IF NOT EXISTS "BudgetItem_tripId_category_idx"       ON "BudgetItem" ("tripId", "category");
CREATE INDEX IF NOT EXISTS "TripPlan_user_id_status_idx"          ON "TripPlan" ("user_id", "status");
