-- Şehir kapak fotoğrafı önbelleği
CREATE TABLE "CityCover" (
    "query" TEXT NOT NULL,
    "imageUrl" TEXT,
    "pageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CityCover_pkey" PRIMARY KEY ("query")
);
