import { TripStatus } from '@prisma/client';

export function getTripStatus(startDate?: Date | null, endDate?: Date | null, currentStatus?: TripStatus): TripStatus {
  if (!startDate || !endDate) return TripStatus.PLANNED;
  
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Tarihleri gün bazında karşılaştır (saat bilgisini göz ardı et)
  now.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  // Manuel olarak iptal edilmişse
  if (currentStatus === TripStatus.CANCELLED) return TripStatus.CANCELLED;
  
  // Manuel olarak tamamlanmışsa (done)
  if (currentStatus === TripStatus.DONE) return TripStatus.DONE;
  
  // Henüz başlamamışsa
  if (now < start) return TripStatus.PLANNED;
  
  // Devam ediyorsa
  if (now >= start && now <= end) return TripStatus.ACTIVE;
  
  // Bitiş tarihi geçmişse ve done değilse
  if (now > end) return TripStatus.COMPLETED;
  
  return TripStatus.PLANNED;
}

export function getStatusLabel(status: TripStatus): string {
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

export function getStatusColor(status: TripStatus): string {
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

export function canCancel(status: TripStatus): boolean {
  return status === TripStatus.PLANNED || status === TripStatus.ACTIVE;
}

export function canMarkAsDone(status: TripStatus): boolean {
  return status === TripStatus.COMPLETED;
}

export function shouldShowInMyTrips(status: TripStatus): boolean {
  return status === TripStatus.DONE;
}
