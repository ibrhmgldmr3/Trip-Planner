-- Kalkış şehri.
--
-- Manuel planlayıcı artık "hangi şehirden hangi şehre" sorusunu soruyor ve
-- ulaşım süresi/maliyeti bu iki şehir arasındaki mesafeden hesaplanıyor
-- (src/lib/seyahat-mesafe.ts). Varış zaten `city` sütununda; kalkış için
-- karşılığı yoktu ve bilgi yalnızca `raw_markdown` metnine yazılabiliyordu.
-- Metin içindeki bir bilgi filtrelenemez, gruplanamaz, indekslenemez.
--
-- NULLABLE OLMAK ZORUNDA: bu alan sonradan eklendi. Mevcut satırlarda
-- kalkış şehri hiç toplanmadı; NOT NULL yapmak varsayılan bir değer
-- uydurmayı gerektirirdi ve o değer YANLIŞ olurdu. null burada "bilinmiyor"
-- demek ve arayüz bunu böyle gösteriyor.

ALTER TABLE "TripPlan" ADD COLUMN "origin_city" TEXT;

-- Güzergâh bazlı sorgular (örn. "İstanbul çıkışlı planlarım") iki sütunu
-- birlikte kullanıyor; mevcut ([city, country]) indeksi kalkışı kapsamıyor.
CREATE INDEX "TripPlan_origin_city_city_idx" ON "TripPlan"("origin_city", "city");
