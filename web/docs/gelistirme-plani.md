# Trip Planner — Geliştirme ve Genişletme Planı

**Yazım tarihi:** 2 Eylül 2026
**Temel alınan durum:** `chore/rehabilitation` dalı, denetim sonrası
**Son güncelleme:** 5 Eylül 2026 — B1, B3, B4, B5, **B6**, B7, B8, **B9**, B10
tamamlandı; B2 kod tarafı bitti (model seçimi ops kararı)
**Doğrulama:** `npm run typecheck` ✅ · `npm run lint` ✅ · `npm test` ✅ 645 test ·
`npm run build` ✅ 50 rota · `npm run test:canli` ✅ 14 test (gerçek sağlayıcı + gerçek Postgres) ·
canlı Postgres + tarayıcı ✅ (taşıma akışı, bütçe çift yolu, A1 veri kaybı,
şifre sıfırlama, e-posta doğrulama, hesap silme) ·
`prisma migrate diff` ✅ **boş** (sapma yok)

Bu belge iki bölümden oluşuyor:

- **Bölüm A — Bu turda düzeltilenler.** Kapatılan hatalar, tekrar açılmasınlar
  diye hangi testlerin bekçilik ettiği.
- **Bölüm B — Uygulamaya hazır plan.** Her madde: *bugün ne var*, *sorun ne*,
  *ne yapılacak*, *nasıl doğrulanacak*. Sıraya konmuş ve birbirine bağımlılıkları
  yazılmış durumda; bir sonraki oturumda baştan analiz gerektirmeden alınabilir.

Yurt dışı rotalarının açılması ayrı bir belgede: [`yurtdisi-genisletme.md`](./yurtdisi-genisletme.md).

---

## Bölüm A — Bu turda düzeltilenler

| # | Sorun | Etki | Bekçi test |
|---|---|---|---|
| A1 | `Trip` silinince `TripPlan` de siliniyordu (FK `onDelete: Cascade`) | **Veri kaybı.** `DELETE /api/trip?id=…` türetilmiş gezi kaydını silerken kullanıcının asıl planını yok ediyordu | migration `20260902130000_tripplan_trip_set_null` |
| A2 | Plan üretiminde kota, üretim yapmayan yollarda da tükeniyordu | Saatlik 5 hak; devam eden işe bağlanan istek ve 400 dönen istek de hak yakıyordu | `plan-job.test.ts` — 4 yeni test |
| A3 | "Devam eden iş" penceresi (6 dk) ile "asılı kalmış" eşiği (10 dk) uyuşmuyordu | Aradaki 4 dakikada ikinci bir LLM zinciri başlatılabiliyordu | `plan-job.test.ts` — "8 dakikadır süren iş…" |
| A4 | TripPlan uçları başkasının kaydında **403** dönüyordu | Bilgi sızıntısı: id'yi bilen birine kaydın var olduğu doğrulanıyordu. İlişkisel model uçları zaten 404 dönüyordu | `authorization.test.ts`, `plan-coordinates.test.ts` |
| A5 | Sahte Prisma `select`i tamamen yok sayıyordu | "Yanıtta `userId` olmamalı" gibi testler yanlış sebeple yeşil/kırmızıydı | `fake-prisma.ts` → `projeksiyon()` |
| A6 | `transport-options` aynı şehri ham metinle karşılaştırıyordu | `"Istanbul".toLocaleLowerCase("tr")` → `"ıstanbul"`; "Istanbul→İstanbul" 400 yerine boş listeyle 200 dönüyordu | `transport-options.test.ts` (yeni dosya, 7 test) |
| A7 | Manuel planda gün tarihi dizi sırasından türetiliyordu | Gün atlanarak gönderildiğinde gün numarası ile tarih çelişiyordu | — (Bölüm B, B7'de kapsanacak) |
| A8 | Manuel planda rezerv katsayısı `1.2` elle yazılıydı | `REZERV_ORANI` değişse manuel planlar eski katsayıda kalırdı | `plan-budget.test.ts` (mevcut) |
| A9 | `plan-detail` bütçe toplamı yoksa `extraItemsTotal`a düşüyordu | Toplam alanı boş satırda "Toplam" olarak yanlış sayı görünürdü | `butce-dokumu.test.tsx` + `plan-budget.test.ts` |
| A10 | `sehirBul` düzeltme imli `î`/`û` harflerini eşlemiyordu | — | `seyahat-mesafe.test.ts` (mevcut) |
| A11 | `TripPlan.originCity` şema yorumu, hiç çalışmayan bir davranışı anlatıyordu | Yanıltıcı belge | — (Bölüm B, B6) |
| A12 | `chatCompletion` her istekte `frequency_penalty: 0` ve `presence_penalty: 0` gönderiyordu | **Plan üretiminin birinci stratejisi her seferinde ölüydü.** `require_parameters: true` ile birleşince OpenRouter "bu parametreleri karşılayan sağlayıcı yok" deyip 404 dönüyordu; zincir sessizce `json_object`e düşüyor, şema garantisi kayboluyor ve her üretimde bir tur boşa gidiyordu | `openrouter-model-sagligi.test.ts` + `openrouter.canli.test.ts` |
| A13 | Canlı testler `.env.local`i hiç okumuyordu | `process.env.TAVILY_API_KEY` daima tanımsızdı; `describe.skipIf` yüzünden **canlı süit hiç koşmadan yeşil görünüyordu** | `vitest.canli.config.ts` → `loadEnv` |
| A14 | `daily-planner` `gun_plani`yi kendi `JSON.parse`ıyla okuyordu | Üç davranış farkı: gün numarasını yeniden numaralandırıyor, aktiviteleri hiç doğrulamıyor, `isEmpty` için modelin iddiasına güveniyordu — aynı plan bu ekranda haritadan farklı görünebiliyordu | `plan-budget.test.ts` (`gunleriCoz`, mevcut) |
| A15 | **Veritabanı şemadan sapmıştı: `TripStatus` enum'unda `DONE` yoktu** | **İki özellik kırıktı.** "Planı gerçekleşti işaretle" ve "Seyahat geçmişi" ekranı Postgres 22P02 ile patlıyordu | migration `20260902140000` + canlı doğrulama |
| A16 | **`BudgetItem.category` veritabanında enum, şemada `String`** | **İlişkisel bütçe yolunun tamamı ölüydü.** Taşıma `invalid input value for enum "BudgetCategory": "ulaşım"` ile düşüyordu | migration `20260902140000` + canlı doğrulama |
| A17 | Kalan şema sapması: 8 sütun, 2 tablo, 6 kullanılmayan enum tipi | `prisma migrate dev` her çalıştırmada aynı farkı üretiyordu; ilişkisel modelin şekli belirsizdi | migration `20260903100000` · `migrate diff` artık boş |
| A20 | Harita rota ölçüleri `undefined` gelebildiği hâlde koşulsuz bölünüyordu | `route.distanceMeters / 1000` ve `durationMillis / 60000` — sağlayıcı alanı döndürmediğinde ekranda **"NaN km · NaN dk"** yazıyordu. `(window as any)` kullanıldığı sürece derleme zamanında görünmüyordu | `map/page.tsx` → `rotaOlculeri()` + dosyaya özel `no-explicit-any` kuralı |
| A19 | **`/api/trip/daily-plans` tarihi bir gün geriye kaydırıyordu** | `@db.Date` sütununa YEREL gece yarısı yazılıyordu; GMT+3'te `gunBasi(4 Kasım)` → `2026-11-03T21:00Z` → saklanan tarih **3 Kasım**. Kayan gün bir önceki günün tarihine çarpıp `@@unique([tripId, date])` ihlal ediyor, uç **500** dönüyordu — üç günlük bir planda ikinci günü düzenlemek kaydetmeyi tamamen kırıyordu | `trip-dates.test.ts` → `utcGunBasi` (4 test) |
| A18 | Prisma araç zinciri plan dışı **8.0.0-rc.12 / client 7.10.0**'a yükseltilmişti | Üretilmiş client bozuldu (`Cannot find module runtime/library.js`) — **uygulama hiç çalışmıyordu**; CLI major'ı (8) client major'ıyla (7) uyuşmuyordu ve rc bir üretim bağımlılığıydı | `package.json` 6.14 çiftine geri alındı; 472 test + build yeşil |

### A12 hakkında — canlı testin bulduğu hata

Bu, B2'nin neden var olduğunun kanıtı. Mock'lu 433 test yeşilken gerçek
anahtarla yapılan ilk çağrı 404 döndü. Zincir şöyle çalışıyordu:

```
strateji 1  json_schema + require_parameters  → 404, atlandı   (her seferinde)
strateji 2  json_object                       → çalışıyor
```

Plan üretildiği için hata hiç fark edilmemişti. İzole eden ölçüm:

| İstek | Sonuç |
|---|---|
| `json_schema` + `require_parameters` + penalty'ler | **404** No endpoints found |
| `json_schema` + `require_parameters`, penalty'siz | **200** |

Kural olarak yazıldı: `require_parameters` ile birlikte yalnızca gerçekten
ihtiyaç duyulan parametreler gönderilir — varsayılan değerli bir parametre
eklemek burada bedava değil, sağlayıcı havuzunu daraltıyor.

### A15/A16 hakkında — şema sapması

Bu ikisi de yalnızca GERÇEK VERİTABANINA yazan bir çağrıyla ortaya çıktı;
mock'lu 472 test göremezdi, çünkü sahte Prisma istemcisi enum kısıtı
uygulamıyor.

**Nasıl oluştu — migration zaman çizelgesi:**

```
20250821141901  TripStatus yaratıldı: PLANNED, ACTIVE, COMPLETED, CANCELLED
20250829134513  DONE EKLENDİ                    ← bilinçli ürün kararı
20250904121801  DONE GERİ ALINDI                ← gerileme
                + BudgetItem.category enum'a çevrildi
```

Son migration kendi başlığında uyarıyor: *"The values [DONE] on the enum
TripStatus will be removed."* Şema ise hâlâ 5 değer ilan ediyor ve
`src/lib/trip-status.ts` DONE'ı birinci sınıf durum olarak kullanıyor —
geçiş tablosu, etiketler, `canMarkAsDone`. Yani şema elle düzeltilmiş ama
karşılığı migration hiç yazılmamış.

**Neden şema kazandı:** alternatif, kodu enum'lara uydurmaktı — DONE
durumunu tamamen kaldırmak ve kategori adlarını her katmanda değiştirmek
demekti. Oysa kategoriler serbest Türkçe metin ("ulaşım", "konaklama",
"yemek", "aktiviteler") ve hem AI hem manuel planlayıcı hem bütçe sayfası
onları üretiyor.

`20260902140000_restore_done_and_text_category` **yalnızca ekleyici**:
`ALTER TYPE ... ADD VALUE IF NOT EXISTS 'DONE'` ve enum → `TEXT` dönüşümü.
Hiçbir sütun düşmüyor, hiçbir satır silinmiyor.

**KALAN SAPMA DA KAPATILDI** (4 Eylül 2026) —
`20260903100000_sema_sapmasini_kapat`. Sekiz sütun, iki tablo ve altı
kullanılmayan enum tipi şemayla hizalandı.

Prisma'nın ürettiği diff OLDUĞU GİBİ KULLANILMADI: `migrate diff`
enum→metin dönüşümleri için `DROP COLUMN` + `ADD COLUMN` üretiyor ve bu,
sütundaki veriyi sessizce siler. Bu veritabanında ilgili tabloların hepsi
boştu, ama migration depoda duruyor ve başka ortamlarda dolu olabilir —
her dönüşüm `ALTER COLUMN ... TYPE TEXT USING lower(...::text)` ile
yazıldı, satırlar korunuyor.

Tek kayıplı adım `TripPlan.travelers`: 32 satır, hepsinin değeri `1`
(varsayılan), şemada karşılığı yok, hiçbir kod okumuyor. Düşen her şeyin
yedeği alındıktan sonra uygulandı.

**Doğrulandı:** `prisma migrate status` → *"Database schema is up to date!"*,
`prisma migrate diff` → *"-- This is an empty migration."* Ayrıca canlı
yazma denemesiyle: `Trip.status = DONE` ✓ ve
`BudgetItem.category = "ulaşım"` ✓ — A15/A16'nın kapandığının kanıtı.

### A1 hakkında — dağıtımdan önce okuyun

Migration mevcut veriyi **değiştirmiyor**, yalnızca kısıtı yeniden tanımlıyor:

```bash
npx prisma migrate deploy
```

`TripPlan.tripId` zaten nullable ve kod `null` durumunu her yerde karşılıyor
(`plan-status-service` yalnızca `!mevcut.tripId` iken yeni `Trip` açıyor), bu
yüzden davranış değişikliğinin başka bir yerde karşılığı yok.

---

## Bölüm B — Uygulamaya hazır plan

### Öncelik sırası özeti

| Sıra | Madde | Neden bu sırada | Tahmini |
|---|---|---|---|
| ~~1~~ | ~~**B1** Ölü uçları sil~~ | **TAMAMLANDI** | — |
| 🟡 2 | **B2** Üretim modeli sabitle | Kod tarafı bitti. Together'da $5 kredi var ve birincil yol çalışıyor (~600-850 plan). **Kredi gerekiyorsa OpenRouter'a** — yedek zincir hâlâ ücretsiz modellere dayanıyor | ops kararı |
| ~~3~~ | ~~**B3** Bütçe okumasını `plan-budget`e indir~~ | **TAMAMLANDI** | — |
| 4 | **B4** İlişkisel modeli arayüze bağla | 🟡 4/5 adım bitti ve CANLI DOĞRULANDI | 1 gün |
| ~~5~~ | ~~**B5** CSP'yi zorlama moduna al~~ | **TAMAMLANDI** | — |
| 6 | **B6** Kalkış şehrini uçtan uca | Sütun var, veri yarım | 1 gün |
| ~~7~~ | ~~**B7** Demo sayfaları gerçek veriye bağla~~ | **TAMAMLANDI** (B4 Adım 4 ile birlikte) | — |
| ~~8~~ | ~~**B8** Harita sayfasını tiplendir~~ | **TAMAMLANDI** | — |
| 9 | **B9** Hesap yaşam döngüsü | Şifre sıfırlama / e-posta doğrulama yok | 2-3 gün |
| ~~10~~ | ~~**B10** Gözlemlenebilirlik ve dağıtım~~ | **TAMAMLANDI** | — |

---

### B1 — Ölü uçları sil · ✅ TAMAMLANDI (2 Eylül 2026)

**Silinen dosyalar**

Üç dosya hiçbir istemciden çağrılmıyordu ve hiçbir testi yoktu:

| Dosya | Durum |
|---|---|
| `src/app/api/trip/apply-ai-data/route.ts` | Çağıran yok |
| `src/lib/trip-services.ts` | Yalnızca yukarıdaki uçtan import ediliyor |
| `src/app/api/my-trips/[id]/route.ts` | Çağıran yok |

**Neden silindi**

1. `apply-ai-data` gövdesindeki `extractedData` **hiç doğrulanmıyordu** —
   `requireUser` ve seyahat sahipliği kontrol ediliyor ama içerik doğrudan
   `prisma.*.create`'e gidiyor. Tarihler JSON'dan string olarak geliyor
   (`Date` bekleniyor), `coordinates` serbest JSON. Uygulamanın geri
   kalanında her yazma ucu Zod'dan geçiyor; burası tek istisna.
2. `trip-services.ts` içindeki `dailyPlan.create`, şemaya sonradan eklenen
   `@@unique([tripId, date])` kısıtını ihlal ediyor — uç çağrılsaydı ikinci
   çalıştırmada P2002 ile patlardı.
3. `my-trips/[id]` **listeyle aynı tabloyu okumuyor**: liste ucu
   (`/api/my-trips`) `TripPlan` döndürüyor, detay ucu `Trip` sorguluyor.
   Listeden alınan bir id ile detay ucu her zaman 404 döner. `DELETE`'i ise
   A1'de kapatılan veri kaybı yolunun ta kendisiydi.

**Kalan iş**

Tamamlanmış geziye ait bir detay/silme ucu **gerekiyorsa**, doğrusu B4
kapsamında `Trip` üzerinden yeniden yazmak — hem liste hem detay aynı tabloyu
okuyacak şekilde. Bugün böyle bir ekran yok.

**Doğrulandı:** typecheck ✅ · lint ✅ · test ✅ · build ✅ (rota sayısı 35 → 33).

> Silmenin hemen ardından `npm run typecheck` `.next/types` altında 6 hata
> gösteriyor: Next'in silinen rotalar için ÜRETTİĞİ doğrulayıcılar öksüz
> kalıyor. Bir `npm run build` bunları yeniden üretip temizliyor. Rota
> silindikten sonra doğrulama sırası `build` → `typecheck` olmalı.

---

### B2 — Üretim modelini sabitle ve izle · ✅ TAMAMLANDI (2 Eylül 2026)

**Yapılanlar**

1. **Ücretsiz model uyarısı.** `ucretsizModelUyarisi()` — `NODE_ENV=production`
   altında yapılandırılmış modellerden biri `:free` ile bitiyorsa modül başına
   BİR KEZ `logger.warn` basıyor. `chatCompletion` her çağrıda tetikliyor,
   sonrası no-op. Yerel geliştirmede susuyor: ücretsiz model orada makul.
2. **`/api/health` gerçek yoklama yapıyor.** Eskiden yalnızca anahtarın
   *tanımlı olduğuna* bakıyordu — yani `?deep=1` ile sığ kontrol arasında
   fark yoktu ve asıl hata modunu hiç görmüyordu. Artık `?deep=1`
   `/api/v1/models` kataloğunu okuyup yapılandırılmış modelleri arıyor:

   | Durum | Anlamı |
   |---|---|
   | `error` | Anahtar yok **ya da** model katalogda yok → plan üretimi kırık |
   | `uyari` | Katalog okunamadı (geçici) **ya da** üretimde `:free` model |
   | `ok` | Modeller yerinde |

   Yanıta `checks.openrouter.eksikModeller` ve
   `checks.rateLimit.dagitik` alanları eklendi. Genel `status` hâlâ yalnızca
   veritabanına bakıyor (mevcut tasarım kararı korundu) — izleme sistemi bu
   iki alana ayrı alarm kurmalı. İki yoklama `Promise.all` ile paralel.
3. **Canlı test.** `tests/openrouter.canli.test.ts` — modellerin katalogda
   durduğunu, birincil modelin strict `json_schema` ile gerçekten geçerli
   JSON ürettiğini ve üretim yapılandırmasında `:free` model olmadığını
   doğruluyor. Anahtar yoksa kendini atlıyor.
4. **Canlı testler artık gerçekten koşuyor** (A13). `vitest.canli.config.ts`
   `loadEnv` ile `.env.local`i `process.env`e taşıyor; kabuktan gelen değer
   dosyayı eziyor (CI'da sır yöneticisi öncelikli).
5. **A12 hatası bulundu ve kapatıldı** — bkz. Bölüm A.

**Doğrulama**

```bash
npm run test:canli   # 4 canlı test, 2 sağlayıcı (OpenRouter + Tavily)
```

Şu an dördü de yeşil: modeller katalogda, strict `json_schema` gerçek bir
sağlayıcıdan geçerli JSON döndürüyor.

**KALAN İŞ — bu ops/satın alma kararı, kod değil**

**ENGEL: OpenRouter hesabı ÜCRETSİZ KATMANDA.** 4 Eylül 2026'da ölçüldü:
`GET /api/v1/key` → `is_free_tier: true`, toplam kullanım $0.0034. Ücretli
bir modele geçmek önce hesaba kredi yüklemeyi gerektiriyor —
`google/gemini-2.5-flash` denemesi doğrudan bunu söyledi:

```
HTTP 402 — "This request requires more credits... You requested up to
16000 tokens, but can only afford 11233."
```

**Adaylar gerçek plan şemasıyla ölçüldü** (strict `json_schema` +
`require_parameters`, 3 günlük Roma planı):

| Model | Sonuç | Süre | ~Plan başına |
|---|---|---|---|
| `openai/gpt-4o-mini` | ✅ geçerli, 3 gün | 21 sn | $0.0017 |
| `meta-llama/llama-4-scout` | ✅ geçerli, 3 gün | 42 sn | $0.0009 |
| `qwen/qwen3-30b-a3b-instruct-2507` | ✅ geçerli, 3 gün | 54 sn | $0.0005 |
| `mistralai/mistral-small-3.2-24b-instruct` | ✅ geçerli, 3 gün | 105 sn | $0.0006 |
| `deepseek/deepseek-v4-flash` | ❌ 140 sn'de zaman aşımı | — | — |
| `google/gemini-2.5-flash-lite` | ❌ HTTP 400 (sağlayıcı hatası) | — | — |
| `openai/gpt-5-nano` | ❌ HTTP 404 "No endpoints found…" | — | — |
| `google/gemini-2.5-flash` | ❌ HTTP 402 (kredi yetersiz) | — | — |

**Sekiz adayın dördü çalışmıyor** — hepsi katalogda `structured_outputs`
destekliyor görünmesine rağmen. A12'nin aynı dersi: katalog "destekliyor"
demesi, isteğin gerçekten geçeceği anlamına gelmiyor.

**Öneri:** `openai/gpt-4o-mini` birincil (en hızlı — 21 sn, ve zincirin
240 sn'lik toplam bütçesi içinde en rahat sığan), `meta-llama/llama-4-scout`
yedek. 1000 plan ≈ $1.68 + $0.87. `mistral-small-3.2` ucuz ama 105 sn
tehlikeli: zincirde birden çok strateji denenirse süre bütçesi doluyor.

Karar sizin; kredi yüklendikten sonra tek satırlık bir değişiklik:

```bash
OPENROUTER_MODEL="openai/gpt-4o-mini"
OPENROUTER_MODEL_FALLBACK="meta-llama/llama-4-scout"
```

Bugün ikisi de tanımsız, yani `src/lib/openrouter.ts` içindeki `:free`
varsayılanlar kullanılıyor. Bunlar **bugün çalışıyor** (canlı test doğruladı)
ama ücretsiz katman garanti edilmiyor — bu hata üç kez yaşandı. Model
seçerken `.env.example`deki iki kriter geçerli: `structured_outputs` desteği
ve akıl yürütme modellerinde `max_tokens` bütçesi.

**İKİ SAĞLAYICI VAR, SORU HANGİSİNE KREDİ YÜKLENECEĞİ** (5 Eylül 2026'da
gerçek üretimlerle ölçüldü)

Plan üretimi tek bir sağlayıcıya bağlı değil: önce **Together** (agentic,
araç çağıran yol) deneniyor, başarısız olursa **OpenRouter** zinciri
devreye giriyor. Yani ikisi birincil–yedek ilişkisinde.

| | Together | OpenRouter |
|---|---|---|
| Rol | Birincil (agentic, web aramalı) | Yedek zincir |
| Model | `deepseek-ai/DeepSeek-V4-Flash-0731` | `:free` varsayılanlar |
| Hesap durumu | **$5 kredi var**, anahtar tanımlı | **Ücretsiz katman, kredi yok** |
| Fiyat | $0,14/M girdi · $0,28/M çıktı | — |

**Ölçülen gerçek üretim** (İstanbul → Ankara, 3 gün, araçlar açık):

| Koşum | Yol | Süre | Token | Maliyet |
|---|---|---|---|---|
| 1 | Together başardı | **102 sn** | 29.200 girdi + 6.197 çıktı (5 çağrı) | **$0,0058** |
| 2 | Together **4. turda 90 sn zaman aşımı** → OpenRouter `:free` kurtardı | 268 sn | — | $0 (ücretsiz model) |

**Plan başına ≈ $0,006 → $5 kredi ≈ 600–850 plan.** (Aralığın alt ucu,
zaman aşımına uğrayan koşumların da girdi tokenlarını ödemesinden geliyor.)

**ÜÇ SONUÇ:**

1. **Together'a ek kredi GEREKMİYOR.** Mevcut $5 yüzlerce plan demek ve
   birincil yol zaten o.
2. **Yedek zincir bugün ÜCRETSİZ MODELLERE dayanıyor ve GERÇEKTEN
   ÇALIŞIYOR** — iki koşumdan biri oraya düştü. Yani fallback teorik değil,
   üretimde sık sık devreye giren bir yol. Bu yolun ücretsiz katmana bağlı
   olması, "bir gün sessizce durur" riskinin yarı yarıya bir olasılıkla
   kullanıcıya çarpması demek.
3. **Kredi yüklenecekse OpenRouter'a yüklenmeli.** $5, ölçülen
   `gpt-4o-mini` fiyatıyla (~$0,0017/plan) yaklaşık 2.900 yedek üretim eder.

**AYRICA BULUNDU — Together'ın 90 sn'lik çağrı zaman aşımı dar.**
DeepSeek-V4-Flash agentic döngünün 4. turunda (araç sonuçları biriktikçe
istem büyüyor) sınıra dayandı. Zincir doğru davrandı ve yedeğe düştü, ama
bedeli 268 saniye — `TOPLAM_SURE_BUTCESI_MS` olan 240 sn'nin üstünde.
Ayarlanabilir üç şey var: çağrı zaman aşımı, `AGENTIC_MAKS_TUR`, ve araç
sonucu kırpma sınırı. Ölçüm yapılmadan değiştirilmemeli; borç listesine
**E10** olarak yazıldı.

**İzleme önerisi:** `npm run test:canli` haftalık zamanlanmış bir işte koşsun.
Kırmızıya döndüğü gün model kalkmış demektir ve kullanıcı şikâyetinden önce
öğrenilir.

---


### B3 — Bütçe okumasını tek ayrıştırıcıya indir · ✅ TAMAMLANDI (2 Eylül 2026)

**Yapılanlar**

1. **`ButceDokumu` bileşeni** (`src/components/ButceDokumu.tsx`).
   `plan-detail/[id]/page.tsx` içindeki ~90 satırlık HTML-string üreticisi
   silindi; blok artık `butceyiCoz` çıktısını React olarak basıyor. Sayfadan
   AYRI DOSYADA olmasının sebebi testlenebilirlik: `page.tsx` yalnızca
   varsayılan dışa aktarımına izin veriyor, bileşen oradan import edilemiyordu.
2. **Kaynak rozeti.** Kalemin `source` alanı artık okunuyor ve
   `rel="noopener noreferrer"` ile bir bağlantı olarak gösteriliyor —
   agentic üretimde bir arama sonucuna dayanan tutar ile modelin kendi
   tahmini kullanıcı için ayırt edilebilir hâle geldi. Şema denetimi
   `guvenliKaynakUrl` üzerinden; `javascript:` hiç basılmıyor.
   `globals.css`e `.butce-kalem-kaynak` eklendi.
3. **`daily-planner` de aynı ayrıştırıcıya indirildi.** Orada da elle
   yazılmış bir `JSON.parse` vardı ve `gunleriCoz`'dan **üç noktada
   ayrılıyordu** — yani aynı plan bu ekranda haritadan ve plan detayından
   farklı görünebiliyordu:

   | Fark | Sonucu |
   |---|---|
   | `day: index + 1` | Kaydedilmiş gün numarasını yok sayıp diziyi yeniden numaralandırıyordu; gün atlayan bir kayıtta başlık ile tarih çelişiyordu |
   | `activities: plan.activities \|\| []` | Hiç doğrulama yok — `cost` metin gelirse toplamlar `NaN` |
   | `isEmpty: plan.isEmpty \|\| false` | Modelin İDDİASINA güveniyordu; `gunleriCoz` bunu aktivite sayısından türetiyor |

   Markdown yedeği korundu: `gunleriCoz` eski satırlarda `null` dönüyor.
4. **İki `1.2` kopyası daha kaldırıldı** (A8'in aynısı). `plan-detail`
   sayfasındaki "Önerilen bütçe" kutusu katsayıyı elle yazıyordu; aynı
   sayfadaki döküm kütüphaneden alıyordu — yani sayfa kendi içinde iki farklı
   değer gösterebiliyordu. Yüzde etiketi de artık `REZERV_ORANI`'ndan
   türetiliyor.

**Testler**

`tests/butce-dokumu.test.tsx` — 9 test, `renderToStaticMarkup` ile.
jsdom ya da Testing Library eklenmedi: bileşenin hiç etkileşimi yok, statik
markup iddia edilecek her şeyi taşıyor. Kapsanan: sınıf adları (CSS
`.plan-govde .butce-*` altında kapsanmış, sarmalayıcı düşerse stiller gider),
`extraItemsTotal` regresyonu, `REZERV_ORANI` türetmesi, kaynak bağlantısı,
tehlikeli şema, ve kalem açıklamasının HTML olarak YORUMLANMAMASI.

Bunun için iki yapılandırma değişikliği gerekti:
`vitest.config.ts` `include`ına `*.test.tsx` eklendi ve
`esbuild: { jsx: "automatic" }` verildi — `tsconfig.json` `"jsx": "preserve"`
diyor (doğrusu bu, JSX'i Next derliyor) ama vitest'in esbuild'i onu görünce
klasik runtime'a düşüp `React is not defined` ile patlıyordu.

**Doğrulama:** typecheck ✅ · lint ✅ · 456 test ✅ · build ✅

Yan fayda: iki sayfanın bundle'ı küçüldü —
`plan-detail` 7.75 → 6.59 kB, `daily-planner` 7.94 → 6.76 kB.

**GÖRSEL DOĞRULAMA YAPILAMADI.** Sayfayı tarayıcıda açmak için veritabanı
gerekiyor; `localhost:55432` erişilebilir değildi. Render çıktısı testlerle
doğrulandı ve sınıf adları birebir korundu, ama gerçek bir planla göz
denetimi yapılmadı. Postgres ayağa kalktığında `/plan-detail/<id>` → Bütçe
sekmesi bir kez açılıp bakılmalı.

---


### B4 — İlişkisel modeli arayüze bağla · ✅ TAMAMLANDI (5/5 adım)

**Bugün ne var**

Şemada `Trip`, `Activity`, `Accommodation`, `Transportation`, `DailyPlan`,
`BudgetItem`, `AiConversation`; yanlarında altı REST ucu, Zod şemaları,
`requireOwnedTrip` / `requireOwnedSubresource` sahiplik katmanı ve her uç için
yetki testi. Taşıma altyapısı da hazır: `plan-migration.ts` (saf dönüştürücü),
`plan-migration-runner.ts` (atomik yazıcı), `GET/POST /api/my-plans/migrate`.

**Sorun ne**

Bu yatırımın tamamı KULLANILMIYORDU. Arayüzün hepsi `TripPlan`ın JSON
sütunlarını okuyup yazıyor; taşıma ucunun da hiçbir ekranda tetikleyicisi
yoktu. İki paralel veri modeli var, biri kullanılıyor, diğeri bakım maliyeti
üretiyor. JSON sütunları filtrelenemiyor, gruplanamıyor, indekslenemiyor —
"bu ay 5000 TL üstü harcadığım geziler" bugün yazılamıyor.

---

#### ✅ Adım 1 — Taşımayı görünür kıl (TAMAMLANDI)

`src/components/PlanTasima.tsx`, profil sayfasına eklendi. İki aşamalı:

1. **"Neyin taşınacağını göster"** → `GET`, hiçbir şey yazmaz. Kaç plan
   taşınacak, kaçı neden atlanacak — atlananların GEREKÇESİ de gösteriliyor
   (`tarih-tersine` gibi ham kimlikler okunur metne çevriliyor; "3 plan
   atlanacak" demek kullanıcıya yapabileceği bir şey bırakmaz).
2. **"N planı taşı"** → `POST`. Bu düğme yalnızca rapor okunduktan ve
   taşınacak bir şey olduğu görüldükten sonra çıkıyor.

Tek tıkla taşımak da mümkündü; ne olacağını görmeden onaylatmak, çok sayıda
satır yazan bir işlemi körü körüne tetiklemek olurdu.

#### ✅ Adım 2 — Bütçe sayfasını çevir (TAMAMLANDI)

- `GET /api/my-plans` artık `migratedAt` ve `tripId` döndürüyor; sayfa hangi
  yolu kullanacağına buna bakıyor (dolaylı bir ipucuna değil, taşımanın kendi
  damgasına).
- **`src/lib/butce-esitleme.ts`** — uç KALEM BAZLI (POST/PUT/DELETE), sayfa
  ise TOPLU kaydediyor. Köprü bu saf fonksiyon: girdi iki liste, çıktı üç
  liste (eklenecek / güncellenecek / silinecek). Ayrı ve saf olmasının sebebi
  şu: yanlış hesaplanan bir fark kullanıcının kalemlerini SİLER, yani bu
  mantığın testlenebilir olması isteğe bağlı değil. 15 test.
- Değişmeyen kalem hiç istek üretmiyor. Yazma sırası **silme → güncelleme →
  ekleme**: bir hata durumunda kullanıcının VAR OLAN kalemleri bozulmamış
  kalsın.
- Yazma **atomik değil** (uçta toplu işlem yok). Bu yüzden hem başarıda hem
  hatada liste sunucudan yeniden okunuyor — yeni kalemlerin gerçek
  kimliklerini almak ve kısmi bir yazmayı ekrana yansıtmak için.

**GEÇİŞ DÖNEMİ ÇİFT YAZMA.** İlişkisel yolda `TripPlan.total_cost` da
güncelleniyor. Sebebi: o sütun hâlâ üç yerde okunuyor (planlar listesi,
profil istatistikleri, plan detayı). Yalnızca ilişkisel tabloya yazsaydık
taşınmış planların toplamı o üç ekranda kaydedilen anda bayatlardı. Çift
yazma, o üç ekran da ilişkiselleştiğinde kaldırılacak.

---

#### ✅ Adım 3 — Günlük planlayıcıyı çevir (TAMAMLANDI · 4 Eylül 2026)

**`src/lib/gunluk-plan-esitleme.ts`** — iki ayrı sorunu çözüyor:

1. **Alan adları farklı.** JSON tarafında `{name, startTime}`, ilişkisel
   tarafta `{title, time}`. Çeviri iki yönde de kayıpsız (test edildi).
2. **Yazma birimi farklı.** Ekran toplu kaydediyor, uç gün bazlı çalışıyor.

**Eşleştirme anahtarı TARİH, kimlik değil.** Şemada `@@unique([tripId, date])`
var, yani tarih doğal anahtar. Kimlikle eşleştirmek ekranın ürettiği geçici
id'lerle sunucu cuid'lerini karşılaştırmak olurdu ve her kaydetme "hepsini
sil, hepsini yeniden yarat"a dönerdi.

Yazma sırası **silme → güncelleme → ekleme**. Silmenin önce olması burada
bütçedekinden daha kritik: bir gün kaldırılıp aynı tarihe yenisi konduğunda,
ekleme önce yapılsaydı POST 409 ile düşerdi.

Tarihsiz günler eşitlenmiyor ama **sessizce atlanmıyor** — kullanıcıya
uyarı gösteriliyor; aksi halde "kaydedildi" deyip veri kaybedilirdi.

21 birim testi (`gunluk-plan-esitleme.test.ts`).

**Bu adımda bulunan hata: A19.** İlk canlı denemede `PUT` 500 döndü.
Kök sebep bizim yeni kodumuz değil, ucun kendi tarih yazımıydı — bkz.
Bölüm A.

#### ✅ Adım 4 — Konaklama ve ulaşım (TAMAMLANDI · 4 Eylül 2026)

B7 ile birleşti: iki sayfa da demo veriden çıktı VE ilişkisel modele
yazıyor.

**`/transportation` — gerçek kaynak + kaydetme**

~350 satırlık sabit `SEFERLER` dizisi (dört şehir, uydurma sefer tablosu,
sahte koltuk sayıları) silindi. Sayfa artık `GET /api/transport-options`
çağırıyor: 81 ilin koordinatından hesaplanan mesafe/süre/maliyet +
Tavily'den gelen gerçek satış siteleri.

**Sefer saati ve koltuk sayısı KALDIRILDI.** Gerçek kalkış saatini ve boş
koltuğu ancak bir rezervasyon sağlayıcısı bilir; uydurma bir saat
göstermek, kaldırdığımız demo verinin aynısı olurdu. Kullanıcı kalkış
saatini kendisi giriyor, varış tahmini süreden hesaplanıyor.

Seçilen seçenek `POST /api/trip/transportations` ile kaydediliyor.

**`/accommodation` — farklı bir çözüm, bilinçli olarak**

Ulaşımdaki yaklaşım burada işe yaramıyor: ulaşım süresi mesafeden
türetilebiliyor (fizik), otel fiyatı türetilemez — oda müsaitliği ve
gecelik fiyat ancak bir tedarikçi API'sinden (Booking, Amadeus) gelir ve o
bir sözleşme/maliyet kararı.

Uydurmakla tedarikçi arasındaki dürüst orta yol: yeni
**`GET /api/accommodation-options`** ucu, kurulu arama sağlayıcısıyla
GERÇEK fiyat sayfalarını buluyor (sosyal medya eleniyor, alan adı başına
tek sonuç, en fazla 6). Kullanıcı fiyatı orada görüyor, seçtiği
konaklamayı forma girip `POST /api/trip/accommodations` ile kaydediyor.
"Forma ekle" düğmesi kaynağın adresini forma taşıyor.

Uydurma yıldız/puan GÖSTERİLMİYOR: bilmediğimiz şeyi göstermemek, yanlış
göstermekten iyidir. Gecelik ücret girildiğinde toplam tutar anında
gösteriliyor — kullanıcı "2.051" yazıp toplamın 6.153 olduğunu
kaydettikten sonra öğrenmesin.

**Sorgu metni kopyalanmadı.** `otelAramaSorgusu` `web-search.ts`'ten dışa
açıldı; modele sunulan `get_hotel_prices` aracı ve yeni uç aynı sorguyu
kuruyor. Metin gerçek Tavily sonuçlarıyla ayarlandığı için kopyalansa iki
taraf zamanla ayrışırdı.

**Yan kazanç: `originCity` nihayet okunuyor.** `/api/my-plans` artık bu
sütunu döndürüyor ve ulaşım sayfası güzergâhı ondan ön dolduruyor
(B6'nın çekirdek değeri). Tarih de planın başlangıcından geliyor; varsayılan
"bugün" kalsaydı kaydedilen ulaşım seyahat aralığının tamamen dışına
düşerdi.

**`/terms` güncellendi:** "demo verisidir" ifadesi kaldırıldı, ulaşımın
tahmin, konaklamanın harici site listesi olduğu yazıldı.

9 birim testi (`routes/accommodation-options.test.ts`).

#### ✅ Adım 5 — Kapanış (TAMAMLANDI · 4 Eylül 2026)

**Sorun neydi.** Adım 2–4'ten sonra bütçe ve günlük planlayıcı ilişkisel
tabloya yazıyordu, ama üç ekran hâlâ `TripPlan`ın JSON sütunlarını
okuyordu: **planlar listesi, profil istatistikleri, plan detayı.** O yüzden
her iki sayfa da ilişkisel yazmadan sonra bir de `PATCH/PUT
/api/plan-detail/[id]` çağırıp arşiv sütunlarını güncelliyordu — "geçiş
dönemi çift yazması". İki modeli aynı anda güncel tutmak, ayrışmaları için
**tek bir hata yolunun yetmesi** demekti.

**Çözüm yönü: istemciyi değil, SUNUCUYU değiştirmek.** Üç ekranı ayrı ayrı
ilişkiselleştirmek, aynı ekranların iki farklı okuma koduna sahip olması
demekti. Bunun yerine yeni **`src/lib/iliskisel-plan-ozeti.ts`** taşınmış
bir plan okunurken `total_cost`, `daily_cost`, `butce_tahmini` ve
`gun_plani` alanlarını ilişkisel tablolardan üretip **arşiv sütunlarıyla
aynı şekilde** döndürüyor. Üç ekranın hiçbiri değişmedi; hiçbiri artık bayat
bir sütun okumuyor.

Değişen uçlar: `GET /api/my-plans`, `GET /api/my-trips`,
`GET /api/profile`, `GET /api/plan-detail/[id]`.

**"Kalemi yok" ile "toplamı sıfır" AYNI ŞEY DEĞİL.** Taşıma, bütçesi
markdown olan planlarda kalem üretmiyor (sayıya güvenilmiyor). Böyle bir
planı 0 TL göstermek kullanıcıya verisi silinmiş gibi görünürdü. Kalem
yoksa arşiv değerine geri düşülüyor; kalem varsa toplam 0 bile olsa
ilişkisel taraf kazanıyor.

**Çift yazmanın yerini alan kural.** `PUT /api/plan-detail/[id]` yalnızca
gün planını kaydetmiyordu; aktivite maliyetlerini bütçenin "aktiviteler"
kategorisine de yansıtıyordu. O çağrı kaldırıldığı için aynı kural
`POST/PUT/DELETE /api/trip/daily-plans` uçlarına taşındı
(`aktiviteButcesiniEsitle`). Olmasaydı eklenen bir aktivitenin maliyeti
hiçbir toplamda görünmezdi. **JSON modelinden bir iyileşme:** `isPaid`
korunuyor — eski uç her eşitlemede "ödendi" işaretini siliyordu.

**Bu adımda bulunan iki tuzak**

1. **Koordinatlar ilişkisel modelde YOKTU.** Harita rotayı aktivite
   koordinatlarından çiziyor, koordinatlar ise yalnızca `gun_plani`de
   duruyordu; taşıma da onları taşımıyordu. `gun_plani`yi ilişkisel
   modelden türetmek, taşınan her planın haritasını — kullanıcı hiçbir şey
   yapmadan — boşaltacaktı. `dailyActivitySchema`, taşıma dönüştürücüsü,
   iki yönlü şekil çevirisi ve günlük planlayıcının `Activity` tipi
   koordinat taşıyacak şekilde genişletildi.
2. **Yazılacak yer, okunan yer olmalı.** Koordinat tamamlama ucu ilk halde
   yalnızca taşınma damgasına bakıyordu. Satırı olmayan taşınmış bir planda
   günler arşivden okunuyor, sonuç ise ilişkisel tabloya yazılmaya
   çalışılıyor ve eşleşecek satır olmadığı için **çözülen koordinatlar
   sessizce kayboluyordu.** Testin yakaladığı gerçek bir hata.

**Gün eşleştirmesi TARİHE göre, sıraya göre değil** (`@@unique([tripId,
date])`). İndeksle eşleştirmek, araya bir gün eklenmiş planda bütün
koordinatları bir gün kaydırırdı.

**Sütunlar SİLİNMEDİ.** Taşınmamış planlar için hâlâ tek gerçek kaynak;
taşınmışlar için ilişkisel tabloların sessiz kaldığı yerde geri düşme
noktası. Silme kararı ayrı bir migration ve ayrı bir karar.

**44 yeni test** (27 modül + 10 uç + 4 koordinat çevirisi + 3 taşınmış
koordinat ucu) ve **5 canlı test** — gerçek Postgres'e karşı, çünkü sahte
istemci `@db.Date` sütununu taklit etmiyor ve A19 tam olarak orada
çıkmıştı.

---

**Doğrulama:** typecheck ✅ · lint ✅ · 570 test ✅ · build ✅ 37 sayfa

**ADIM 5 CANLI DOĞRULAMASI (gerçek Postgres, `npm run test:canli`)**

| Ne | Sonuç |
|---|---|
| Arşiv bayat, ilişkisel doğru | `total_cost` sütunu 12.000; türetilen toplam **7.000** (4.000 + 3.000) |
| Gün planı türetmesi | 2 gün, `2026-11-02` ve `2026-11-03` — **tarih kayması yok** (A19 tuzağı) |
| Alan eşlemesi | `title→name`, `time→startTime`, notlar korunuyor |
| Plan detayı üstüne yazma | `daily_cost` 2.333 (7.000 / 3 gün, kapsayıcı); `isPaid` korunmuş |
| Aktivite eşitlemesi | "1. gün — Kolezyum" + "2. gün — Vatikan" üretildi, toplam **7.800** |
| Diğer kategoriler | Uçak kalemi 4.000 ve "ödendi" işareti **değişmedi** |
| Koordinat yazması | 2. güne yazıldı, **1. güne bulaşmadı** (tarihle eşleştirme) |
| Mevcut veri | 51 kullanıcı / 32 plan — dokunulmadı, test satırları silindi |

**ADIM 5 TARAYICI DOĞRULAMASI (dev sunucu + gerçek Postgres, taşınmış plan)**

Arşivde 12.000 TL yazan, ilişkisel tarafta 7.000 TL'lik iki kalemi olan bir
plan taşındı; sonra ekranlardan düzenlendi.

| Ne | Sonuç |
|---|---|
| İlk okuma | `/my-plans`, `/my-trips`, `/profile`, `/plan-detail` — **dördü de ₺7.000** (arşiv 12.000 diyor) |
| Koordinat | Taşınan aktivitenin koordinatı korunmuş (41.8902, 12.4922) — harita rotası ayakta |
| Günlük planlayıcıda aktivite ekle | **1 GET + 1 PUT.** `/api/plan-detail` çağrısı **YOK** — çift yazma gerçekten kalktı |
| Aktivite maliyeti bütçeye | Sunucu 3 "aktiviteler" kalemi üretti; kart anında **₺8.050** oldu (7.000 + 500 + 300 + 250) |
| "Ödendi" işareti | Uçak kalemi 4.000 ve ödendi — aktivite eşitlemesi **dokunmadı** |
| Bütçe sayfasında kalem ekle | **1 GET + 1 POST + 1 GET.** Değişmeyen 5 kalem istek üretmedi; `/api/plan-detail` yine **YOK** |
| Kart tazelenmesi | ₺8.500 — sunucudan OKUNAN listeden hesaplandı, ekrandaki taslaktan değil |
| Son okuma | Üç ekran da **₺8.500**; günlük ₺2.833 (3 gün) |
| **Arşiv sütunu** | `total_cost` hâlâ **12.000**, `butce_tahmini` ilk hâli — taşımadan sonra bir kez bile yazılmadı |
| Temizlik | Test kullanıcısı silindi; 51 kullanıcı / 32 plan / 0 gezi — başlangıç durumu |

**ADIM 1–4 CANLI DOĞRULAMASI (Postgres + tarayıcı, uçtan uca).**

| Ne | Sonuç |
|---|---|
| Taşıma raporu (`GET`) | Taşınacak 1 / Atlanacak 0 / Taşınmış 0 |
| Taşıma uygula (`POST`) | 1 plan taşındı; `migratedAt` + `tripId` yazıldı |
| Üretilen kayıtlar | 3 `BudgetItem` (toplam 12.000, Türkçe kategoriler, `isPaid` korunmuş) + 2 `DailyPlan` (doğru tarihler) |
| Bütçe sayfası okuma | `/api/trip/budget?tripId=…` çağrıldı — `plan-detail` DEĞİL |
| Ekranda | 3 kalem, toplam ₺12.000, önerilen ₺14.400 (×1,2), ödenen ₺4.000 |
| Kaydet — tek alan değişti | **1 GET + 1 PUT + 1 GET.** Değişmeyen 2 kalem hiç istek üretmedi |
| Kaydet — sil + ekle | **1 GET + 1 DELETE + 1 POST + 1 GET.** Sıra: silme → ekleme |
| Yeni kalem kimliği | Gerçek DB cuid aldı (istemcinin geçici id'si değil) — yeniden okuma çalışıyor |
| İki model tutarlılığı | ilişkisel 10.750 = `TripPlan.total_cost` 10.750 = `butce_tahmini` 10.750; `daily_cost` 2.150 (10.750/5) |

**Adım 3 (günlük planlayıcı) da canlı doğrulandı:**

| Ne | Sonuç |
|---|---|
| Okuma | `/api/trip/daily-plans?tripId=…` çağrıldı; 3 gün, doğru tarihler |
| Alan eşlemesi | `title→name`, `time→startTime` doğru (Kolezyum · 09:00–12:00 · ₺500) |
| 3. güne aktivite ekle | **1 GET + 1 PUT.** Değişmeyen 1. ve 2. gün istek üretmedi |
| Tarih kayması | Yok — `2026-11-02, 11-03, 11-04` (A19 düzeltmesinden sonra) |
| Çift yazma | `gun_plani` da güncellendi; `total_cost` 1.150 (500+400+250), `daily_cost` 383 |

**Adım 4 (konaklama ve ulaşım) da canlı doğrulandı:**

| Ne | Sonuç |
|---|---|
| Ulaşım ön doldurma | `originCity` → İstanbul, plan şehri → Ankara, tarih → planın başlangıcı |
| Ulaşım araması | Gerçek sonuç: Tren TCDD 4 sa 44 dk ₺370, Otobüs 7 sa 8 dk ₺530 |
| **Tahmin doğruluğu** | Otobüs tahmini ₺530; kaynaklar (ComparaBUS, Ucuzabilet, ENUYGUN) **499–600 TL** diyor — mertebe doğru |
| Ulaşım kaydetme | `Transportation` satırı: Tren/TCDD, kalkış 09:00 yerel, varış = kalkış + 4 sa 44 dk, ₺370 |
| Konaklama ön doldurma | Şehir Ankara, giriş/çıkış planın tarihleri (10–13 Aralık) |
| Konaklama araması | 6 gerçek site (enuygun, tatilbudur…), snippet'lerde gerçek fiyatlar |
| Toplam hesabı | 2.051 ₺/gece × 3 gece = **₺6.153** — kaynaktaki fiyatla birebir |
| Konaklama kaydetme | `Accommodation` satırı: ad, konum, 10→13 Aralık, ₺2.051 gecelik, rezervasyon bağlantısı |

**A1 de davranışsal olarak kanıtlandı:** bağlı `Trip` silindi → `TripPlan`
AYAKTA KALDI, `tripId` null oldu, Trip'in kendi `BudgetItem`ları cascade ile
gitti. Düzeltme öncesi aynı işlem kullanıcının planını yok ediyordu.

Test verisi (kullanıcı + plan) doğrulama sonrası silindi; mevcut 32 plan ve
51 kullanıcıya dokunulmadı.

---


### B5 — CSP'yi zorlama moduna al · ✅ TAMAMLANDI (4 Eylül 2026)

**Bugün ne vardı:** nonce + `strict-dynamic` tabanlı düzgün bir CSP, ama
`CSP_MODE=enforce` verilmedikçe `Content-Security-Policy-Report-Only`
olarak gidiyordu — yani **hiçbir şey engellenmiyordu.** LLM çıktısı
`dangerouslySetInnerHTML` ile basılıyor; CSP orada ikinci savunma hattı
olmalıydı ve devre dışıydı.

**ÖNCE ÖLÇÜLDÜ, SONRA AÇILDI.** Ana sayfa, giriş, harita, planlar, bütçe
ve günlük plan gezilip konsol toplandı: **200 CSP ihlali, hepsi TEK
SINIF — `unsafe-eval`.** Google Maps script'i, fontlar, görseller,
`connect-src`, `style-src`, `frame-src`: hiçbiri ihlal üretmedi. Yani
politika uygulamaya hazırdı.

**`unsafe-eval` ihlalleri uygulamadan gelmiyordu.** Next.js dev sunucusu
webpack'in `eval` tabanlı kaynak haritalarını kullanıyor. Üretim
derlemesi ayrıca kontrol edildi:

```
grep -o "eval(" .next/static/chunks/*.js | wc -l        → 0
grep -o "new Function(" .next/static/chunks/*.js | wc -l   → 0
```

Bu ayrım olmadan "ihlal var, demek ki zorlanamaz" sonucuna varılırdı ve
politika sonsuza kadar rapor modunda kalırdı.

**Yeni davranış** (`cspZorlanacakMi`):

| Ortam | Mod |
|---|---|
| `production` | **Zorlanıyor** (`Content-Security-Policy`) |
| geliştirme / test | Rapor (`…-Report-Only`) |

Geliştirmede zorlamak webpack'in `eval`ini bloklayıp uygulamayı yerelde
tamamen çalışmaz hale getirirdi.

`CSP_MODE` **iki yönde de** geçersiz kılıyor:
`enforce` → her ortamda zorla (yerelde denemek için);
`report` → her ortamda rapor et — **üretimde bir şey kırılırsa kod
değişikliği ve yeniden dağıtım olmadan geri dönüş yolu.**

6 birim testi (`tests/csp.test.ts`). Canlı doğrulandı: geliştirmede
`Content-Security-Policy-Report-Only` başlığı geliyor, zorlayan başlık
gelmiyor ve harita yükleniyor.

**Kalan iş:** `report-to` / `report-uri` ile bir ihlal toplayıcı bağlamak.
Şu an ihlaller yalnızca tarayıcı konsoluna düşüyor; üretimde kimse
görmüyor.

---

### B6 — Kalkış şehrini uçtan uca tamamla · ✅ TAMAMLANDI (5 Eylül 2026)

**Bugün ne var**

`TripPlan.origin_city` sütunu ve `[origin_city, city]` indeksi mevcut
(migration `20260902120000`). Yalnızca `POST /api/manual-travel-plan`
dolduruyor.

**Sorun ne**

Sütun **hiçbir yerde okunmuyor**. AI planlayıcının formunda kalkış alanı yok,
`planRequestSchema`da karşılığı yok, `plan-generation.ts` kaydetmiyor. Yani
AI yoluyla üretilen her planda `origin_city` daima `null` ve ulaşım maliyeti
plana hiç girmiyor — kullanıcı "İstanbul'dan Kars'a" planı istediğinde
bütçede uçak bileti yer almıyor.

`src/lib/seyahat-mesafe.ts` bu hesabı zaten yapabiliyor; manuel planlayıcı
form durumundan besliyor, kaydedilmiş sütundan değil.

**Ne yapılacak**

1. `ai-planner` formuna kalkış şehri alanı (`SEHIRLER` listesinden
   otomatik tamamlamalı).
2. `planRequestSchema`ya `originCity: z.string().trim().max(80).optional()`.
3. `plan-generation.ts`:
   - `saveTripPlanToDatabase` `originCity`i yazsın.
   - Prompt'a güzergâh bilgisini ekle.
   - `rotaHesapla(originCity, city)` sonucunu bütçenin **ulaşım** kategorisine
     bir kalem olarak koy; kaynağını "tahmin" olarak etiketle.
4. `plan-detail` başlığında güzergâhı göster (`İstanbul → Kars`).
5. `prisma/schema.prisma` içindeki `origin_city` yorumunu güncelle — şu an
   bu belgeye "henüz okunmuyor" diye referans veriyor.

**Bağımlılık:** yok. B7 ile birlikte yapılırsa ulaşım seçimi de bağlanabilir.

---

**Yapıldı.**

1. `planRequestSchema` → `originCity` (opsiyonel: yurt dışı ve "zaten
   oradayım" senaryolarında karşılığı yok).
2. AI planlayıcı formuna **kalkış şehri** alanı; 81 il DATALIST olarak
   bağlı — seçim kutusu DEĞİL, otomatik tamamlama. Zorunlu bir liste,
   yurt dışından gelen kullanıcıyı dışarıda bırakırdı.
3. `plan-generation.ts`: sütuna yazıyor, prompt'a güzergâh satırı ekliyor,
   bütçeye şehirlerarası ulaşım kalemini koyuyor.
4. Plan detayı başlığında güzergâh (**İSTANBUL → ANKARA**) ve künyede
   "Kalkış" satırı.
5. `schema.prisma` yorumu güncellendi ("henüz okunmuyor" ifadesi kalktı).

**Asıl kazanç — bütçe artık yolculuğu içeriyor.** Yeni
**`src/lib/ulasim-butce.ts`** (saf, 19 test):

- **Fiyat MODELE SORULMUYOR.** Mesafe ve süre fizik; `seyahat-mesafe.ts`
  bunu 81 ilin koordinatından hesaplıyor ve sonuç tekrarlanabilir. Aynı
  soruyu LLM'e sormak her üretimde başka bir rakam almak demekti.
- **Tutar GİDİŞ-DÖNÜŞ.** Tek yön yazmak maliyeti yarı yarıya eksik
  gösterirdi ve kullanıcı bunu ancak dönüş biletini alırken fark ederdi.
- **Seçim: önce kullanıcının tercihi, yoksa EN UCUZ.** En hızlıyı seçmek,
  uçak tercihi belirtmemiş bir kullanıcının bütçesini sessizce uçak
  biletine göre şişirirdi.
- **Modelin kendi kalemleri EZİLMİYOR.** Şehir içi metro/taksi meşru ve
  gerekli; şehirlerarası ulaşım onların yerine değil, yanına giriyor.
- Kalkış boşsa, şehir 81 il dışındaysa ya da kalkış = varış ise kalem
  **sessizce eklenmiyor**: 4 dakikalık bir zincirin sonunda planı
  "kalkış şehrinizi tanımadım" diye kaybetmek kabul edilemez.

**Prompt'a fiyat değil BAĞLAM giriyor:** "Yolculuk İstanbul çıkışlı: ilk
günü varışa, son günü dönüşe göre planla." Eskiden model her planı
"şehirdesiniz" varsayımıyla yazıyordu.

**Doğrulama:** 19 birim testi (`ulasim-butce.test.ts`) + 6 uçtan uca test
(`plan-generation.test.ts`: sütun yazılıyor mu, kalem giriyor mu, tercih
yansıyor mu, tanınmayan şehirde plan yine üretiliyor mu, prompt'ta
güzergâh var mı).

**Tarayıcıda doğrulandı:** form alanı 81 illik datalist ile bağlı; kalkışı
dolu bir planın detayında başlıkta "İSTANBUL → ANKARA", künyede "KALKIŞ
İstanbul", bütçede "İstanbul → Ankara gidiş-dönüş (Otobüs, tahmini · kişi
başına) ₺1.060" şehir içi ₺240 kaleminin yanında duruyor.


---

### B7 — Demo sayfaları gerçek veriye bağla

**Bugün ne var**

`/accommodation` ve `/transportation` sayfaları tamamen **sabit demo
verisiyle** çalışıyor — hiçbir `fetch` yok. Sayfaların kendi docblock'ları
ve `/terms` bunu açıkça söylüyor.

**Sorun ne**

Ana sayfadan linklenmiş iki ekran gerçek bir arama yapıyormuş gibi
görünüyor. Uyarı listenin üstünde duruyor, yani dürüstlük sorunu çözülmüş
ama **işlev** yok.

Oysa altyapı hazır:
- `/api/transport-options` gerçek mesafe hesabı + Tavily araması yapıyor ve
  manuel planlayıcı bunu zaten kullanıyor.
- `/api/trip/accommodations` ve `/api/trip/transportations` CRUD uçları
  yazılmış ve test edilmiş.

**Ne yapılacak**

1. `/transportation` sayfasını `/api/transport-options`e bağla. Manuel
   planlayıcıdaki çağrı deseni birebir kullanılabilir. "Tahmini" etiketi
   korunmalı — `maliyetBirimi: "arac"` olan seçenekte kişi başı bölme de.
2. `/accommodation` için karşılığı yok: bir otel fiyat kaynağı gerekiyor.
   İki seçenek —
   a. `web-search.ts`teki `get_hotel_prices` aracını bir REST ucuna çıkar
      (`GET /api/accommodation-options`), Tavily sonuçlarını göster. Ucuz,
      "gerçek fiyat" iddiası taşımıyor.
   b. Gerçek bir tedarikçi API'si (Booking/Amadeus) — sözleşme ve maliyet
      işi, ayrı karar.
   Öneri: (a) ile başla, (b)'yi ürün kararına bırak.
3. Seçilen seçeneği `/api/trip/accommodations` ve
   `/api/trip/transportations` ile plana **kaydet** — B4'ün ilk gerçek
   tüketicisi bu olur.
4. Kaydetme geldiğinde `/terms`teki demo uyarısını güncelle.

**Bağımlılık:** 3. adım B4'e bağlı.

---

### B8 — Harita sayfasını tiplendir · ✅ TAMAMLANDI (4 Eylül 2026)

`@types/google.maps` (3.65.3) zaten kuruluydu ama `src/app/map/page.tsx`
11 yerde `(window as any).google` yazıyordu. Hepsi kaldırıldı; dosyada
artık **sıfır** `any` var.

`window.google` için global bildirim eklendi: tipler global `google` AD
ALANINI tanımlıyor ama `Window.google` alanını tanımlamıyor (script
runtime'da enjekte ediliyor).

**Tiplendirme İKİ GERÇEK HATA ORTAYA ÇIKARDI** — B8'in asıl değeri bu:

| Hata | Neydi |
|---|---|
| `POI.geometry.location` | Elle `{lat: () => number; lng: () => number}` yazılmıştı. Yapısal olarak `LatLng`e benziyor ama Maps API'sinin `position` alanları hem `LatLng` hem `LatLngLiteral` kabul ediyor; elle yazılmış tip, `lat`ın metot mu sayı mı olduğunu ayırt edemeyen bir çağrıyı yakalayamıyordu. Artık `google.maps.LatLng`. |
| Rota ölçüleri | İki yerde `route.distanceMeters / 1000` ve `route.durationMillis / 60000` KOŞULSUZ hesaplanıyordu. Tipler `number \| undefined` ve `number \| null \| undefined` diyor — alanlar `fields` ile isteniyor ama sağlayıcı döndürmeyebiliyor. O durumda ekranda **"NaN km · NaN dk"** yazıyordu. `rotaOlculeri()` artık bilinmeyen ölçüde tire gösteriyor. |

`eslint.config.mjs`'e dosyaya özel `@typescript-eslint/no-explicit-any:
"error"` eklendi ki `any` buraya geri sızmasın.

**Doğrulama:** typecheck ✅ · lint ✅ · build ✅

---

### B9 — Hesap yaşam döngüsünü tamamla · ✅ TAMAMLANDI (5 Eylül 2026)

**Bugün ne var**

Kayıt ve giriş sağlam: IP başına kayıt limiti, e-posta başına giriş limiti,
sabit zamanlı bcrypt karşılaştırması (`SAHTE_HASH`), tekilleştirilmiş hata
mesajı, P2002 yarışı karşılanmış.

**Sorun ne**

- **Şifre sıfırlama yok.** Şifresini unutan kullanıcının yapabileceği bir şey
  yok. Giriş sayfasında link de yok (yani kırık link de yok — özellik hiç yok).
- **`User.emailVerified` alanı şemada var, hiç kullanılmıyor.** Kayıt için
  doğrulanmamış e-posta yeterli.
- **Hesap silme yok.** KVKK/GDPR açısından gerekli; `onDelete: Cascade`
  zincirleri zaten hazır, eksik olan uç ve arayüz.

**Ne yapılacak**

1. `VerificationToken` tablosu zaten şemada (NextAuth adapter'ı için).
   Şifre sıfırlama akışını onun üzerine kur: `POST /api/auth/reset-request`
   → tek kullanımlık token + e-posta; `POST /api/auth/reset` → token doğrula,
   yeni şifreyi `registerSchema` kurallarıyla al.
2. E-posta gönderimi için bir sağlayıcı (Resend/SES). `env.ts`'e opsiyonel
   anahtar; tanımsızsa akış 503 dönsün — sessizce başarılı görünmesin.
3. Kayıt sonrası doğrulama e-postası; `emailVerified` boşken plan üretimini
   kısıtla (kota 5 yerine 1 gibi) — tamamen engellemek yeni kullanıcıyı kaçırır.
4. `DELETE /api/profile`: kullanıcıyı ve cascade ile tüm verisini siler,
   onay için şifre ister.

**Nasıl doğrulanacak:** e2e — kayıt → doğrulama linki → giriş → şifre sıfırla
→ yeni şifreyle giriş.

---

**Yapıldı.** Dört yeni uç, üç yeni sayfa, iki yeni modül.

| Ne | Nerede |
|---|---|
| Şifre sıfırlama isteği | `POST /api/auth/reset-request` + `/forgot-password` |
| Şifre sıfırlama | `POST /api/auth/reset` + `/reset-password` |
| E-posta doğrulama | `POST /api/auth/verify` + `/verify-email` |
| Doğrulama postasını yeniden gönder | `POST /api/auth/verify-request` + profil kartı |
| Hesap silme | `DELETE /api/profile` + profil "Hesap" kartı |

**`src/lib/dogrulama-jetonu.ts` — üç tasarım kararı**

1. **Veritabanında HAM JETON DURMUYOR, SHA-256 özeti duruyor.** Jeton bir
   parola kadar güçlü: elinde olan hesabın şifresini değiştirebilir. Yedek
   dosyası ya da SQL sızıntısı hâlinde ham jetonlar doğrudan kullanılabilir
   olurdu. (bcrypt gerekmiyor: jeton 256 bit rastgele, sözlük saldırısına
   konu değil.)
2. **Amaç `identifier` içinde ve DOĞRULANIYOR.** Aksi halde e-posta
   doğrulama jetonu şifre sıfırlamada kullanılabilirdi — elinde eski bir
   doğrulama bağlantısı olan biri hesabın şifresini değiştirebilirdi.
   Reddedilen deneme jetonu TÜKETMİYOR: meşru kullanıcının bağlantısı
   yanmıyor.
3. **Tüketim tek seferlik ve atomik.** `deleteMany` sonucundaki satır
   sayısı kontrol ediliyor; "önce oku sonra sil" deseni iki eşzamanlı
   isteği de geçirirdi.

**`src/lib/eposta.ts` — sağlayıcı SDK'sı yok.** Resend'in REST ucu tek bir
POST; paket eklemek bu modülün bağımlılığını sağlayıcı seçimine bağlardı.
**Yapılandırılmamışsa sessizce başarılı olmuyor:** sıfırlama ucu 503
dönüyor. "Gönderdik" deyip hiç göndermemek, kullanıcıyı olmayan bir
postayı beklemeye mahkûm ederdi — en kötü hata türü, hiç görünmeyeni.

**Hesap varlığı sızdırılmıyor — zaman kanalı dâhil.** Sıfırlama ucu kayıtlı
ve kayıtsız adrese aynı yanıtı veriyor. Jeton üretimi ve posta gönderimi
`after()` içinde: sağlayıcıya gidip beklemek, kayıtsız adrese göre
ölçülebilir bir SÜRE FARKI yaratır ve gizliliği zaman kanalından sızdırırdı.
Hız sınırı da iki başlı — IP başına (toplu deneme) **ve adres başına**
(tek kişiye posta yağmuru).

**Şifresiz (yalnızca Google) hesaba sıfırlama gönderilmiyor:** bağlantı
gönderseydik kullanıcı şifre belirleyip sonra "neden Google ile
giremiyorum" durumuna düşerdi.

**Doğrulama tamamen engellemiyor, KOTA daraltıyor.** `emailVerified` boşken
saatlik plan hakkı **1**, doluyken **5**. Yeni kullanıcı ürünü denemeden
önce posta beklemek zorunda kalırsa çoğu geri gelmiyor; dar kota hem
denemeye izin veriyor hem de sahte adreslerin LLM maliyetini sınırlıyor
(bir üretim en kötü durumda 8 ardışık model çağrısı). 429 yanıtı kullanıcıya
**çıkış yolunu** da söylüyor: "E-posta adresinizi doğrularsanız saatlik
hakkınız 5'e çıkar."

**Doğrulama sayfası GET değil POST kullanıyor.** E-posta istemcileri ve
kurumsal bağlantı tarayıcıları postadaki adresleri kullanıcı adına ÖN
YÜKLÜYOR; doğrulamayı GET'e bağlamak jetonun kullanıcı tıklamadan
tüketilmesi demekti. Ayrıca React 18 katı modda efekt iki kez çalıştığı
için `useRef` nöbeti var — olmasaydı doğru çalışan akış kullanıcıya
"geçersiz bağlantı" olarak görünürdü.

**Hesap silmede üç sürtünme katmanı:** düğme doğrudan silmiyor formu
açıyor; form NE SİLİNECEĞİNİ tek tek yazıyor ("hesabınız silinecek" cümlesi
planlarının da gideceğini söylemiyor); şifre elle yazılıyor. `confirm()`
kullanılmıyor — biçimlendirilemiyor, otomasyonda sessizce false dönüyor ve
mobilde kolayca kazara onaylanıyor. Google hesaplarında şifre yerine
**e-posta adresi** isteniyor; hangisinin beklendiğine sunucu karar veriyor.
Profil ucu şifre HASH'İNİ değil, yalnızca **varlığını** (`sifreVar`)
gönderiyor.

**BİLİNEN SINIR — açık oturumlar sonlandırılmıyor.** NextAuth burada JWT
stratejisiyle çalışıyor: oturum sunucuda bir satır değil, imzalı bir çerez.
Şifre değişse de daha önce verilmiş bir JWT süresi dolana kadar geçerli
kalıyor; yani oturumu çalınmış bir kullanıcı şifresini değiştirerek
saldırganı ANINDA atamıyor. Kapatmanın yolu her istekte veritabanına bakmak
(JWT'nin varlık sebebini ortadan kaldırır) ya da şemaya bir "şifre değişim
damgası" ekleyip `jwt` geri çağrısında karşılaştırmak. İkincisi doğru
çözüm; ayrı bir madde olarak **E9**'a yazıldı.

**Doğrulama:** 13 + 13 + 24 = **50 birim/uç testi** (`dogrulama-jetonu`,
`eposta`, `routes/hesap-yasam-dongusu`) ve **5 canlı test** gerçek
Postgres'e karşı — sahte istemci `token` sütunundaki benzersiz indeksi ve
cascade zincirini taklit etmiyor, oysa jeton mantığının tamamı o indekse,
"hesabımı sil her şeyi siler" sözü de o zincire dayanıyor.

**TARAYICIDA UÇTAN UCA DOĞRULANDI (gerçek Postgres):**

| Ne | Sonuç |
|---|---|
| `/api/auth/*` statik rotaları | NextAuth catch-all'ı **yutmuyor** — 503 ve 400 kendi uçlarımızdan geldi |
| E-posta yapılandırılmamışken sıfırlama | **503**, açık mesajla |
| Doğrulama bağlantısı | `emailVerified` doldu, jeton DB'den silindi, çift efekt hata üretmedi |
| Sıfırlama — eşleşmeyen şifreler | İstemcide yakalandı, **jeton harcanmadı** |
| Sıfırlama — doğru çift | Şifre değişti |
| Aynı bağlantı ikinci kez | **400** |
| ESKİ şifreyle giriş | **401** |
| YENİ şifreyle giriş | **200**, oturum açıldı |
| Profil ucu | `sifreVar: true`, `password` alanı yanıtta **YOK** |
| Doğrulama kartı | Yalnızca doğrulanmamış hesapta görünüyor |
| Hesap silme — yanlış şifre | Hesap **duruyor** |
| Hesap silme — doğru şifre | Kullanıcı, planı ve jetonları gitti; oturum kapandı |
| Mevcut veri | 51 kullanıcı / 32 plan — dokunulmadı |


---

### B10 — Gözlemlenebilirlik ve dağıtım · ✅ TAMAMLANDI (4 Eylül 2026)

**1. Hız sınırlayıcı görünürlüğü.** `GET /api/health` artık
`checks.rateLimit.dagitik` yayımlıyor VE üretimde dağıtık sayaç yoksa
okunur bir `uyari` metni ekliyor. Bu sessiz bir bozulmaydı: `UPSTASH_*`
tanımsızsa sayaç süreç içi tutulur, hiçbir hata üretmez, ama yatay
ölçeklemede sınır instance sayısı kadar katlanır — saatte 5 plan hakkı
4 instance'ta 20 olur.

**2. Asılı işler artık kullanıcıdan bağımsız temizleniyor.**
Yeni uç: `POST /api/plan-jobs/temizle`.

Sorun şuydu: temizlik YALNIZCA kullanıcı durum sorgusu yaptığında
çalışıyordu. Kullanıcı sekmeyi kapatıp bir daha sormazsa iş sonsuza kadar
RUNNING kalıyor — ve sonucu kozmetik değil: `devamEdenIs` o işi "devam
ediyor" saydığı için **kullanıcı 10 dakika boyunca yeni plan
üretemiyordu.** Asılı bir iş kullanıcıyı kilitliyordu.

`tumAsilKalanlariTemizle()` AYRI BİR FONKSİYON olarak yazıldı,
`asilKalanlariTemizle(userId?)` değil. Sebebi bu kod tabanının kendi
yarası: Prisma'da `where: { userId: undefined }` "filtre yok" demek ve
sahiplik koşulu sessizce düşüyor (bkz. `src/lib/auth-session.ts`).
Opsiyonel parametre, yanlışlıkla `undefined` geçen bir çağrının BÜTÜN
kullanıcıların işlerini temizlemesine yol açardı — kapsam farkı fonksiyon
adında görünür olmalı.

Kimlik: oturum değil, `CRON_SECRET` paylaşılan sırrı (sabit zamanlı
karşılaştırma). Sır tanımsızsa uç **kapalı (503)** — sırsız çalışan bir
temizlik ucu, herkesin çağırabildiği bir yazma ucudur. 401 yanıtı hangi
kısmın yanlış olduğunu söylemiyor. 8 birim testi.

**3. Hata izleme kancası.** `logger.error` zaten tek kapıydı; artık
`hataDinleyicisiKur()` ile bir sağlayıcı bağlanabiliyor.

Doğrudan bir SDK çağrısı konulmadı: bu modül sunucu rotalarından,
`"use client"` bileşenlerinden ve Edge middleware'den import ediliyor;
üçünde birden çalışan bir paket seçme zorunluluğu modülün sıfır
bağımlılığını (~1.5 KB) bozardı. Kanca yalnızca `error` seviyesinde
tetikleniyor (uyarılar sağlayıcıyı doldurup gerçek hataları gömerdi),
detay MASKELENMİŞ gidiyor, ve dinleyicinin patlaması asıl hatayı
gizlemiyor. 6 birim testi.

**4. `.env.example` üretim kontrol listesi.** Sekiz maddelik, her biri
"neden önemli" açıklamalı. Ortak yanları: hiçbiri uygulamayı çalışmaz
hale getirmiyor, hepsi sessizce bozulan şeyler.

**Doğrulama:** typecheck ✅ · lint ✅ · 526 test ✅ · build ✅

**Kalan iş:** zamanlayıcının kendisi (Vercel Cron / GitHub Actions /
systemd timer) dağıtım ortamında kurulmalı; kod tarafı hazır.

---

## Ek — Küçük borçlar (bir oturumda toplu kapatılabilir)

| # | Konu | Yer |
|---|---|---|
| E1 | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` **zorunlu**; harita kullanmayan bir kurulum bile anahtarsız açılmıyor. `.optional()` yapıp `/map`'te "harita yapılandırılmamış" durumu göster | `src/env.ts` |
| E2 | `extraItemsTotal` her yazıcıda 0, hiçbir okuyucuda hesaba katılmıyor. Yeni bir şema sürümünde kaldırılmalı | `src/lib/plan-budget.ts` |
| E3 | `TripStatus` hem `COMPLETED` hem `DONE` taşıyor. Ayrım gerçek ("tarih geçti" vs "kullanıcı gerçekleşti dedi") ama arayüzde "Tamamlandı"/"Gerçekleşti" ayrımı kullanıcıya açıklanmıyor | `src/lib/trip-status.ts` |
| E4 | `profile/update` `preferredTransport: ''` gönderildiğinde 400 döner (enum). Form hiç veri çekmeden kaydedilirse tetiklenir | `src/app/api/profile/update/route.ts` |
| E5 | `authorize()` `throw new Error(...)` kullanıyor; NextAuth v4 bunu istemciye `CredentialsSignin` olarak veriyor, özel mesajlar kaybolabiliyor | `api/auth/[...nextauth]/options.ts` |
| E6 | `handleDownloadPDF` "geliştirme aşamasında" toast'ı gösteriyor. Ya uygula ya butonu kaldır | `src/app/ai-planner/page.tsx` |
| E7 | i18n altyapısı yok; arayüz tek dil. Yurt dışı açılımı (bkz. `yurtdisi-genisletme.md`) bunu gerektirecek | genel |
| E8 | Varsayılan modeller **akıl yürütme (reasoning)** modelleri; düşünce token'ları `max_tokens` bütçesinden düşüyor. Uzun bir plan JSON'unda bütçe dolarsa `finish_reason: "length"` gelir ve `plan-generation.ts` o stratejiyi atlar. Ölçüm gerek: gerçek bir plan üretiminde kaç token reasoning'e gidiyor? | `src/lib/openrouter.ts` |
| E10 | **Together çağrı zaman aşımı (90 sn) agentic döngünün geç turlarında dar.** Ölçülen bir üretimde 4. turda tetiklendi; zincir OpenRouter'a düştü ve toplam süre 268 sn oldu — `TOPLAM_SURE_BUTCESI_MS` (240 sn) üstünde. Çağrı zaman aşımı, `AGENTIC_MAKS_TUR` ve araç sonucu kırpma sınırı birlikte ölçülüp ayarlanmalı | `src/lib/together.ts`, `src/lib/plan-generation.ts` |
| E9 | **Şifre sıfırlama açık oturumları sonlandırmıyor.** JWT stratejisinde oturum sunucuda bir satır değil, imzalı bir çerez; şifre değişse de eski JWT süresi dolana kadar geçerli. Oturumu çalınmış kullanıcı şifresini değiştirerek saldırganı anında atamıyor. Çözüm: şemaya `passwordChangedAt` ekleyip `jwt` geri çağrısında `token.iat` ile karşılaştırmak. Migration + auth yapılandırması gerektirdiği için B9 kapsamı dışında bırakıldı | `api/auth/[...nextauth]/options.ts` |

---

## Çalışma disiplini — bu repo için geçerli kurallar

1. **Tek dev sunucusu.** İki `next dev` aynı `.next` dizinine yazınca webpack
   `reading 'call'` hatası veriyor. Yeni sunucu başlatmadan önce mevcudu
   kapatın.
2. **Gerçek çağrıyla doğrulayın.** Mock'lu testler yeşilken gerçek
   anahtarlarla üç canlı hata çıktı. Sağlayıcıya dokunan her değişiklikten
   sonra `npm run test:canli`.
3. **Her düzeltmenin bir bekçisi olsun.** Bu turda kapatılan altı hatanın
   beşinin regresyon testi var; altıncısı (A7/A9) B3 ve B7 kapsamında
   testlenecek.
4. **Doğrulama zinciri:**
   `npm run typecheck && npm run lint && npm test && npm run build`
