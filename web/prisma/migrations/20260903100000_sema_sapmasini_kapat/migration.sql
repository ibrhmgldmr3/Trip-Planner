-- ŞEMA SAPMASININ KALAN KISMINI KAPAT
--
-- 20260902140000 sapmanın iki KIRIK ÖZELLİK üreten kısmını kapatmıştı
-- (TripStatus.DONE ve BudgetItem.category). Bu migration geri kalanını
-- kapatıyor: şemada olmayan sütunlar, tablolar ve kullanılmayan enum tipleri.
--
-- KÖKENİ: 20250904121801_enhanced_schema, `prisma/schema.prisma` ile
-- ilişkisi kesilmiş bir modeli veritabanına yazmış — enum'lar, kişi başı
-- fiyat alanları, `Trip` üzerinde `TripPlan`a ait kolonlar. Şema sonradan
-- elle sadeleştirilmiş ama karşılığı migration hiç yazılmamış. Sapma
-- kapanmadan `prisma migrate dev` her çalıştırmada aynı farkı üretiyor.
--
-- PRISMA'NIN ÜRETTİĞİ DIFF'TEN NEDEN AYRILDIK
--
-- `prisma migrate diff` enum→metin dönüşümleri için `DROP COLUMN` +
-- `ADD COLUMN` üretiyor. Bu, sütundaki veriyi SESSİZCE SİLER. Bu
-- veritabanında ilgili tabloların hepsi boş, ama migration depoda duruyor ve
-- başka ortamlarda (staging, ekip arkadaşının makinesi) dolu olabilirler.
-- Bu yüzden her dönüşüm `ALTER COLUMN ... TYPE TEXT USING lower(...::text)`
-- ile yapılıyor: enum etiketi metne çevriliyor, satır korunuyor.
--
-- `lower()` bilinçli: uygulamanın sözlüğü küçük harf ("pending",
-- "confirmed", "cancelled"; bkz. api-schemas.ts `REZERVASYON_DURUMLARI`),
-- enum etiketleri ise büyük harf (PENDING, …).
--
-- TEK KAYIPLI ADIM: `TripPlan.travelers`. Bu veritabanında 32 satırda dolu
-- ve HEPSİNİN DEĞERİ 1 (varsayılan). Şemada karşılığı yok, hiçbir kod
-- okumuyor — kişi sayısı çarpanını kullanan mantık daha önce ölü kod olarak
-- kaldırılmıştı (bkz. budget/page.tsx başlığı, madde 6).

/* -------------------------------------------------------------------------- */
/* 1. Şemada hiç olmayan tablolar                                             */
/* -------------------------------------------------------------------------- */

-- `enhanced_schema` ile gelmiş, hiçbir yerden okunmuyor.
DROP TABLE IF EXISTS "BudgetBreakdown";

-- 20260722120000 sırasında sahipsiz kalan satırları kurtarmak için açılmış
-- geçici tablo. İşini bitirdi (0 satır).
DROP TABLE IF EXISTS "_TripPlanOrphanUserId";

/* -------------------------------------------------------------------------- */
/* 2. Accommodation — enum'lardan serbest metne                               */
/* -------------------------------------------------------------------------- */

-- `priceType` (PriceType) -> `priceUnit` (TEXT). Şemadaki sözlük
-- "total" | "night"; enum ise PER_PERSON | TOTAL. TOTAL temiz eşleşiyor.
-- DİKKAT: dolu bir veritabanında PER_PERSON satırları "per_person" olarak
-- kalır ve şemanın sözlüğüne UYMAZ — elle gözden geçirilmeleri gerekir.
-- Bu veritabanında hiç satır yok.
ALTER TABLE "Accommodation" RENAME COLUMN "priceType" TO "priceUnit";
ALTER TABLE "Accommodation" ALTER COLUMN "priceUnit" DROP DEFAULT;
ALTER TABLE "Accommodation" ALTER COLUMN "priceUnit" TYPE TEXT USING lower("priceUnit"::text);
ALTER TABLE "Accommodation" ALTER COLUMN "priceUnit" SET DEFAULT 'total';

ALTER TABLE "Accommodation" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Accommodation" ALTER COLUMN "type" TYPE TEXT USING lower("type"::text);
ALTER TABLE "Accommodation" ALTER COLUMN "type" DROP NOT NULL;

ALTER TABLE "Accommodation" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Accommodation" ALTER COLUMN "status" TYPE TEXT USING lower("status"::text);
ALTER TABLE "Accommodation" ALTER COLUMN "status" SET DEFAULT 'pending';

/* -------------------------------------------------------------------------- */
/* 3. Transportation                                                          */
/* -------------------------------------------------------------------------- */

-- Şemada Transportation'ın fiyat birimi alanı YOK; sütun tamamen düşüyor.
ALTER TABLE "Transportation" DROP COLUMN IF EXISTS "priceType";

ALTER TABLE "Transportation" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Transportation" ALTER COLUMN "type" TYPE TEXT USING lower("type"::text);

ALTER TABLE "Transportation" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Transportation" ALTER COLUMN "status" TYPE TEXT USING lower("status"::text);
ALTER TABLE "Transportation" ALTER COLUMN "status" SET DEFAULT 'pending';

/* -------------------------------------------------------------------------- */
/* 4. Activity                                                                */
/* -------------------------------------------------------------------------- */

ALTER TABLE "Activity" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "Activity" ALTER COLUMN "category" TYPE TEXT USING lower("category"::text);
ALTER TABLE "Activity" ALTER COLUMN "category" DROP NOT NULL;

/* -------------------------------------------------------------------------- */
/* 5. Şemada olmayan sütunlar                                                 */
/* -------------------------------------------------------------------------- */

-- Kişi başı fiyat modeli terk edildi; bütçe kalemleri tek tutar taşıyor.
ALTER TABLE "BudgetItem" DROP COLUMN IF EXISTS "isPerPerson";

-- `isEmpty` modelin İDDİASIYDI; gerçeği aktivite listesi söylüyor ve
-- `gunleriCoz` bunu aktivite sayısından türetiyor (bkz. plan-budget.ts).
ALTER TABLE "DailyPlan" DROP COLUMN IF EXISTS "isEmpty";

-- Bu beş sütun `TripPlan`a ait bilgiyi `Trip` üzerinde tekrarlıyordu.
-- Sahiplik ve bütçe artık ilişkisel modelde (BudgetItem) yaşıyor.
ALTER TABLE "Trip" DROP COLUMN IF EXISTS "budget_level";
ALTER TABLE "Trip" DROP COLUMN IF EXISTS "duration";
ALTER TABLE "Trip" DROP COLUMN IF EXISTS "total_cost";
ALTER TABLE "Trip" DROP COLUMN IF EXISTS "travel_style";
ALTER TABLE "Trip" DROP COLUMN IF EXISTS "travelers";

-- TEK KAYIPLI ADIM (yukarıdaki nota bakın).
ALTER TABLE "TripPlan" DROP COLUMN IF EXISTS "travelers";

/* -------------------------------------------------------------------------- */
/* 6. Artık hiçbir sütunun kullanmadığı enum tipleri                          */
/* -------------------------------------------------------------------------- */

DROP TYPE IF EXISTS "AccommodationType";
DROP TYPE IF EXISTS "ActivityType";
DROP TYPE IF EXISTS "BookingStatus";
DROP TYPE IF EXISTS "BudgetCategory";
DROP TYPE IF EXISTS "PriceType";
DROP TYPE IF EXISTS "TransportType";
