# 🌍 Trip Planner - AI Destekli Seyahat Planlama Platformu

<div align="center">

![Trip Planner Logo](https://img.shields.io/badge/Trip-Planner-blue?style=for-the-badge&logo=airplane&logoColor=white)

**Modern teknoloji ile seyahat deneyiminizi bir üst seviyeye taşıyın!**

[![Next.js](https://img.shields.io/badge/Next.js-15.5.2-000000?style=flat&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.1.1-61DAFB?style=flat&logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.15.0-2D3748?style=flat&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![NextAuth.js](https://img.shields.io/badge/NextAuth.js-Latest-purple?style=flat&logo=next.js&logoColor=white)](https://next-auth.js.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

[🚀 Demo](#demo) • [📋 Özellikler](#özellikler) • [🛠️ Kurulum](#kurulum) • [📖 Kullanım](#kullanım) • [🤝 Katkıda Bulunma](#katkıda-bulunma)

</div>

---

## 🎯 Proje Hakkında

**Trip Planner**, modern web teknolojileri ve yapay zeka desteği ile geliştirilmiş kapsamlı bir seyahat planlama platformudur. Kullanıcıların hayallerindeki seyahatleri kolayca planlamalarından, bütçe yönetimlerine kadar her aşamada yanlarında olan akıllı bir asistanıdır.

### ✨ Neden Trip Planner?

- 🤖 **AI Destekli Planlama**: Gelişmiş yapay zeka algoritmaları ile kişiselleştirilmiş seyahat önerileri
- 💰 **Akıllı Bütçe Yönetimi**: Detaylı bütçe takibi ve kategori bazlı harcama analizi
- 📱 **Responsive Tasarım**: Her cihazda mükemmel kullanıcı deneyimi
- 🔒 **Güvenli Authentication**: NextAuth.js ile güvenli kullanıcı yönetimi
- 🌙 **Dark Mode Desteği**: Göz dostu karanlık tema seçeneği

---

## 📋 Özellikler

### 🎯 Seyahat Planlama
- **AI Destekli Plan Oluşturma**: Destinasyon, tarih ve bütçe tercihleri ile otomatik plan üretimi
- **Manuel Plan Editörü**: Detaylı özelleştirme imkanları
- **Çoklu Seyahat Tarzı**: Backpacker, konforlu, lüks seyahat seçenekleri
- **Günlük İtinerarylar**: Saatlik aktivite planlaması

### 💳 Bütçe Yönetimi
- **Kategorik Harcama Takibi**: Ulaşım, konaklama, yemek, aktiviteler
- **Gerçek Zamanlı Bütçe Analizi**: Harcama oranları ve kalan bütçe
- **Günlük Bütçe Hesaplaması**: Gün başına ortalama harcama limitleri
- **Ödeme Durumu Takibi**: Ödenen/ödenmemiş kalemlerin takibi

### 📊 Plan Yönetimi
- **Dinamik Plan Durumları**: Planlanan, Aktif, Tamamlanan, İptal Edilmiş
- **Plan Geçmişi**: Tüm seyahatlerin detaylı kayıtları
- **Markdown Desteği**: Esnek plan formatları
- **Çoklu Plan Yönetimi**: Aynı anda birden fazla seyahat planı

### 🔐 Kullanıcı Deneyimi
- **Güvenli Giriş Sistemi**: E-posta/şifre ile authentication
- **Kişiselleştirilmiş Dashboard**: Kullanıcıya özel içerik
- **Responsive Tasarım**: Mobil, tablet ve masaüstü uyumluluğu
- **Çok Dilli Destek**: Türkçe ve İngilizce arayüz

---

## 🛠️ Teknoloji Stack'i

### Frontend
- **Next.js 15.5.2**: Server-side rendering ve routing
- **React 19.1.1**: Modern component-based UI
- **TypeScript**: Type-safe development
- **TailwindCSS**: Utility-first CSS framework
- **React Hot Toast**: Kullanıcı bildirimleri

### Backend & Database
- **Next.js API Routes**: RESTful API endpoints
- **Prisma 6.15.0**: Type-safe database ORM
- **SQLite**: Lightweight database solution
- **NextAuth.js**: Authentication ve session yönetimi

### AI & External Services
- **OpenRouter API**: AI-powered trip planning
- **Advanced LLM Integration**: Gemini Flash model desteği

### Development Tools
- **ESLint**: Code quality assurance
- **PostCSS**: CSS processing
- **Git**: Version control
- **VS Code**: Optimized development environment

---

## 🚀 Kurulum

### Gereksinimler
- Node.js 18+ 
- npm veya yarn
- Git

### Adım Adım Kurulum

1. **Repository'yi klonlayın**
```bash
git clone https://github.com/ibrhmgldmr3/Trip-Planner.git
cd Trip-Planner/web
```

2. **Bağımlılıkları yükleyin**
```bash
npm install
# veya
yarn install
```

3. **Environment değişkenlerini ayarlayın**
```bash
cp .env.example .env.local
```

`.env.local` dosyasını düzenleyin:
```env
# Database
DATABASE_URL="file:./dev.db"

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret"

# OpenRouter AI API
OPENROUTER_API_KEY="your-openrouter-api-key"
```

4. **Veritabanını hazırlayın**
```bash
npx prisma migrate dev
npx prisma generate
```

5. **Geliştirme sunucusunu başlatın**
```bash
npm run dev
# veya
yarn dev
```

6. **Uygulamayı açın**
Tarayıcınızda [http://localhost:3000](http://localhost:3000) adresini ziyaret edin.

---

## 📖 Kullanım

### 🎯 İlk Adımlar

1. **Hesap Oluşturma**: Ana sayfadan "Kayıt Ol" butonuna tıklayın
2. **Giriş Yapma**: E-posta ve şifreniz ile giriş yapın
3. **İlk Planınız**: "Yeni Plan Oluştur" ile seyahat planlamanıza başlayın

### 🤖 AI Destekli Planlama

```typescript
// AI Planlama Parametreleri
{
  destination: "İstanbul, Türkiye",
  startDate: "2025-06-15",
  endDate: "2025-06-20",
  budget: 5000,
  travelStyle: "comfort",
  interests: ["tarih", "yemek", "kültür"]
}
```

### 💰 Bütçe Yönetimi

```typescript
// Bütçe Kategorileri
const categories = {
  ulaşım: "🚗 Ulaşım",
  konaklama: "🏨 Konaklama", 
  yemek: "🍽️ Yemek",
  aktiviteler: "🎯 Aktiviteler",
  alışveriş: "🛍️ Alışveriş",
  eğlence: "🎉 Eğlence"
}
```

---

## 🏗️ Proje Yapısı

```
trip-planner/
├── web/
│   ├── src/
│   │   ├── app/                  # Next.js App Router
│   │   │   ├── api/             # API routes
│   │   │   ├── ai-planner/      # AI seyahat planlayıcı
│   │   │   ├── budget/          # Bütçe yönetimi
│   │   │   ├── my-plans/        # Plan listesi
│   │   │   ├── profile/         # Kullanıcı profili
│   │   │   └── auth/            # Authentication
│   │   ├── components/          # Reusable components
│   │   ├── lib/                 # Utility functions
│   │   ├── types/               # TypeScript types
│   │   └── styles/              # Global styles
│   ├── prisma/                  # Database schema
│   ├── public/                  # Static assets
│   └── package.json
└── README.md
```

---

## 🔧 API Endpoints

### 🔐 Authentication
```
POST /api/auth/signin          # Kullanıcı girişi
POST /api/auth/signup          # Kullanıcı kaydı
POST /api/auth/signout         # Çıkış yapma
```

### 📋 Plan Management
```
GET    /api/my-plans           # Kullanıcı planları
GET    /api/plan-detail/[id]   # Plan detayları
POST   /api/create-plan        # Yeni plan oluşturma
PUT    /api/trip-plans/[id]/status  # Plan durumu güncelleme
```

### 🤖 AI Services
```
POST   /api/ai-trip-planner    # AI destekli plan oluşturma
POST   /api/generate-itinerary # Günlük itinerary oluşturma
```

---

## 🧪 Test Etme

```bash
# Unit testler
npm run test

# E2E testler
npm run test:e2e

# Coverage raporu
npm run test:coverage
```

---

## 🚀 Deployment

### Vercel (Önerilen)
```bash
# Vercel CLI ile deploy
npm i -g vercel
vercel --prod
```

### Docker
```bash
# Docker image oluşturma
docker build -t trip-planner .

# Container çalıştırma
docker run -p 3000:3000 trip-planner
```

---

## 🤝 Katkıda Bulunma

Projeye katkıda bulunmak isterseniz:

1. **Fork** edin
2. **Feature branch** oluşturun (`git checkout -b feature/amazing-feature`)
3. **Commit** edin (`git commit -m 'Add amazing feature'`)
4. **Push** edin (`git push origin feature/amazing-feature`)
5. **Pull Request** açın

### 📝 Katkı Kuralları
- TypeScript ve ESLint kurallarına uyun
- Anlamlı commit mesajları yazın
- Kod değişikliklerinizi test edin
- Documentation güncellemelerini dahil edin

---

## 📝 License

Bu proje [MIT License](LICENSE) altında lisanslanmıştır.

---

## 👨‍💻 Geliştirici

**İbrahim Güldemir**
- GitHub: [@ibrhmgldmr3](https://github.com/ibrhmgldmr3)
- Email: ibrahimguldemir123@gmail.com

---

## 🙏 Teşekkürler

- [Next.js](https://nextjs.org/) - React framework
- [Prisma](https://www.prisma.io/) - Database toolkit
- [TailwindCSS](https://tailwindcss.com/) - CSS framework
- [OpenRouter](https://openrouter.ai/) - AI API services
- [Vercel](https://vercel.com/) - Deployment platform

---

## 📈 Proje İstatistikleri

![GitHub stars](https://img.shields.io/github/stars/ibrhmgldmr3/Trip-Planner?style=social)
![GitHub forks](https://img.shields.io/github/forks/ibrhmgldmr3/Trip-Planner?style=social)
![GitHub issues](https://img.shields.io/github/issues/ibrhmgldmr3/Trip-Planner)
![GitHub pull requests](https://img.shields.io/github/issues-pr/ibrhmgldmr3/Trip-Planner)

---

<div align="center">

**🌟 Projeyi beğendiyseniz star vermeyi unutmayın! 🌟**

Made with ❤️ in Turkey 🇹🇷

</div>
