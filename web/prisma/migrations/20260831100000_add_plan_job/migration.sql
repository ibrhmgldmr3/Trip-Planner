-- Aşama 3 — Plan üretimini istek-yanıt döngüsünden çıkarma.
--
-- Plan üretimi en kötü durumda 8 ardışık LLM çağrısı yapıyor ve 240 saniyeye
-- kadar sürebiliyor. Bu süre boyunca bir HTTP bağlantısını açık tutmak bir
-- zaman aşımı ayarı meselesi değil, mimari bir sınırdı: kullanıcı sekmeyi
-- kapattığında iş de yarıda kalıyordu.
--
-- `PlanJob` üretimi kalıcı bir kayda bağlıyor; istek hemen dönüyor ve
-- istemci durumu sorguluyor.

CREATE TYPE "PlanJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "PlanJob" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "status"     "PlanJobStatus" NOT NULL DEFAULT 'QUEUED',
    -- Doğrulanmış istek gövdesi; yeniden deneme buradan besleniyor.
    "request"    JSONB NOT NULL,
    "tripPlanId" TEXT,
    "error"      TEXT,
    "step"       TEXT,
    "startedAt"  TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanJob_pkey" PRIMARY KEY ("id")
);

-- Kullanıcının son işleri (durum sorgulama ve "devam eden iş var mı"
-- kontrolü bu indeksi kullanıyor).
CREATE INDEX "PlanJob_userId_createdAt_idx" ON "PlanJob" ("userId", "createdAt");

-- Asılı kalmış işleri toplamak için (RUNNING ama startedAt çok eski).
CREATE INDEX "PlanJob_status_idx" ON "PlanJob" ("status");

ALTER TABLE "PlanJob"
  ADD CONSTRAINT "PlanJob_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
