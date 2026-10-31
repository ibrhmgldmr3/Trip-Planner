import { afterAll, beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  EPOSTA_DOGRULAMA_OMRU_MS,
  JETON_AMACLARI,
  SIFRE_SIFIRLAMA_OMRU_MS,
  jetonOlustur,
  jetonOzeti,
  jetonuTuket,
} from "@/lib/dogrulama-jetonu";

/**
 * HESAP YAŞAM DÖNGÜSÜ — GERÇEK VERİTABANINA karşı (B9).
 *
 * Sahte istemci `@@unique([identifier, token])` kısıtını ve `token`
 * sütunundaki benzersiz indeksi taklit ETMİYOR. Jeton mantığının tamamı bu
 * indekslere dayanıyor:
 *  - Aynı jeton iki kez yazılamamalı.
 *  - `findUnique({ where: { token } })` gerçekten benzersiz bir sütuna
 *    vurmalı — değilse Prisma çalışma zamanında hata verir ve bunu ancak
 *    üretimde görürüz.
 *
 * Ayrıca cascade silme burada sınanıyor: hesap silme "her şeyi siler"
 * sözünü veriyor ve bunu tutan şey şemadaki `onDelete: Cascade` zinciri.
 */

const AD = "b9-canli";
const EPOSTA = `${AD}@ornek.test`;
const ESKI_SIFRE = "EskiSifre123";

const veritabaniVar = Boolean(process.env.DATABASE_URL);

describe.skipIf(!veritabaniVar)("B9 — canlı", () => {
  let kullaniciId = "";

  beforeAll(async () => {
    await temizle();

    const kullanici = await prisma.user.create({
      data: {
        email: EPOSTA,
        name: "B9 Doğrulama",
        password: await bcrypt.hash(ESKI_SIFRE, 4),
      },
    });

    kullaniciId = kullanici.id;
  });

  afterAll(async () => {
    await temizle();
    await prisma.$disconnect();
  });

  it("jeton HAM hâliyle veritabanında durmuyor", async () => {
    const ham = await jetonOlustur(
      JETON_AMACLARI.sifreSifirlama,
      EPOSTA,
      SIFRE_SIFIRLAMA_OMRU_MS
    );

    const satir = await prisma.verificationToken.findUnique({
      where: { token: jetonOzeti(ham) },
    });

    expect(satir).not.toBeNull();
    expect(satir!.identifier).toBe(`sifre-sifirlama:${EPOSTA}`);

    // Ham değerle arama HİÇBİR ŞEY bulmamalı.
    const hamAramasi = await prisma.verificationToken.findUnique({
      where: { token: ham },
    });
    expect(hamAramasi).toBeNull();
  });

  it("aynı amaç için ikinci jeton birincisini siliyor", async () => {
    const ilk = await jetonOlustur(
      JETON_AMACLARI.sifreSifirlama,
      EPOSTA,
      SIFRE_SIFIRLAMA_OMRU_MS
    );
    await jetonOlustur(JETON_AMACLARI.sifreSifirlama, EPOSTA, SIFRE_SIFIRLAMA_OMRU_MS);

    expect(await jetonuTuket(JETON_AMACLARI.sifreSifirlama, ilk)).toBeNull();
  });

  it("iki akışın jetonları YAN YANA yaşayabiliyor", async () => {
    // `@@unique([identifier, token])` kısıtı ikisini ayırt edebilmeli.
    const sifirlama = await jetonOlustur(
      JETON_AMACLARI.sifreSifirlama,
      EPOSTA,
      SIFRE_SIFIRLAMA_OMRU_MS
    );
    const dogrulama = await jetonOlustur(
      JETON_AMACLARI.epostaDogrulama,
      EPOSTA,
      EPOSTA_DOGRULAMA_OMRU_MS
    );

    const sayi = await prisma.verificationToken.count({
      where: { identifier: { in: [`sifre-sifirlama:${EPOSTA}`, `eposta-dogrulama:${EPOSTA}`] } },
    });
    expect(sayi).toBe(2);

    // Ve birbirinin yerine geçemiyorlar.
    expect(await jetonuTuket(JETON_AMACLARI.sifreSifirlama, dogrulama)).toBeNull();
    expect(await jetonuTuket(JETON_AMACLARI.epostaDogrulama, sifirlama)).toBeNull();
  });

  it("tüketilen jeton veritabanından SİLİNİYOR", async () => {
    const ham = await jetonOlustur(
      JETON_AMACLARI.sifreSifirlama,
      EPOSTA,
      SIFRE_SIFIRLAMA_OMRU_MS
    );

    expect(await jetonuTuket(JETON_AMACLARI.sifreSifirlama, ham)).toBe(EPOSTA);

    const kalan = await prisma.verificationToken.findUnique({
      where: { token: jetonOzeti(ham) },
    });
    expect(kalan).toBeNull();
  });

  it("hesap silme TÜM bağlı kayıtları götürüyor", async () => {
    // "Hesabımı sil" gerçekten her şeyi silmeli; bunu tutan şey şemadaki
    // cascade zinciri, kod değil.
    const gezi = await prisma.trip.create({
      data: {
        userId: kullaniciId,
        title: "Silinecek gezi",
        city: "Roma",
        startDate: new Date(Date.UTC(2026, 10, 2)),
        endDate: new Date(Date.UTC(2026, 10, 4)),
      },
    });

    await prisma.budgetItem.create({
      data: { tripId: gezi.id, category: "ulaşım", description: "Uçak", amount: 4000 },
    });

    await prisma.dailyPlan.create({
      data: { tripId: gezi.id, date: new Date(Date.UTC(2026, 10, 2)), activities: [] },
    });

    const plan = await prisma.tripPlan.create({
      data: { userId: kullaniciId, city: "Roma", tripId: gezi.id },
    });

    await prisma.user.delete({ where: { id: kullaniciId } });

    expect(await prisma.trip.findUnique({ where: { id: gezi.id } })).toBeNull();
    expect(await prisma.tripPlan.findUnique({ where: { id: plan.id } })).toBeNull();
    expect(await prisma.budgetItem.count({ where: { tripId: gezi.id } })).toBe(0);
    expect(await prisma.dailyPlan.count({ where: { tripId: gezi.id } })).toBe(0);
  });
});

/** Testin kendi satırlarını siler; mevcut verilere DOKUNMAZ. */
async function temizle() {
  await prisma.verificationToken.deleteMany({
    where: { identifier: { contains: EPOSTA } },
  });
  await prisma.user.deleteMany({ where: { email: EPOSTA } });
}
