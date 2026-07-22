import { afterEach, describe, expect, it, vi } from "vitest";
import { TripStatus } from "@prisma/client";
import {
  canCancel,
  canMarkAsDone,
  getStatusColor,
  getStatusLabel,
  getTripStatus,
} from "@/lib/trip-status";

/** Yerel saatte gün başına sabitlenmiş tarih üretir (UTC kaymasını önler). */
function gun(yil: number, ay: number, gunNo: number): Date {
  return new Date(yil, ay - 1, gunNo, 12, 0, 0, 0);
}

/** Testin "bugün"ünü sabitler; getTripStatus `new Date()` okuyor. */
function bugunuSabitle(tarih: Date) {
  vi.useFakeTimers();
  vi.setSystemTime(tarih);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("getTripStatus", () => {
  it("tarih verilmediğinde PLANNED döner", () => {
    expect(getTripStatus(null, null)).toBe(TripStatus.PLANNED);
    expect(getTripStatus(undefined, undefined)).toBe(TripStatus.PLANNED);
    // Tek tarafı eksik olan aralık da güvenilmez sayılmalı.
    expect(getTripStatus(gun(2026, 8, 1), null)).toBe(TripStatus.PLANNED);
    expect(getTripStatus(null, gun(2026, 8, 5))).toBe(TripStatus.PLANNED);
  });

  it("başlangıç ilerideyse PLANNED döner", () => {
    bugunuSabitle(gun(2026, 7, 22));
    expect(getTripStatus(gun(2026, 8, 1), gun(2026, 8, 5))).toBe(TripStatus.PLANNED);
  });

  it("aralık içindeyse ACTIVE döner", () => {
    bugunuSabitle(gun(2026, 8, 3));
    expect(getTripStatus(gun(2026, 8, 1), gun(2026, 8, 5))).toBe(TripStatus.ACTIVE);
  });

  it("bitiş tarihi geçtiyse COMPLETED döner", () => {
    bugunuSabitle(gun(2026, 8, 6));
    expect(getTripStatus(gun(2026, 8, 1), gun(2026, 8, 5))).toBe(TripStatus.COMPLETED);
  });

  it("sınır günleri aralığa dahildir (başlangıç ve bitiş günü ACTIVE)", () => {
    bugunuSabitle(gun(2026, 8, 1));
    expect(getTripStatus(gun(2026, 8, 1), gun(2026, 8, 5))).toBe(TripStatus.ACTIVE);

    vi.setSystemTime(gun(2026, 8, 5));
    expect(getTripStatus(gun(2026, 8, 1), gun(2026, 8, 5))).toBe(TripStatus.ACTIVE);
  });

  it("saat farkını yok sayar: bitiş gününün gecesi hâlâ ACTIVE", () => {
    // Bugün 5 Ağustos 23:30, bitiş 5 Ağustos 08:00. Saat karşılaştırılsaydı
    // COMPLETED çıkardı; fonksiyon gün bazında karşılaştırmalı.
    bugunuSabitle(new Date(2026, 7, 5, 23, 30, 0, 0));
    expect(getTripStatus(new Date(2026, 7, 1, 9, 0), new Date(2026, 7, 5, 8, 0))).toBe(
      TripStatus.ACTIVE
    );
  });

  it("tek günlük seyahatte o gün ACTIVE olur", () => {
    bugunuSabitle(gun(2026, 8, 1));
    expect(getTripStatus(gun(2026, 8, 1), gun(2026, 8, 1))).toBe(TripStatus.ACTIVE);
  });

  it("CANCELLED durumu tarihlerden bağımsız korunur", () => {
    bugunuSabitle(gun(2026, 8, 3));
    expect(getTripStatus(gun(2026, 8, 1), gun(2026, 8, 5), TripStatus.CANCELLED)).toBe(
      TripStatus.CANCELLED
    );

    // Bitiş geçmiş olsa bile iptal kaydı COMPLETED'a dönmemeli.
    vi.setSystemTime(gun(2026, 9, 1));
    expect(getTripStatus(gun(2026, 8, 1), gun(2026, 8, 5), TripStatus.CANCELLED)).toBe(
      TripStatus.CANCELLED
    );
  });

  it("DONE durumu tarihlerden bağımsız korunur", () => {
    bugunuSabitle(gun(2026, 9, 1));
    expect(getTripStatus(gun(2026, 8, 1), gun(2026, 8, 5), TripStatus.DONE)).toBe(TripStatus.DONE);
  });

  it("PLANNED/ACTIVE/COMPLETED mevcut durumu tarihe göre yeniden hesaplanır", () => {
    bugunuSabitle(gun(2026, 9, 1));
    // Kullanıcı kaydı PLANNED kalmış olsa da tarih geçtiyse COMPLETED olmalı.
    expect(getTripStatus(gun(2026, 8, 1), gun(2026, 8, 5), TripStatus.PLANNED)).toBe(
      TripStatus.COMPLETED
    );
    expect(getTripStatus(gun(2026, 8, 1), gun(2026, 8, 5), TripStatus.ACTIVE)).toBe(
      TripStatus.COMPLETED
    );
  });

  it("tarihi ISO string olarak alsa bile çalışır (Prisma dışı çağrılar)", () => {
    bugunuSabitle(gun(2026, 8, 3));
    // Çağıranlar bazen serileştirilmiş tarih gönderiyor; new Date() ikisini de yutuyor.
    const start = new Date("2026-08-01T00:00:00") as Date;
    const end = new Date("2026-08-05T00:00:00") as Date;
    expect(getTripStatus(start, end)).toBe(TripStatus.ACTIVE);
  });
});

describe("getStatusLabel", () => {
  it("her durum için Türkçe etiket döner", () => {
    expect(getStatusLabel(TripStatus.PLANNED)).toBe("Planlandı");
    expect(getStatusLabel(TripStatus.ACTIVE)).toBe("Aktif");
    expect(getStatusLabel(TripStatus.COMPLETED)).toBe("Tamamlandı");
    expect(getStatusLabel(TripStatus.CANCELLED)).toBe("İptal Edildi");
    expect(getStatusLabel(TripStatus.DONE)).toBe("Gerçekleşti");
  });

  it("bilinmeyen durumda 'Bilinmiyor' döner", () => {
    // DB'ye elle yeni bir enum değeri girilirse UI patlamamalı.
    expect(getStatusLabel("SURPRISE" as TripStatus)).toBe("Bilinmiyor");
  });

  it("etiketler birbirinden farklıdır", () => {
    const etiketler = Object.values(TripStatus).map(getStatusLabel);
    expect(new Set(etiketler).size).toBe(etiketler.length);
  });
});

describe("getStatusColor", () => {
  it("COMPLETED ile CANCELLED farklı renk sınıfları kullanır", () => {
    // İkisi de "artık bitti" ama kullanıcı ayrımı görebilmeli.
    expect(getStatusColor(TripStatus.COMPLETED)).not.toBe(getStatusColor(TripStatus.CANCELLED));
  });

  it("her renk hem açık hem koyu tema sınıfı içerir", () => {
    for (const status of Object.values(TripStatus)) {
      const sinif = getStatusColor(status);
      expect(sinif, `${status} için arka plan sınıfı yok`).toMatch(/\bbg-/);
      expect(sinif, `${status} için koyu tema sınıfı yok`).toMatch(/\bdark:bg-/);
      expect(sinif, `${status} için koyu tema metin sınıfı yok`).toMatch(/\bdark:text-/);
    }
  });

  it("bilinmeyen durumda nötr gri sınıfa düşer", () => {
    expect(getStatusColor("SURPRISE" as TripStatus)).toBe(getStatusColor(TripStatus.COMPLETED));
  });
});

describe("canCancel", () => {
  it("yalnızca PLANNED ve ACTIVE iptal edilebilir", () => {
    expect(canCancel(TripStatus.PLANNED)).toBe(true);
    expect(canCancel(TripStatus.ACTIVE)).toBe(true);
    expect(canCancel(TripStatus.COMPLETED)).toBe(false);
    expect(canCancel(TripStatus.CANCELLED)).toBe(false);
    expect(canCancel(TripStatus.DONE)).toBe(false);
  });
});

describe("canMarkAsDone", () => {
  it("yalnızca COMPLETED 'gerçekleşti' olarak işaretlenebilir", () => {
    expect(canMarkAsDone(TripStatus.COMPLETED)).toBe(true);
    expect(canMarkAsDone(TripStatus.PLANNED)).toBe(false);
    expect(canMarkAsDone(TripStatus.ACTIVE)).toBe(false);
    expect(canMarkAsDone(TripStatus.CANCELLED)).toBe(false);
    expect(canMarkAsDone(TripStatus.DONE)).toBe(false);
  });

  it("iptal ve tamamlama eylemleri hiçbir durumda birlikte açık olmaz", () => {
    for (const status of Object.values(TripStatus)) {
      expect(
        canCancel(status) && canMarkAsDone(status),
        `${status} için iki eylem birden açık`
      ).toBe(false);
    }
  });
});
