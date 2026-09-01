# syntax=docker/dockerfile:1
#
# Trip Planner — üretim imajı.
#
# Üç aşamalı: bağımlılıklar, derleme, çalıştırma. Amaç son imajda yalnızca
# çalışmak için gerekenin bulunması; kaynak kod, dev bağımlılıkları ve npm
# önbelleği dışarıda kalıyor.
#
# `next.config.ts` içinde `output: "standalone"` açık: Next derlemeden sonra
# gerçekten kullanılan node_modules dosyalarını tek bir klasöre topluyor.
#
# KULLANIM
#   docker build -t trip-planner ./web
#   docker run -p 3000:3000 --env-file .env.production trip-planner

# ---------------------------------------------------------------------------
# 1. Bağımlılıklar
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app

# Prisma'nın Alpine üzerinde ihtiyaç duyduğu OpenSSL.
RUN apk add --no-cache libc6-compat openssl

# Yalnızca manifest'ler kopyalanıyor: kaynak değiştiğinde bu katman
# önbellekten geliyor.
COPY package.json package-lock.json ./
COPY prisma ./prisma

# `npm ci` postinstall'da `prisma generate` çalıştırıyor; şema bu yüzden
# bu adımdan ÖNCE kopyalanmak zorunda.
RUN npm ci

# ---------------------------------------------------------------------------
# 2. Derleme
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build sırasında gerçek servise bağlanılmıyor; env doğrulaması için
# sözdizimsel olarak geçerli yer tutucular yeterli. Gerçek değerler
# çalışma zamanında veriliyor.
#
# NOT: `NEXT_PUBLIC_*` değişkenleri bundle'a GÖMÜLÜR. Google Maps anahtarını
# imaja gerçek değeriyle koymak istiyorsanız build-arg olarak geçin;
# aksi halde harita çalışmaz.
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=""
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV NEXTAUTH_SECRET="build-placeholder"
ENV OPENROUTER_API_KEY="build-placeholder"
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---------------------------------------------------------------------------
# 3. Çalıştırma
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Root olarak çalıştırmıyoruz.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# standalone çıktısı sunucuyu ve gereken node_modules'ü içeriyor.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Migration'ları konteynerden çalıştırabilmek için Prisma CLI ve şema.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

USER nextjs

EXPOSE 3000

# Uygulamanın kendi sağlık ucunu kullanıyor: veritabanına erişemeyen bir
# konteyner "sağlıklı" görünmesin.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# DİKKAT: migration'lar imaj başlarken OTOMATİK uygulanmıyor. Birden çok
# replika aynı anda migration çalıştırırsa yarışır. Dağıtım akışında ayrı
# bir adım olarak çalıştırın:
#   docker run --rm --env-file .env trip-planner npx prisma migrate deploy
CMD ["node", "server.js"]
