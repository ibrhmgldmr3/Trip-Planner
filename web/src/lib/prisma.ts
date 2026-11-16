import { PrismaClient } from "@prisma/client";

// Geliştirmede sıcak yeniden yükleme her seferinde yeni bağlantı havuzu açmasın diye
// tek örnek globalde tutulur. Tüm sunucu kodu bu örneği kullanır.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
