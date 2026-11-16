import { describe, expect, it } from "vitest";
import { cityCode, formatDateRange, tripDays, tripNights } from "./format";

describe("tripDays / tripNights", () => {
  it("başlangıç ve bitiş günlerini dahil sayar", () => {
    expect(tripDays("2026-08-21", "2026-08-30")).toBe(10);
    expect(tripNights("2026-08-21", "2026-08-30")).toBe(9);
  });

  it("günübirlik gezi 1 gün, 0 gecedir", () => {
    expect(tripDays("2026-08-21", "2026-08-21")).toBe(1);
    expect(tripNights("2026-08-21", "2026-08-21")).toBe(0);
  });

  it("tarih eksikse 0 döner", () => {
    expect(tripDays("2026-08-21", null)).toBe(0);
    expect(tripDays(undefined, undefined)).toBe(0);
  });

  it("ay ve yıl sınırlarını doğru hesaplar", () => {
    expect(tripDays("2026-12-30", "2027-01-02")).toBe(4);
    expect(tripDays("2028-02-28", "2028-03-01")).toBe(3); // artık yıl
  });
});

describe("biçimlendirme", () => {
  it("aynı aydaki aralığı kısaltır", () => {
    expect(formatDateRange("2026-08-21", "2026-08-30")).toBe("21 – 30 Ağu 2026");
    expect(formatDateRange(null, null)).toBe("Tarih belirtilmedi");
  });

  it("şehir kodunu Türkçe büyük harfle üretir", () => {
    expect(cityCode("izmir")).toBe("İZM");
    expect(cityCode("Şanlıurfa")).toBe("ŞAN");
  });
});
