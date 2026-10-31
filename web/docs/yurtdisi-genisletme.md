# Yurt dışı rotaları — genişletme planı

**Durum:** taslak · yazım tarihi 2 Eylül 2026
**Kapsam:** `src/lib/seyahat-mesafe.ts` bugün yalnızca Türkiye'nin 81 ilini
tanıyor. Bu belge, aynı hesabın yurt dışı rotalarına nasıl açılacağını
anlatır.

---

## Bugün ne var, sınırı nerede

| Parça | Bugünkü hâli | Yurt dışında ne olur |
|---|---|---|
| Şehir listesi | 81 il, koordinat gömülü | Liste yok; kullanıcı Roma seçemiyor |
| Mesafe | Haversine × **1.27** karayolu katsayısı | Katsayı Türkiye coğrafyasına ait; deniz/dağ aşan rotada anlamsız |
| Uçak eşiği | 350 km | Kıtalar arası için doğru ama kısa uluslararası uçuşları (İstanbul–Selanik ~500 km) yanlış konumlandırmaz |
| Tren ağı | 45 il, elle yazılmış küme | Avrupa demiryolu ağı elle yazılamaz |
| Otobüs/araba | Her rotada sunuluyor | **Denizaşırı rotada karayolu YOK** — İstanbul→Londra'ya "otobüs 40 saat" demek yanlış |
| Para birimi | ₺ sabit | Yabancı rotada yerel para + kur gerekiyor |
| Sınır/vize | Yok | Pasaport, vize, sınır bekleme süresi hesaba girmiyor |

**En kritik kırılma:** bugünkü kod iki nokta arasında **her zaman** karayolu
varsayıyor. Kıbrıs, İngiltere ya da Amerika seçildiğinde otobüs ve kendi
aracı seçenekleri üretilir ve bunlar gerçek değildir. Yurt dışı açılmadan
önce çözülmesi gereken ilk şey budur.

---

## Aşama 1 — Kara bağlantısı olan komşular (en küçük anlamlı adım)

**Hedef:** Yunanistan, Bulgaristan, Gürcistan, İran, Irak, Suriye, Ermenistan,
Azerbaycan (Nahçıvan) — karayolu gerçekten var, model bozulmuyor.

Gerekenler:

1. **`Sehir` tipine `ulke` ve `ulkeKodu` alanı.** Bugün tip yalnızca
   `{ ad, enlem, boylam }`. ISO 3166-1 alpha-2 kodu eklenmeli.
2. **Şehir listesini koddan veriye taşı.** 81 satır kod içinde durabilir;
   birkaç yüz şehir duramaz. Öneri: `prisma` tablosu (`City`) + tohumlama
   (seed) script'i. Böylece arama, otomatik tamamlama ve sayfalama mümkün
   olur.
3. **Sınır geçiş süresi.** Kara sınırı geçen rotaya sabit bir ek süre
   (öneri: 1.5 sa; Kapıkule gibi yoğun kapılarda daha fazla). Bu bir
   *tahmin*, ve öyle etiketlenmeli.
4. **Karayolu katsayısı ülkeye göre.** 1.27 Türkiye için. Yunanistan'ın
   ada coğrafyası ve Gürcistan'ın dağları farklı davranır. En azından
   "komşu ülke" için ayrı bir katsayı tablosu.

Bu aşama sonunda İstanbul→Selanik, Trabzon→Batum gibi rotalar doğru çalışır.

---

## Aşama 2 — Denizaşırı ve uzak rotalar

**Hedef:** Avrupa'nın geri kalanı, Orta Doğu, Kuzey Afrika.

Burada model değişmek zorunda: **ulaşım modunun var olup olmadığı bir
coğrafya sorusu.**

1. **Kara bağlantısı grafiği.** Ülkeler arasında "kara sınırı var mı"
   ilişkisi. İki şehir aynı kara kütlesinde değilse otobüs ve kendi aracı
   **hiç sunulmaz**. Bu, veri olarak küçük (ülke komşuluk listesi) ama
   davranış olarak kritik.
2. **Feribot modu.** Kara bağlantısı olmayan ama kısa deniz geçişi olan
   rotalar (İzmir→Sakız, Bodrum→Kos). Kendi hızı, kendi sabit süresi.
3. **Uçak aktarma cezası.** Bugün uçak süresi `mesafe/700 + 2.5 sa`.
   Doğrudan uçuşu olmayan şehir çiftinde bu ciddi biçimde yanlış. En az:
   "büyük havalimanı" işareti taşımayan şehir çiftine +2 sa aktarma.
4. **Para birimi ve kur.** `tahminiTl` alanı `tahminiTutar + paraBirimi`
   olmalı. Kur için günlük bir kaynak (TCMB) ve önbellek.

---

## Aşama 3 — Gerçek veriye geçiş

Tahmin motoru bir taban; asıl değer gerçek veride.

| Kaynak | Ne verir | Not |
|---|---|---|
| Zaten kurulu **Tavily** araması | Satış sitesi bağlantıları | Bugün çalışıyor (`src/lib/ulasim-arama.ts`) — yurt dışında da çalışır, sorgu diline dikkat |
| Amadeus / Skyscanner API | Gerçek uçuş tarifesi ve fiyat | Ücretli, kotalı; kayıt gerekir |
| Google Routes API | Gerçek karayolu mesafesi ve süresi | Maps anahtarı **zaten var** (`GOOGLE_MAPS_SERVER_API_KEY`) — en düşük sürtünmeli iyileştirme |
| Rome2Rio | Çok modlu rota | Kapsamı geniş, fiyatlandırması pahalı |

**Öneri sırası:** Google Routes API ile karayolu mesafesini gerçek değerle
değiştirmek en iyi maliyet/fayda oranını veriyor — anahtar mevcut, hesap
zaten `src/lib/geocoding.ts`'te aynı sağlayıcıyla konuşuyor ve haversine
tahmini tamamen ortadan kalkıyor.

---

## Dokunulması gereken dosyalar

| Dosya | Değişiklik |
|---|---|
| `src/lib/seyahat-mesafe.ts` | `Sehir`e ülke alanı; kara bağlantısı kontrolü; mod uygunluğu |
| `src/lib/ulasim-arama.ts` | Sorgu dili (yabancı rotada Türkçe sorgu zayıf sonuç veriyor) |
| `prisma/schema.prisma` | `City` tablosu; `TripPlan.originCity` zaten var |
| `src/app/manual-planner/page.tsx` | Şehir seçici → aranabilir birleşik kutu (81 değil binlerce şehir) |
| `src/lib/api-schemas.ts` | Para birimi alanı |
| `tests/seyahat-mesafe.test.ts` | Sınır ötesi ve denizaşırı senaryolar |

---

## Kabul ölçütleri

Yurt dışı açıldı denmesi için:

1. İstanbul→Londra rotasında **otobüs ve kendi aracı sunulmuyor**.
2. İstanbul→Selanik rotasında otobüs sunuluyor ve süreye sınır geçişi
   dâhil.
3. Fiyatlar rotanın para biriminde ve dönüşüm kaynağı belirtilmiş.
4. Tanınmayan şehirde arayüz sessizce yanlış hesap yapmıyor, açıkça
   "bu şehir için hesap yapılamıyor" diyor.
5. Mesafe testleri en az beş uluslararası rota için gerçek değerlerle
   karşılaştırılıyor (bugünkü Türkiye testlerinin yaptığı gibi).

---

## Açık sorular — karar sizin

- **Kapsam:** yalnızca Avrupa mı, yoksa dünya geneli mi? Bu, şehir
  veri setinin boyutunu (yüzler vs. on binler) ve dolayısıyla seçici
  bileşenini belirliyor.
- **Ücretli API bütçesi var mı?** Yoksa tahmin motoru + Tavily bağlantıları
  modeli sürdürülür; varsa Google Routes ilk adım olmalı.
- **Vize/pasaport uyarısı ürünün işi mi?** Yurt dışı rotada bunu hiç
  söylememek de bir tercih, ama kullanıcı beklemiş olabilir.
