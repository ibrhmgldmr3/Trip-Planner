-- TripPlan.tripId yabancı anahtarı: ON DELETE CASCADE -> ON DELETE SET NULL
--
-- DÜZELTİLEN VERİ KAYBI
--
-- `TripPlan` bu uygulamada asıl kayıttır: AI'ın ürettiği ya da kullanıcının
-- elle girdiği planın tamamı (gün planı, bütçe, markdown, HTML) orada durur.
-- `Trip` ise TÜRETİLMİŞ bir kayıttır — bir plan "Gerçekleşti" (DONE)
-- işaretlendiğinde `src/lib/plan-status-service.ts` onu üretiyor, ayrıca
-- `src/lib/plan-migration-runner.ts` planları ilişkisel modele taşırken
-- açıyor.
--
-- Bağ CASCADE olduğu sürece türetilmiş kaydı silmek ASIL KAYDI da siliyordu:
--
--   DELETE /api/trip?id=...   → Trip siliniyor
--                             → CASCADE ile TripPlan da siliniyor
--                             → kullanıcının planı geri dönüşsüz kayboluyor
--
-- Kullanıcı açısından bu "gezi kaydımı sildim" demek; "planımı da sil"
-- demek değil. Üstelik taşıma çalıştırıcısı kendini açıkça "yıkıcı değil"
-- diye tanımlıyor — CASCADE o güvenceyi sessizce geçersiz kılıyordu.
--
-- SET NULL doğru davranış: gezi kaydı gidince plan yalnızca BAĞSIZ kalır.
-- Sütun zaten nullable (`tripId String?`) ve kodun tamamı `tripId == null`
-- durumunu zaten karşılıyor (plan-status-service yalnızca `!mevcut.tripId`
-- olduğunda yeni Trip açıyor), yani null bir tripId beklenmedik bir durum
-- değil — planın henüz bir geziye bağlanmamış hâli.
--
-- Ters yön DEĞİŞMİYOR: `Trip.userId` hâlâ CASCADE. Kullanıcı silindiğinde
-- gezilerinin de gitmesi doğru.

ALTER TABLE "TripPlan" DROP CONSTRAINT "TripPlan_tripId_fkey";

ALTER TABLE "TripPlan"
  ADD CONSTRAINT "TripPlan_tripId_fkey"
  FOREIGN KEY ("tripId") REFERENCES "Trip"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
