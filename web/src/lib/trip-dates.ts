/**
 * Seyahat tarihi hesaplarının tek kaynağı.
 *
 * Neden ayrı bir modül: gün sayısı beş ayrı yerde (AI plan üretimi, manuel
 * plan kaydı, bütçe sayfası, günlük planlayıcı, manuel planlayıcı) birbirinden
 * bağımsız olarak `Math.ceil((end - start) / GUN_MS)` ile hesaplanıyordu.
 * Bu formül aralığı DIŞLAYICI sayar: 1–5 Ocak için 4 döner. Oysa günlük
 * program KAPSAYICI gün ister (1, 2, 3, 4 ve 5 Ocak = 5 gün). Sonuç: AI'dan
 * bir gün eksik plan isteniyor, bütçenin günlük ortalaması şişiyor ve
 * planlayıcı son günü hiç göstermiyordu.
 *
 * Kural:
 *   gunSayisi(1 Ocak, 5 Ocak) === 5   (kapsayıcı gün)
 *   geceSayisi(1 Ocak, 5 Ocak) === 4  (konaklama gecesi)
 */

const GUN_MS = 24 * 60 * 60 * 1000;

/** Desteklenen en uzun plan; modelden ve formdan gelen saçma aralıkları keser. */
export const MAKS_GUN = 60;

/**
 * Tarihi güvenle `Date`e çevirir; ayrıştırılamazsa null döner.
 *
 * "YYYY-MM-DD" (form input'unun ürettiği biçim) bilinçli olarak YEREL öğlene
 * sabitleniyor. `new Date("2026-01-01")` UTC gece yarısı demektir; negatif
 * offset'li bir saat diliminde yerel gün bir gün geriye kayar ve gün sayısı
 * bir eksik/fazla çıkar. Öğlen sabitlemesi yaz saati geçişlerine de dayanıklı.
 */
export function tarihiCoz(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const sadeTarih = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (sadeTarih) {
    const [, yil, ay, gun] = sadeTarih;
    const d = new Date(Number(yil), Number(ay) - 1, Number(gun), 12, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Yerel gün başlangıcı; iki tarihi gün çözünürlüğünde karşılaştırmak için. */
export function gunBasi(value: Date): Date {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Aralıktaki KAPSAYICI gün sayısı.
 *
 * @returns 1..MAKS_GUN arası bir sayı; tarihler eksik/geçersizse ya da
 *          bitiş başlangıçtan önceyse 0 (= "bilinmiyor").
 */
export function gunSayisi(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined
): number {
  const s = tarihiCoz(start);
  const e = tarihiCoz(end);
  if (!s || !e) return 0;

  const fark = Math.round((gunBasi(e).getTime() - gunBasi(s).getTime()) / GUN_MS);
  if (fark < 0) return 0;

  return Math.min(fark + 1, MAKS_GUN);
}

/** Konaklama gecesi sayısı: gün sayısının bir eksiği, en az 0. */
export function geceSayisi(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined
): number {
  const gun = gunSayisi(start, end);
  return gun > 0 ? gun - 1 : 0;
}

/**
 * Başlangıçtan `dayIndex` gün sonrasının ISO tarihi ("YYYY-MM-DD").
 * Başlangıç yoksa boş string döner — çağıran taraf tarihi gizler.
 */
export function isoGunTarihi(
  start: string | Date | null | undefined,
  dayIndex: number
): string {
  const s = tarihiCoz(start);
  if (!s) return "";

  const d = new Date(s);
  d.setDate(d.getDate() + dayIndex);

  const yil = d.getFullYear();
  const ay = String(d.getMonth() + 1).padStart(2, "0");
  const gun = String(d.getDate()).padStart(2, "0");
  return `${yil}-${ay}-${gun}`;
}

/**
 * Gün numarasının insan tarafından okunur karşılığı.
 * Tarih bilinmiyorsa "3. Gün" gibi sırayla yetiniyoruz.
 */
export function gunEtiketi(
  start: string | Date | null | undefined,
  dayIndex: number
): string {
  const iso = isoGunTarihi(start, dayIndex);
  if (!iso) return `${dayIndex + 1}. Gün`;
  return iso;
}

/** Sıfıra bölmeye karşı korumalı günlük ortalama. */
export function gunlukOrtalama(toplam: number, gun: number): number {
  if (!Number.isFinite(toplam) || toplam <= 0) return 0;
  const bolen = gun > 0 ? gun : 1;
  return Math.round(toplam / bolen);
}
