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

**Plan yönetimi**
- Plan durumları: `PLANNED`, `ACTIVE`, `COMPLETED`, `CANCELLED`, `DONE`
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
    │   ├── lib/               # logger, prisma, rate-limit, sanitize, trip-status
    │   ├── middleware.ts      # korumalı rotalar
    │   └── env.ts             # doğrulanmış ortam değişkenleri
    └── package.json
```

---

## API uçları

| Metot | Yol | Açıklama |
|---|---|---|
| `POST` | `/api/register` | Kullanıcı kaydı (IP başına saatte 5) |
| `*` | `/api/auth/[...nextauth]` | NextAuth (giriş/çıkış/oturum) |
| `POST` | `/api/trip-plan-model` | AI plan üretimi — **giriş zorunlu**, kullanıcı başına saatte 5 |
| `POST` | `/api/manual-travel-plan` | Manuel plan kaydı |
| `GET` | `/api/my-plans` | Kullanıcının AI planları |
| `DELETE` | `/api/my-plans/[id]` | Plan silme |
| `GET` | `/api/plan-detail/[id]` | Plan detayı |
| `PATCH` | `/api/trip-plans/[id]/status` | Plan durumu güncelleme |
| `GET/POST/PUT/DELETE` | `/api/trip` | Seyahat CRUD |
| `GET/POST/PUT/DELETE` | `/api/trip/budget` | Bütçe kalemleri |
| `GET/POST` | `/api/trip/daily-plans` | Günlük planlar |
| `GET/POST` | `/api/trip/accommodations` | Konaklama kayıtları |
| `GET/POST` | `/api/trip/transportations` | Ulaşım kayıtları |
| `GET/PUT` | `/api/profile`, `/api/profile/update` | Profil |
| `GET` | `/api/health` | Sağlık kontrolü |

Tüm veri uçları oturum doğrulaması ve kayıt sahipliği kontrolü yapar.

---

## Yol haritası

Henüz yapılmamış, planlanan işler:

- [ ] Otomatik test altyapısı (Vitest birim testleri + Playwright e2e)
- [ ] LLM çıktısının yapılandırılmış JSON olarak alınması (şu an markdown ayrıştırılıyor)
- [ ] `TripPlan` sahipliğinin tek bir `userId` alanına indirgenmesi (`userEmail` ikilemi)
- [ ] Şifre sıfırlama akışı ve e-posta doğrulama
- [ ] Tema seçici (arayüz şu an tek temaya sabit)
- [ ] `/terms` ve `/privacy` sayfaları
- [ ] Çok dilli arayüz (i18n)
- [ ] Plan paylaşımı ve PDF çıktısı
- [ ] Dağıtık rate limit (mevcut limiter süreç-içi, tek instance varsayar)
- [ ] Docker ile dağıtım

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
