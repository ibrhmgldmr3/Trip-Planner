/**
 * Bellekte çalışan sahte Prisma istemcisi.
 *
 * NEDEN VAR: denetimde bulunan en ciddi hata, sahiplik filtresinin SESSİZCE
 * DÜŞMESİYDİ — rotalar `where: { id, userId: undefined }` yazıyordu ve
 * Prisma'da `undefined` "filtre verilmedi" demek olduğu için koşul tamamen
 * kalkıyordu. Böyle bir hatayı yakalayabilen tek test, sorgunun kendisini
 * çalıştıran testtir.
 *
 * Bu yüzden sahte istemci Prisma'nın İKİ KRİTİK SEMANTİĞİNİ birebir taklit
 * ediyor:
 *
 *   1. `undefined` bir alan = o alan için filtre YOK (kayıt yine döner).
 *   2. `null` bir alan = o alanın null olması ŞARTI (filtre uygulanır).
 *
 * (1)'i yanlış modellemek testin yanlış sebeple geçmesine yol açardı:
 * filtreyi unutmuş bir rota "kayıt bulunamadı" alır, test yeşil görünür ve
 * asıl açık gizlenirdi.
 *
 * Kapsam bilinçli olarak dar: yalnızca rotaların kullandığı işlemler ve
 * üst seviye skaler eşitlik / `not` / aralık filtreleri destekleniyor.
 * Karmaşık sorgular buraya değil, entegrasyon testine aittir.
 */

export type Kayit = Record<string, unknown>;

/** Prisma'nın desteklediği filtrelerden burada karşılanan alt küme. */
type AlanFiltresi =
  | { equals?: unknown; not?: unknown; in?: unknown[]; gte?: unknown; lte?: unknown; gt?: unknown; lt?: unknown }
  | unknown;

function karsilastirilabilir(value: unknown): number | string {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" || typeof value === "string") return value;
  return String(value);
}

function esitMi(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Date || b instanceof Date) {
    return karsilastirilabilir(a) === karsilastirilabilir(b);
  }
  return a === b;
}

/** Tek bir alanın filtreyi karşılayıp karşılamadığı. */
function alanEslesiyorMu(deger: unknown, filtre: AlanFiltresi): boolean {
  // PRISMA SEMANTİĞİ: undefined = filtre yok. Buranın değişmesi, denetimde
  // bulunan sahiplik açığını gizleyen bir teste yol açar.
  if (filtre === undefined) return true;

  if (filtre === null) return deger === null || deger === undefined;

  if (filtre instanceof Date) return esitMi(deger, filtre);

  if (typeof filtre === "object") {
    const f = filtre as Record<string, unknown>;

    if ("equals" in f && !esitMi(deger, f.equals)) return false;
    if ("not" in f) {
      // `{ not: null }` = alan dolu olmalı.
      if (f.not === null) {
        if (deger === null || deger === undefined) return false;
      } else if (esitMi(deger, f.not)) {
        return false;
      }
    }
    if ("in" in f && Array.isArray(f.in)) {
      if (!f.in.some((aday) => esitMi(deger, aday))) return false;
    }
    if ("gte" in f && karsilastirilabilir(deger) < karsilastirilabilir(f.gte)) return false;
    if ("lte" in f && karsilastirilabilir(deger) > karsilastirilabilir(f.lte)) return false;
    if ("gt" in f && karsilastirilabilir(deger) <= karsilastirilabilir(f.gt)) return false;
    if ("lt" in f && karsilastirilabilir(deger) >= karsilastirilabilir(f.lt)) return false;

    return true;
  }

  return esitMi(deger, filtre);
}

function kayitEslesiyorMu(kayit: Kayit, where: Kayit | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([alan, filtre]) =>
    alanEslesiyorMu(kayit[alan], filtre)
  );
}

function sirala(kayitlar: Kayit[], orderBy: unknown): Kayit[] {
  if (!orderBy) return kayitlar;

  const kurallar = Array.isArray(orderBy) ? orderBy : [orderBy];
  const kopya = [...kayitlar];

  kopya.sort((a, b) => {
    for (const kural of kurallar) {
      for (const [alan, yon] of Object.entries(kural as Record<string, string>)) {
        const av = karsilastirilabilir(a[alan]);
        const bv = karsilastirilabilir(b[alan]);
        if (av === bv) continue;
        const fark = av < bv ? -1 : 1;
        return yon === "desc" ? -fark : fark;
      }
    }
    return 0;
  });

  return kopya;
}

let sayac = 0;
function yeniId(tablo: string): string {
  sayac += 1;
  return `${tablo}-${sayac}`;
}

/** Tek bir tablo. */
class SahteTablo {
  constructor(
    readonly ad: string,
    public kayitlar: Kayit[],
    private readonly tekilAlanlar: string[][]
  ) {}

  private tekilIhlali(aday: Kayit, hariçId?: string): boolean {
    return this.tekilAlanlar.some((alanlar) =>
      this.kayitlar.some(
        (mevcut) =>
          mevcut.id !== hariçId &&
          alanlar.every((alan) => esitMi(mevcut[alan], aday[alan]))
      )
    );
  }

  async findUnique({ where }: { where: Kayit }) {
    // Prisma findUnique'te de ek skaler filtreler kabul ediyor (extended
    // where unique) ve orada da `undefined` filtreyi düşürüyor.
    return this.kayitlar.find((k) => kayitEslesiyorMu(k, where)) ?? null;
  }

  async findFirst({ where, orderBy }: { where?: Kayit; orderBy?: unknown } = {}) {
    const eslesenler = sirala(
      this.kayitlar.filter((k) => kayitEslesiyorMu(k, where)),
      orderBy
    );
    return eslesenler[0] ?? null;
  }

  async findMany({
    where,
    orderBy,
    take,
  }: { where?: Kayit; orderBy?: unknown; take?: number } = {}) {
    const eslesenler = sirala(
      this.kayitlar.filter((k) => kayitEslesiyorMu(k, where)),
      orderBy
    );
    return typeof take === "number" ? eslesenler.slice(0, take) : eslesenler;
  }

  async count({ where }: { where?: Kayit } = {}) {
    return this.kayitlar.filter((k) => kayitEslesiyorMu(k, where)).length;
  }

  async create({ data }: { data: Kayit }) {
    const kayit: Kayit = {
      id: data.id ?? yeniId(this.ad),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    };

    if (this.tekilIhlali(kayit)) {
      throw sahteBenzersizlikHatasi();
    }

    this.kayitlar.push(kayit);
    return kayit;
  }

  async createMany({
    data,
    skipDuplicates,
  }: {
    data: Kayit[];
    skipDuplicates?: boolean;
  }) {
    let sayi = 0;
    for (const satir of data) {
      const kayit: Kayit = {
        id: satir.id ?? yeniId(this.ad),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...satir,
      };

      if (this.tekilIhlali(kayit)) {
        if (skipDuplicates) continue;
        throw sahteBenzersizlikHatasi();
      }

      this.kayitlar.push(kayit);
      sayi += 1;
    }
    return { count: sayi };
  }

  async update({ where, data }: { where: Kayit; data: Kayit }) {
    const kayit = this.kayitlar.find((k) => kayitEslesiyorMu(k, where));
    if (!kayit) throw sahteBulunamadiHatasi();

    Object.assign(kayit, data, { updatedAt: new Date() });
    return kayit;
  }

  async updateMany({ where, data }: { where?: Kayit; data: Kayit }) {
    const eslesenler = this.kayitlar.filter((k) => kayitEslesiyorMu(k, where));
    for (const kayit of eslesenler) {
      Object.assign(kayit, data, { updatedAt: new Date() });
    }
    return { count: eslesenler.length };
  }

  async delete({ where }: { where: Kayit }) {
    const index = this.kayitlar.findIndex((k) => kayitEslesiyorMu(k, where));
    if (index === -1) throw sahteBulunamadiHatasi();

    const [silinen] = this.kayitlar.splice(index, 1);
    return silinen;
  }

  async deleteMany({ where }: { where?: Kayit } = {}) {
    const kalan = this.kayitlar.filter((k) => !kayitEslesiyorMu(k, where));
    const sayi = this.kayitlar.length - kalan.length;
    this.kayitlar = kalan;
    return { count: sayi };
  }

  async groupBy() {
    // Rotalarda yalnızca profil istatistikleri kullanıyor; testte gerekmiyor.
    return [];
  }
}

/** Prisma'nın benzersizlik ihlali hatasını taklit eder (kod: P2002). */
export function sahteBenzersizlikHatasi(): Error & { code: string } {
  const hata = new Error("Unique constraint failed") as Error & { code: string };
  hata.code = "P2002";
  hata.name = "PrismaClientKnownRequestError";
  return hata;
}

function sahteBulunamadiHatasi(): Error & { code: string } {
  const hata = new Error("Record to update not found") as Error & { code: string };
  hata.code = "P2025";
  hata.name = "PrismaClientKnownRequestError";
  return hata;
}

/** Tekil kısıtlar; şemadaki `@@unique` tanımlarıyla aynı olmalı. */
const TEKIL_KISITLAR: Record<string, string[][]> = {
  user: [["email"]],
  dailyPlan: [["tripId", "date"]],
};

export type SahteVeritabani = Record<string, Kayit[]>;

export interface SahtePrisma {
  [tablo: string]: SahteTablo | ((fn: (tx: SahtePrisma) => unknown) => Promise<unknown>);
}

/**
 * Verilen başlangıç verisiyle bir sahte Prisma istemcisi kurar.
 *
 * @example
 *   const prisma = sahtePrismaKur({
 *     user: [{ id: "u1", email: "a@b.c" }],
 *     trip: [{ id: "t1", userId: "u1", ... }],
 *   });
 */
export function sahtePrismaKur(baslangic: SahteVeritabani = {}) {
  const tablolar = new Map<string, SahteTablo>();

  const tablo = (ad: string): SahteTablo => {
    if (!tablolar.has(ad)) {
      tablolar.set(
        ad,
        new SahteTablo(ad, [...(baslangic[ad] ?? [])], TEKIL_KISITLAR[ad] ?? [])
      );
    }
    return tablolar.get(ad) as SahteTablo;
  };

  // Başlangıç verisindeki tabloları önden oluştur ki `store` üzerinden
  // erişilebilsinler.
  for (const ad of Object.keys(baslangic)) tablo(ad);

  const istemci = new Proxy(
    {
      // Transaction sahte istemcinin kendisini veriyor: geri alma (rollback)
      // taklit EDİLMİYOR. Testlerde amaç sorgu semantiğini doğrulamak;
      // atomiklik entegrasyon testinin konusu.
      $transaction: async (fn: (tx: unknown) => unknown) => fn(istemci),
      $queryRaw: async () => [{ ok: 1 }],
      $disconnect: async () => undefined,
    } as Record<string, unknown>,
    {
      get(hedef, anahtar: string) {
        if (anahtar in hedef) return hedef[anahtar];
        if (typeof anahtar !== "string") return undefined;
        return tablo(anahtar);
      },
    }
  );

  return {
    prisma: istemci as never,
    /** Testte doğrudan okumak/yazmak için tablo erişimi. */
    kayitlar: (ad: string) => tablo(ad).kayitlar,
  };
}
