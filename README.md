# Trip Planner — AI Destekli Seyahat Planlama Platformu

Next.js 15 + React 19 + Prisma ile geliştirilmiş, yapay zeka destekli seyahat planlama uygulaması.
Kullanıcı bir şehir ve tercihlerini giriyor, uygulama OpenRouter üzerinden bir LLM'e detaylı
plan ürettiriyor, planı bölümlere ayırıp veritabanına kaydediyor ve bütçe/günlük program
yönetimini üstüne kuruyor.

> **Durum:** aktif geliştirme. "Özellikler" bölümü uygulamada **çalışan** özellikleri
> listeler; henüz yapılmamış işler "Yol haritası" başlığı altındadır.

---

## Özellikler

**Seyahat planlama**
- AI destekli plan üretimi (şehir, tarih, bütçe, ilgi alanları, seyahat tarzı)
- Manuel plan editörü
- Günlük program planlayıcı ve gün bazlı rota haritası
- Google Maps üzerinden POI (ilgi noktası) keşfi

**Bütçe yönetimi**
- Kategorik harcama takibi (ulaşım, konaklama, yemek, aktivite, alışveriş, eğlence)
- Tahmini/gerçekleşen ve ödendi/ödenmedi ayrımı
- Toplam ve günlük bütçe özeti
- Bütçe toplamları **sunucuda** kategori kalemlerinden türetilir; günlük plandaki
  aktivite maliyetleri bütçenin "aktiviteler" kategorisine otomatik yansır

**Plan yönetimi**
- Plan durumları: `PLANNED`, `ACTIVE`, `COMPLETED`, `CANCELLED`, `DONE`
- Durum geçişleri sunucuda kural tablosuyla doğrulanır (`src/lib/trip-status.ts`);
  `CANCELLED` ve `DONE` uç durumdur
- Kaydedilmiş planların listelenmesi, detay görüntüleme ve silme
- Konaklama ve ulaşım kayıtları

**Kullanıcı**
- E-posta/şifre ile kayıt ve giriş (NextAuth, JWT oturum)
- Google ile giriş (opsiyonel, `GOOGLE_CLIENT_ID`/`SECRET` tanımlıysa)
- Profil ve tercih yönetimi

---

## Teknoloji

| Katman | Kullanılan |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Stil | Tailwind CSS 4 |
| Veritabanı | **PostgreSQL** + Prisma 6 |
| Auth | NextAuth v4 (Credentials + Google), JWT oturum |
| AI | OpenRouter (`deepseek/deepseek-r1-0528-qwen3-8b:free`) |
| Harita | Google Maps JavaScript API |
| Bildirim | react-hot-toast |
| Test | Vitest (birim + handler), Playwright (e2e) |
| Dağıtım | Docker (standalone çıktı) |

---

## Kurulum

### Gereksinimler
- Node.js 20+
- Çalışan bir PostgreSQL örneği
- OpenRouter API anahtarı
- Google Maps JavaScript API anahtarı

### Adımlar

```bash
git clone https://github.com/ibrhmgldmr3/Trip-Planner.git
cd Trip-Planner/web
npm install
cp .env.example .env.local
```

`npm install` sonrası `postinstall` otomatik olarak `prisma generate` çalıştırır.

`.env.local` içindeki değerleri doldurun (açıklamalar dosyanın içinde):

```env
DATABASE_URL="postgresql://kullanici:parola@localhost:5432/trip_planner"
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
OPENROUTER_API_KEY="sk-or-..."
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="AIza..."
```

Veritabanı şemasını uygulayın ve sunucuyu başlatın:

```bash
npx prisma migrate dev
npm run dev
```

> **Mevcut kurulumdan yükseltiyorsanız:** `20260831090000` migration'ı terk
> edilmiş `userEmail` sütunlarını **düşürür** (geri alınamaz) ve `DailyPlan`
> üzerinde tarih başına tek plan kısıtı kurar. Uygulamadan önce yedek alın;
> migration, sahipsiz kalmış planları e-postadan kurtarma adımıyla başlıyor.

[http://localhost:3000](http://localhost:3000) adresini açın.

> **Güvenlik notu:** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` tarayıcı bundle'ına gömülür —
> bu Maps JS API için normaldir. Google Cloud Console'da anahtara mutlaka **HTTP referrer**
> kısıtı tanımlayın. `OPENROUTER_API_KEY` yalnızca sunucuda kalır; hiçbir koşulda
> `NEXT_PUBLIC_` önekiyle tanımlamayın.

---

## Komutlar

```bash
npm run dev        # geliştirme sunucusu
npm run build      # üretim derlemesi
npm run start      # üretim sunucusu
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # Vitest: birim + route handler testleri
npm run test:e2e   # Playwright uçtan uca testler (çalışan PostgreSQL ister)
```

Docker ile:

```bash
docker build -t trip-planner ./web
docker run --rm --env-file .env trip-planner npx prisma migrate deploy
docker run -p 3000:3000 --env-file .env trip-planner
```

---

## Proje yapısı

```
Trip-Planner/
├── .github/workflows/ci.yml   # lint + typecheck + build
├── docs/                      # gereksinim analizi vb.
├── LICENSE
└── web/
    ├── prisma/
    │   ├── schema.prisma
    │   └── migrations/
    ├── src/
    │   ├── app/
    │   │   ├── api/           # route handler'lar
    │   │   ├── ai-planner/    # AI plan üretimi
    │   │   ├── manual-planner/
    │   │   ├── daily-planner/
    │   │   ├── budget/
    │   │   ├── map/           # Google Maps + POI
    │   │   ├── my-plans/  plan-detail/[id]/
    │   │   └── profile/
    │   ├── components/        # paylaşılan bileşenler
    │   ├── lib/
    │   │   ├── auth-session.ts        # requireUser() — tek kimlik giriş noktası
    │   │   ├── trip-ownership.ts      # Trip ve alt kayıt sahipliği
    │   │   ├── trip-dates.ts          # gün/gece sayısı (kapsayıcı)
    │   │   ├── plan-budget.ts         # butce_tahmini / gun_plani çözümleme + toplama
    │   │   ├── plan-generation.ts     # AI üretim zinciri (HTTP'den bağımsız)
    │   │   ├── plan-job.ts            # arka plan üretim işlerinin yaşam döngüsü
    │   │   ├── plan-migration.ts      # JSON → ilişkisel dönüşüm (saf)
    │   │   ├── plan-migration-runner.ts # dönüşümün veritabanı tarafı
    │   │   ├── plan-status-service.ts # durum geçişinin tek uygulaması
    │   │   ├── trip-status.ts         # durum enum'u, etiketler, geçiş kuralları
    │   │   └── logger, prisma, rate-limit, sanitize, openrouter, api-schemas
    │   ├── middleware.ts      # korumalı rotalar + nonce tabanlı CSP
    │   └── env.ts             # doğrulanmış ortam değişkenleri
    ├── tests/
    │   ├── *.test.ts          # saf fonksiyonlar ve şemalar
    │   ├── routes/            # route handler testleri (Prisma taklit ediliyor)
    │   └── helpers/           # sahte Prisma istemcisi ve istek yardımcıları
    ├── e2e/                   # Playwright uçtan uca testler
    ├── Dockerfile
    └── package.json
```

---

## API uçları

| Metot | Yol | Açıklama |
|---|---|---|
| `POST` | `/api/register` | Kullanıcı kaydı (IP başına saatte 5) |
| `*` | `/api/auth/[...nextauth]` | NextAuth (giriş/çıkış/oturum) |
| `POST` | `/api/trip-plan-model` | AI plan üretimini **başlatır** — 202 + `jobId` döner; giriş zorunlu, saatte 5 |
| `GET` | `/api/plan-jobs/[id]` | Üretim işinin durumu; bittiğinde planı da döner |
| `POST` | `/api/manual-travel-plan` | Manuel plan kaydı — **giriş zorunlu**, saatte 30 |
| `GET` | `/api/my-plans` | Kullanıcının planları |
| `DELETE` | `/api/my-plans/[id]` | Plan silme |
| `GET` | `/api/plan-detail/[id]` | Plan detayı |
| `PATCH` | `/api/plan-detail/[id]` | Bütçe güncelleme (toplamlar sunucuda hesaplanır) |
| `PUT` | `/api/plan-detail/[id]` | Günlük plan güncelleme (bütçeyi de senkronlar) |
| `PATCH` | `/api/trip-plans/[id]/status` | Plan durumu güncelleme |
| `GET` | `/api/my-trips`, `/api/my-trips/[id]` | Gerçekleşmiş geziler |
| `DELETE` | `/api/my-trips/[id]` | Gerçekleşmiş gezi silme |
| `GET/POST/PUT/DELETE` | `/api/trip` | Seyahat CRUD (ilişkisel model) |
| `GET/POST/PUT/DELETE` | `/api/trip/budget` | Bütçe kalemleri (ilişkisel model) |
| `GET` | `/api/trip/budget/[id]` | Tek bütçe kalemi |
| `GET/POST/PUT/DELETE` | `/api/trip/daily-plans` | Günlük planlar (ilişkisel model) |
| `GET/POST/PUT/DELETE` | `/api/trip/accommodations` | Konaklama kayıtları |
| `GET/POST/PUT/DELETE` | `/api/trip/transportations` | Ulaşım kayıtları |
| `GET/POST` | `/api/my-plans/migrate` | JSON planları ilişkisel modele taşır (GET = kuru çalışma) |
| `POST` | `/api/trip/apply-ai-data` | AI çıktısını ilişkisel modele yazma |
| `GET/POST` | `/api/conversation/save` | AI konuşma geçmişi |
| `GET` | `/api/profile` | Profil ve istatistikler |
| `PUT` | `/api/profile/update` | Profil güncelleme |
| `GET` | `/api/health` | Sağlık kontrolü |

Tüm veri uçları `requireUser()` ile oturum doğrulaması ve kayıt sahipliği kontrolü yapar
(`src/lib/auth-session.ts`). Kimlik **yalnızca oturumdan** çözülür; istek gövdesinden
gelen kullanıcı bilgisi hiçbir uçta okunmaz.

> **İki veri modeli, tek hedef.** `TripPlan` yapay zekânın ürettiği ham çıktının
> kaydı; `Trip` + `BudgetItem` + `DailyPlan` + `Accommodation` + `Transportation`
> ise ilişkisel hedef model. İlişkisel tarafın tam CRUD'u ve
> `POST /api/my-plans/migrate` ile taşıma yolu hazır. Arayüzün bu uçlara
> bağlanması yol haritasında.

---

## Yol haritası

Henüz yapılmamış, planlanan işler:

Tamamlananlar (Aşama 1–3):

- [x] `userEmail` sütunlarının düşürülmesi — sahiplik tek kaynak: `userId`
- [x] İlişkisel modelin tam CRUD'u (günlük plan, konaklama, ulaşım)
- [x] `TripPlan` JSON → ilişkisel taşıma yolu (`/api/my-plans/migrate`)
- [x] Yinelenen durum ucunun kaldırılması (tek kanonik uç)
- [x] Route handler testleri + her uç için yetkilendirme testi
- [x] Playwright uçtan uca testler ve veritabanlı CI işi
- [x] Plan üretiminin arka plana alınması (`PlanJob` + durum sorgulama)
- [x] Dağıtık rate limit (Upstash Redis; yoksa süreç-içi)
- [x] `/api/health`'in gerçek veritabanı yoklaması
- [x] Nonce tabanlı CSP (varsayılan rapor modu)
- [x] Dockerfile ve standalone çıktı

Kalanlar:

- [ ] Arayüzün ilişkisel uçlara bağlanması (bütçe ve günlük plan sayfaları)
- [ ] Şifre sıfırlama akışı ve e-posta doğrulama
- [ ] Çok dilli arayüz (i18n)
- [ ] Plan paylaşımı ve PDF çıktısı
- [ ] Gerçek POI / otel / uçuş entegrasyonu (manuel planlayıcı şu an sahte veri kullanıyor)
- [ ] Harita ile günlük planın birleştirilmesi (gün bazlı rota optimizasyonu)

---

## Katkıda bulunma

1. Fork edin
2. Feature branch açın (`git checkout -b feature/ozellik-adi`)
3. `npm run lint && npm run typecheck && npm run build` komutlarının geçtiğinden emin olun
4. Commit edip push edin
5. Pull request açın

---

## Lisans

[MIT](LICENSE)

## Geliştirici

**İbrahim Güldemir** — [@ibrhmgldmr3](https://github.com/ibrhmgldmr3)
