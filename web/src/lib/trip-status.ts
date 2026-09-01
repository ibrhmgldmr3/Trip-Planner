/**
 * Plan/gezi durumları ve durum geçiş kuralları.
 *
 * `TripStatus` bilinçli olarak `@prisma/client`'tan DEĞİL burada tanımlanıyor:
 * bu modül `"use client"` bileşenlerinden de import ediliyor ve Prisma
 * runtime'ının tarayıcı bundle'ına girmesi istenmiyor. Şekil, Prisma'nın
 * ürettiği enum ile birebir aynı (const object + literal union), bu yüzden
 * Prisma sorgularına doğrudan geçirilebiliyor. Yeni bir durum eklenirse hem
 * `prisma/schema.prisma` hem burası güncellenmeli.
 */

export const TripStatus = {
  PLANNED: "PLANNED",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  DONE: "DONE",
} as const;

export type TripStatus = (typeof TripStatus)[keyof typeof TripStatus];

export const TRIP_STATUSES = Object.values(TripStatus) as TripStatus[];

/** Bilinmeyen bir değeri güvenle `TripStatus`a daraltır. */
export function isTripStatus(value: unknown): value is TripStatus {
  return typeof value === "string" && (TRIP_STATUSES as string[]).includes(value);
}

/** Yerel gün başlangıcına sabitler; saat farkı karşılaştırmayı bozmasın. */
function gunBasi(value: Date): Date {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getTripStatus(
  startDate?: Date | null,
  endDate?: Date | null,
  currentStatus?: TripStatus
): TripStatus {
  // Manuel olarak verilmiş uç durumlar tarihten bağımsız korunur.
  if (currentStatus === TripStatus.CANCELLED) return TripStatus.CANCELLED;
  if (currentStatus === TripStatus.DONE) return TripStatus.DONE;

  if (!startDate || !endDate) return TripStatus.PLANNED;

  const start = gunBasi(new Date(startDate));
  const end = gunBasi(new Date(endDate));

  // Geçersiz tarihlerde tahmin yürütmüyoruz; mevcut durum neyse o kalır.
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return currentStatus ?? TripStatus.PLANNED;
  }

  const now = gunBasi(new Date());

  if (now < start) return TripStatus.PLANNED;
  if (now <= end) return TripStatus.ACTIVE;
  return TripStatus.COMPLETED;
}

export function getStatusLabel(status: TripStatus | string): string {
  switch (status) {
    case TripStatus.PLANNED:
      return 'Planlandı';
    case TripStatus.ACTIVE:
      return 'Aktif';
    case TripStatus.COMPLETED:
      return 'Tamamlandı';
    case TripStatus.CANCELLED:
      return 'İptal Edildi';
    case TripStatus.DONE:
      return 'Gerçekleşti';
    default:
      return 'Bilinmiyor';
  }
}

export function getStatusColor(status: TripStatus | string): string {
  switch (status) {
    case TripStatus.PLANNED:
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case TripStatus.ACTIVE:
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case TripStatus.COMPLETED:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    case TripStatus.CANCELLED:
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    case TripStatus.DONE:
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
}

/** `Rozet` bileşeninin ton adları; tasarım token'larına bağlı. */
export type DurumTonu = "notr" | "aksan" | "olumlu" | "uyari" | "tehlike" | "bilgi";

/**
 * Durumu `Rozet` tonuna çevirir.
 *
 * `getStatusColor` ham Tailwind sınıfı döndürüyor ve tema token'larını
 * bilmiyor; elden geçmemiş sayfalar hâlâ onu kullandığı için duruyor.
 * Yeni sayfalar bunu kullanmalı.
 */
export function getStatusTone(status: TripStatus | string): DurumTonu {
  switch (status) {
    case TripStatus.PLANNED:
      return "bilgi";
    case TripStatus.ACTIVE:
      return "olumlu";
    case TripStatus.DONE:
      return "aksan";
    case TripStatus.CANCELLED:
      return "tehlike";
    case TripStatus.COMPLETED:
    default:
      return "notr";
  }
}

export function canCancel(status: TripStatus): boolean {
  return status === TripStatus.PLANNED || status === TripStatus.ACTIVE;
}

export function canMarkAsDone(status: TripStatus): boolean {
  return status === TripStatus.COMPLETED;
}

/**
 * İzin verilen durum geçişleri.
 *
 * Bu tablo sunucu tarafının tek gerçek kaynağıdır: arayüzdeki `canCancel` /
 * `canMarkAsDone` yalnızca butonu gizler, geçişi ENGELLEMEZ. Doğrudan API'ye
 * atılan bir istek de aynı kuraldan geçsin diye `canTransition` route
 * handler'larında zorunlu tutuluyor.
 *
 * CANCELLED ve DONE uç durumlardır; oradan çıkış yoktur.
 */
const GECISLER: Record<TripStatus, readonly TripStatus[]> = {
  PLANNED: [TripStatus.ACTIVE, TripStatus.COMPLETED, TripStatus.CANCELLED],
  ACTIVE: [TripStatus.COMPLETED, TripStatus.CANCELLED],
  // COMPLETED'dan CANCELLED'a geçiş YOK: `canCancel` arayüzde iptal
  // butonunu yalnızca PLANNED/ACTIVE için gösteriyor. Sunucunun daha
  // geniş davranması, arayüzde hiç görünmeyen bir geçişi API'den mümkün
  // kılardı — iki taraf aynı kuralı uygulamalı.
  COMPLETED: [TripStatus.DONE],
  CANCELLED: [],
  DONE: [],
};

export function canTransition(from: TripStatus, to: TripStatus): boolean {
  // Aynı duruma geçiş idempotent sayılır (çift tıklama, yeniden deneme).
  if (from === to) return true;
  return GECISLER[from]?.includes(to) ?? false;
}

/** Geçiş reddedildiğinde kullanıcıya gösterilecek açıklama. */
export function transitionError(from: TripStatus, to: TripStatus): string {
  return `"${getStatusLabel(from)}" durumundaki bir plan "${getStatusLabel(to)}" durumuna geçirilemez`;
}
