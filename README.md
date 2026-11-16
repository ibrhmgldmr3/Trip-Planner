# Trip Planner

Şehri ve tarihi söyle; gün gün gezi programın, haritada rotan ve bütçe tahminin hazır olsun.

Trip Planner; tarih, şehir, bütçe ve ilgi alanlarına göre seyahat planı oluşturan bir web uygulamasıdır. Plan ister yapay zekâya hazırlatılır, ister adım adım elle kurulur; iki yol da aynı yapıda kaydedilir.

## Özellikler

- **AI ile plan:** Şehir (ve isteğe bağlı tarih, bütçe, tarz, ilgi alanları) girilir; model gün gün duraklardan, şehir/yeme-içme/pratik bilgi rehberlerinden ve bütçe kalemlerinden oluşan yapılandırılmış bir plan döndürür.
- **Adım adım plan:** Ulaşım, konaklama, saatli aktiviteler ve bütçe altı adımda girilir; toplamlar sunucuda hesaplanır.
- **Keşfet:** Elle seçilmiş destinasyonlar tür, süre ve bölgeye göre süzülür; seçilen şehir AI planlayıcıya taşınır.
- **Şehir fotoğrafları:** Plan ve destinasyon kartlarında şehrin Wikipedia madde görseli gösterilir; bulunamazsa renk geçişine dönülür.
- **Harita:** Konumu bilinen duraklar OpenStreetMap üzerinde gün gün gösterilir; duraklar ziyaret sırasıyla yol ağı üzerinden bağlanır, günün toplam mesafesi ve süresi yazılır.
- **Bütçe takibi:** Planın tahmini bütçe kabul edilir; gerçek harcamalar eklenip ödendi olarak işaretlenir.
- **Plan durumları:** Planlandı → yolda → tarihi geçti (tarihten hesaplanır); iptal edildi / gerçekleşti (kullanıcı işaretler). Gerçekleşen planlar gezi defterinde toplanır.
- **Hesap:** E-posta/şifre ile giriş, isteğe bağlı Google ile giriş, seyahat tercihleri.
- Aydınlık/karanlık tema, mobil uyumlu arayüz.

## Teknolojiler

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Prisma 6 + PostgreSQL · NextAuth 4 · Zod 4 · Leaflet · Vitest

Dış servisler: [OpenRouter](https://openrouter.ai/) (dil modeli), [Nominatim](https://nominatim.org/) (şehir koordinatı), OpenStreetMap (harita karoları), [routing.openstreetmap.de](https://routing.openstreetmap.de/) (duraklar arası rota), Wikipedia (şehir kapak fotoğrafları).

## Kurulum

Gereksinimler: Node.js 20+, PostgreSQL (ya da Docker).

```bash
git clone https://github.com/ibrhmgldmr3/Trip-Planner.git
cd Trip-Planner/web
npm install

cp .env.example .env          # değerleri doldurun (aşağıya bakın)
docker compose up -d          # yerel PostgreSQL (kendi veritabanınız varsa atlayın)

npx prisma generate
npm run db:migrate            # tabloları oluşturur
npm run db:seed               # isteğe bağlı: demo kullanıcı ve örnek planlar
npm run dev                   # http://localhost:3000
```

### Ortam değişkenleri

| Değişken | Zorunlu | Açıklama |
| --- | --- | --- |
| `DATABASE_URL` | evet | PostgreSQL bağlantı adresi |
| `NEXTAUTH_SECRET` | evet | Oturum imzalama anahtarı (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | yayında | Uygulamanın adresi |
| `OPENROUTER_API_KEY` | hayır | Yoksa yalnızca "AI ile planla" kapalı olur |
| `OPENROUTER_MODEL` | hayır | Kullanılacak model; JSON çıktıyı güvenilir üreten bir model seçin |
| `OPENROUTER_BASE_URL` | hayır | OpenAI uyumlu başka bir uç kullanmak için |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | hayır | İkisi de tanımlıysa Google ile giriş açılır |
| `GEOCODER_USER_AGENT` | yayında | Nominatim ve Wikipedia isteklerinde gönderilen User-Agent |

### Komutlar

| Komut | İşlev |
| --- | --- |
| `npm run dev` / `build` / `start` | Geliştirme sunucusu / üretim derlemesi / üretim sunucusu |
| `npm test` | Birim testleri (Vitest) |
| `npm run typecheck` | TypeScript denetimi |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Bekleyen migration'ları uygular |
| `npm run db:seed` | Demo kullanıcı ve örnek planları yükler (üretimde çalışmaz) |

## Proje yapısı

```
web/
├── prisma/
│   ├── schema.prisma        # Plan, PlanDay, PlanStop, BudgetLine, GeoCache + NextAuth tabloları
│   ├── migrations/
│   └── seed.mjs
└── src/
    ├── app/                 # Sayfalar ve API rotaları
    │   ├── api/
    │   ├── ai-planner/      # AI ile planla
    │   ├── manual-planner/  # Adım adım planla
    │   ├── explore/         # Keşfet
    │   ├── plan-detail/[id] # Plan: kapak, günlük plan + harita, bütçe
    │   └── (panel)/         # Yan menülü hesap sayfaları
    │       ├── my-plans/    # Planlarım
    │       ├── my-trips/    # Gezi defteri
    │       ├── budget/      # Harcama takibi
    │       └── profile/
    ├── components/          # Arayüz bileşenleri (PlanMap, CityCover, Markdown…)
    ├── lib/                 # İstemci ve sunucunun ortak kullandığı saf yardımcılar
    └── server/              # Yalnızca sunucu: auth, doğrulama, plan servisi, AI, konum
```

## API

Tüm uçlar (kayıt ve sağlık denetimi dışında) oturum ister; bir kullanıcı yalnızca kendi planlarına erişebilir. Hatalar `{ "error": "mesaj" }` biçiminde döner.

| Yöntem ve yol | İşlev |
| --- | --- |
| `GET /api/plans` | Planları listeler (`?status=PLANNED\|CANCELLED\|DONE`) |
| `POST /api/plans` | Manuel plan kaydeder |
| `POST /api/plans/generate` | AI ile plan üretir ve kaydeder (saatte 10 plan, en fazla 14 gün) |
| `GET /api/plans/:id` | Plan ayrıntısı: günler, duraklar, tahminler, harcamalar |
| `PATCH /api/plans/:id` | Durumu değiştirir (`{ "status": ... }`) |
| `DELETE /api/plans/:id` | Planı siler |
| `POST /api/plans/:id/expenses` | Harcama ekler |
| `PATCH` / `DELETE /api/plans/:id/expenses/:expenseId` | Harcamayı günceller / siler |
| `GET` / `PUT /api/profile` | Profil ve tercihleri okur / günceller |
| `POST /api/register` | Hesap oluşturur |
| `GET /api/covers?city=` | Şehrin kapak fotoğrafı (oturum istemez, önbellekli) |
| `GET /api/health` | Uygulama ve veritabanı durumu |

## Bilinen sınırlar

- **Durak konumları dil modelinden gelir.** Şehir merkezine 80 km'den uzak ya da geçersiz koordinatlar atılır, ama kalanlar da yaklaşık olabilir.
- **Rota herkese açık bir OSRM sunucusundan gelir.** İstek tarayıcıdan gider ve yalnızca durak koordinatlarını içerir. Durakların sırası değiştirilmez; günün durakları kuş uçuşu 5 km'yi geçmiyorsa yürüyüş, geçiyorsa araç rotası hesaplanır. Sunucu yanıt vermezse harita duraklar arasında kesikli düz çizgi gösterir. Yoğun kullanımda kendi OSRM sunucunuza geçin (`src/lib/route.ts`).
- **Şehir fotoğrafları Wikipedia'dan gelir.** Maddenin ana görseli kullanılır; uygun fotoğraf yoksa ya da Wikimedia hız sınırı devredeyse kart renk geçişiyle gösterilir. Wikimedia, kendini tanıtmayan istemcileri sıkı sınırlar: yayında `GEOCODER_USER_AGENT` değerine iletişim bilgisi ekleyin.
- **Fiyatlar tahmindir.** Gerçek uçuş/otobüs ve konaklama fiyatı sorgulanmaz.
- **Hız sınırı bellek içidir.** Giriş ve kayıt denemeleri tek sunucu örneğinde sayılır; birden çok örnekle yayına alınacaksa `src/server/rate-limit.ts` ortak bir depoya (ör. Redis) bağlanmalıdır. Saatlik AI plan kotası veritabanından sayılır ve bundan etkilenmez; başarısız AI denemeleri ile manuel plan sınırı ise bellektedir.
- **İstemci IP'si `x-forwarded-for` başlığının son değerinden okunur** (uygulamanın önündeki vekilin eklediği değer). Tek vekil (nginx, Vercel) için doğrudur; art arda iki vekil varsa `clientIp` işlevini vekil sayısına göre uyarlayın. Vekilsiz, doğrudan internete açık çalıştırmayın: başlığı istemci yazabilir.
- **AI üretimi tek istekte tamamlanır** ve bir-iki dakika sürebilir; barındırma platformunun istek süresi sınırı buna izin vermelidir.

## Yayına alma notları

- Veritabanında `npm run db:migrate` çalıştırın. `20261112120000_unify_plan_model` migration'ı eski `Trip`/`TripPlan` tablolarını tek `Plan` modeline taşır ve eski tabloları siler; gerçek veri içeren bir veritabanında önce yedek alın.
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL` ve `GEOCODER_USER_AGENT` değerlerini ortamınıza göre ayarlayın.

## Geliştirici

**İbrahim Güldemir** — [@ibrhmgldmr3](https://github.com/ibrhmgldmr3)
