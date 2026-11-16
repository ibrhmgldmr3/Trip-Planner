// Tarih, süre ve para biçimlendirme yardımcıları (istemci ve sunucuda ortak).

const DAY_MS = 24 * 60 * 60 * 1000;

/** Yerel saat dilimine göre bugünün tarihi (YYYY-AA-GG). */
export function todayISO(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  // "YYYY-AA-GG" bir takvim günüdür; UTC gece yarısı olarak okunursa batıdaki
  // saat dilimlerinde bir gün geri kayar. Bu yüzden yerel gün olarak kurulur.
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "21 Ağu 2026" */
export function formatDate(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

/** "21 Ağustos Cuma" */
export function formatDayLong(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" });
}

/** "21 – 30 Ağu 2026" veya "28 Ağu – 3 Eyl 2026" */
export function formatDateRange(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined
): string {
  const a = toDate(start);
  const b = toDate(end);
  if (!a && !b) return "Tarih belirtilmedi";
  if (!a || !b) return formatDate(a ?? b);

  const sameYear = a.getFullYear() === b.getFullYear();
  const sameMonth = sameYear && a.getMonth() === b.getMonth();
  if (sameMonth) {
    return `${a.getDate()} – ${formatDate(b)}`;
  }
  const leftOptions: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  if (!sameYear) leftOptions.year = "numeric";
  return `${a.toLocaleDateString("tr-TR", leftOptions)} – ${formatDate(b)}`;
}

/** İki tarih arasındaki gece sayısı (aynı gün = 0). */
export function tripNights(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined
): number {
  const a = toDate(start);
  const b = toDate(end);
  if (!a || !b) return 0;
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.max(0, Math.round((utcB - utcA) / DAY_MS));
}

/** Gezi gün sayısı; başlangıç ve bitiş günleri dahil (21 → 30 = 10 gün). */
export function tripDays(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined
): number {
  const a = toDate(start);
  const b = toDate(end);
  if (!a || !b) return 0;
  return tripNights(a, b) + 1;
}

/** Başlangıç tarihine gün ekler. */
export function addDays(start: string | Date, days: number): Date {
  const date = new Date(toDate(start) ?? start);
  date.setDate(date.getDate() + days);
  return date;
}

/** "12.500 ₺" */
export function formatMoney(amount: number | null | undefined, currency = "TRY"): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  const rounded = Math.round(amount);
  if (currency === "TRY") return `${rounded.toLocaleString("tr-TR")} ₺`;
  return `${rounded.toLocaleString("tr-TR")} ${currency}`;
}

/** Şehir adından bilet kodu: "İzmir" → "İZM" */
export function cityCode(city: string | null | undefined): string {
  if (!city) return "—";
  const letters = city.trim().replace(/[^\p{L}]/gu, "");
  return letters.slice(0, 3).toLocaleUpperCase("tr-TR") || "—";
}

export function initials(name: string | null | undefined): string {
  if (!name) return "G";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toLocaleUpperCase("tr-TR") || "G";
}
