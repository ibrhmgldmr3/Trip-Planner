import { env } from "@/env";
import { prisma } from "@/lib/prisma";

export interface CityCover {
  /** Şehrin kapak fotoğrafı; bulunamadıysa null (arayüz renk geçişine döner). */
  imageUrl: string | null;
  /** Fotoğrafın kaynağı olan Wikipedia sayfası (atıf için). */
  pageUrl: string | null;
}

export interface CityRef {
  city: string;
  country?: string | null;
  /**
   * Aranacak Wikipedia madde başlığı; verilmezse şehir adı kullanılır. Adı başka bir
   * anlama da gelen yerler için (ör. "Kaş" → "Kaş, Antalya") elle seçilmiş listelerde verilir.
   */
  title?: string;
}

const NONE: CityCover = { imageUrl: null, pageUrl: null };
const RETRY_MISSING_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Önbellek anahtarı. Arama yalnızca şehir adıyla yapıldığı için ülke anahtara
 * girmez; aynı şehir ülkeli ve ülkesiz yazıldığında tek kayıt kullanılır.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const coverKey = (city: string, _country?: string | null) => city.trim().toLocaleLowerCase("tr-TR");

// Madde görseli fotoğraf yerine harita, bayrak, arma ya da kolaj olabilir; bunlar kapak olmaz.
// Sözcükler dosya adında ayrı bir parça olarak aranır; yoksa "arma" Marmaris'i, "flag"
// Flagstaff'ı eler ve o şehirler hiç fotoğraf alamaz.
const NOT_A_PHOTO =
  /\.svg|(?<![a-zçğıöşü])(?:(?:locator|maps?|flags?|logos?|seals?|montage|collage|coat_of_arms|arma(?:s[ıi])?)(?![a-zçğıöşü])|harita|konum|bayra[kğ]|kolaj)/i;

/** Wikipedia madde görseli kapak olarak kullanılabilecek bir fotoğraf mı? */
export const isPhotoUrl = (source: string) => !NOT_A_PHOTO.test(decodeURIComponent(source));

/* ----------------------------- Wikipedia ---------------------------- */

interface WikiResponse {
  query?: {
    normalized?: Array<{ from: string; to: string }>;
    redirects?: Array<{ from: string; to: string }>;
    pages?: Array<{
      title: string;
      missing?: boolean;
      fullurl?: string;
      thumbnail?: { source?: string };
      pageprops?: { disambiguation?: string };
      coordinates?: unknown[];
    }>;
  };
}

class RateLimited extends Error {}

/** Tek istekte birden çok maddenin görselini sorar; sonuç girilen başlığa göre eşlenir. */
async function wikiCovers(lang: "tr" | "en", titles: string[]): Promise<Map<string, CityCover>> {
  const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    redirects: "1",
    prop: "pageimages|info|pageprops|coordinates",
    piprop: "thumbnail",
    pithumbsize: "1280",
    pilimit: "50",
    colimit: "50",
    inprop: "url",
    ppprop: "disambiguation",
    titles: titles.join("|"),
  }).toString();

  const response = await fetch(url, {
    headers: { "User-Agent": env.GEOCODER_USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (response.status === 429) throw new RateLimited();
  if (!response.ok) throw new Error(`Wikipedia ${response.status}`);

  const query = ((await response.json()) as WikiResponse).query ?? {};
  const normalized = new Map((query.normalized ?? []).map((item) => [item.from, item.to]));
  const redirects = new Map((query.redirects ?? []).map((item) => [item.from, item.to]));
  const pages = new Map((query.pages ?? []).map((page) => [page.title, page]));

  const found = new Map<string, CityCover>();
  for (const title of titles) {
    const step = normalized.get(title) ?? title;
    const page = pages.get(redirects.get(step) ?? step);
    const source = page?.thumbnail?.source;
    if (!page || page.missing || page.pageprops?.disambiguation !== undefined) continue;
    // Yer maddelerinin koordinatı olur; koordinatsız madde aynı adı taşıyan başka bir
    // şey olabilir (ör. "Kaş" maddesi ilçeyi değil kaşı anlatır) ve kapak olarak kullanılmaz.
    if (!page.coordinates?.length) continue;
    if (!source || !isPhotoUrl(source)) continue;
    found.set(title, { imageUrl: source, pageUrl: page.fullurl ?? null });
  }
  return found;
}

/* --------------------------- Sıra ve bekleme ------------------------- */

// Wikimedia art arda gelen istekleri sınırlar: dış istekler tek sıraya dizilir ve
// aralarında boşluk bırakılır; 429 gelirse bir süre hiç istek atılmaz.
const SPACING_MS = 1200;
const COOLDOWN_MS = 3 * 60 * 1000;
const BATCH = 40;
// Bu uç oturum istemez: sıra sınırsız uzarsa bir kişinin art arda sorduğu uydurma
// şehirler herkesin kapak isteğini dakikalarca bekletir. Sıra doluysa beklenmez.
const MAX_WAITING = 8;
let waiting = 0;

let queue: Promise<unknown> = Promise.resolve();
let cooldownUntil = 0;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.then(
    () => sleep(SPACING_MS),
    () => sleep(SPACING_MS)
  );
  return run;
}

/* ------------------------------- Okuma ------------------------------ */

async function readCache(keys: string[]): Promise<Map<string, CityCover>> {
  const rows = await prisma.cityCover.findMany({ where: { query: { in: keys } } });
  const now = Date.now();
  const cached = new Map<string, CityCover>();
  for (const row of rows) {
    // "Bulunamadı" kayıtları bir süre sonra yeniden denenir.
    const stale = !row.imageUrl && now - row.createdAt.getTime() > RETRY_MISSING_AFTER_MS;
    if (!stale) cached.set(row.query, { imageUrl: row.imageUrl, pageUrl: row.pageUrl });
  }
  return cached;
}

/**
 * Şehirlerin kapak fotoğraflarını verir (Wikipedia madde görseli). Sonuçlar
 * veritabanında önbelleğe alınır. Servise ulaşılamazsa ya da hız sınırına
 * takılırsa eksikler boş döner ve önbelleğe yazılmaz; sonraki istekte yeniden denenir.
 *
 * Dönen harita `coverKey(city, country)` ile anahtarlanır.
 */
export async function getCityCovers(refs: CityRef[]): Promise<Map<string, CityCover>> {
  const wanted = new Map<string, string>(); // anahtar → aranacak madde başlığı
  for (const ref of refs) {
    const city = ref.city.trim();
    if (city) wanted.set(coverKey(city, ref.country), ref.title?.trim() || city);
  }
  if (wanted.size === 0) return new Map();

  const result = await readCache([...wanted.keys()]);
  if ([...wanted.keys()].every((key) => result.has(key)) || Date.now() < cooldownUntil || waiting >= MAX_WAITING) {
    for (const key of wanted.keys()) if (!result.has(key)) result.set(key, NONE);
    return result;
  }

  waiting++;
  await enqueue(async () => {
    waiting--;
    // Sırada beklerken başka bir istek aynı şehirleri doldurmuş olabilir.
    for (const [key, cover] of await readCache([...wanted.keys()])) result.set(key, cover);
    const missing = [...wanted].filter(([key]) => !result.has(key));
    if (missing.length === 0 || Date.now() < cooldownUntil) return;

    try {
      for (let offset = 0; offset < missing.length; offset += BATCH) {
        const chunk = missing.slice(offset, offset + BATCH);
        const titles = [...new Set(chunk.map(([, city]) => city))];

        const fromTr = await wikiCovers("tr", titles);
        const leftover = titles.filter((title) => !fromTr.has(title));
        let fromEn = new Map<string, CityCover>();
        if (leftover.length > 0) {
          await sleep(SPACING_MS);
          fromEn = await wikiCovers("en", leftover);
        }

        for (const [key, city] of chunk) {
          const cover = fromTr.get(city) ?? fromEn.get(city) ?? NONE;
          result.set(key, cover);
          await prisma.cityCover.upsert({
            where: { query: key },
            update: { imageUrl: cover.imageUrl, pageUrl: cover.pageUrl, createdAt: new Date() },
            create: { query: key, imageUrl: cover.imageUrl, pageUrl: cover.pageUrl },
          });
        }
      }
    } catch (error) {
      if (error instanceof RateLimited) {
        cooldownUntil = Date.now() + COOLDOWN_MS;
        console.warn("[covers] Wikipedia hız sınırı; kapak sorguları bir süre durduruldu.");
      } else {
        console.warn("[covers] Kapak fotoğrafı alınamadı:", error instanceof Error ? error.message : error);
      }
    }
  });

  for (const key of wanted.keys()) if (!result.has(key)) result.set(key, NONE);
  return result;
}

export async function getCityCover(city: string, country?: string | null): Promise<CityCover> {
  const covers = await getCityCovers([{ city, country }]);
  return covers.get(coverKey(city, country)) ?? NONE;
}
