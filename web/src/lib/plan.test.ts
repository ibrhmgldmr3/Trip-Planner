import { describe, expect, it } from "vitest";
import { canMarkDone, effectiveStatus, parseLegacyBudget, splitMarkdownDays, sumByCategory } from "./plan";

const now = new Date(2026, 10, 12, 15, 0); // 12 Kasım 2026, yerel saat

describe("effectiveStatus", () => {
  it("tarihlere göre planlandı / yolda / tarihi geçti verir", () => {
    expect(effectiveStatus({ startDate: "2026-11-20", endDate: "2026-11-22", status: "PLANNED" }, now)).toBe("PLANNED");
    expect(effectiveStatus({ startDate: "2026-11-12", endDate: "2026-11-12", status: "PLANNED" }, now)).toBe("ACTIVE");
    expect(effectiveStatus({ startDate: "2026-11-10", endDate: "2026-11-11", status: "PLANNED" }, now)).toBe("COMPLETED");
  });

  it("iptal ve gerçekleşti durumları tarihten bağımsızdır", () => {
    expect(effectiveStatus({ startDate: "2026-11-10", endDate: "2026-11-11", status: "CANCELLED" }, now)).toBe("CANCELLED");
    expect(effectiveStatus({ startDate: "2027-01-01", endDate: "2027-01-02", status: "DONE" }, now)).toBe("DONE");
  });

  it("tarihsiz plan planlandı sayılır", () => {
    expect(effectiveStatus({ startDate: null, endDate: null, status: "PLANNED" }, now)).toBe("PLANNED");
  });
});

describe("canMarkDone", () => {
  it("tarihsiz planlar işaretlenebilir, iptal edilenler işaretlenemez", () => {
    expect(canMarkDone({ startDate: null, endDate: null, status: "PLANNED" })).toBe(true);
    expect(canMarkDone({ startDate: null, endDate: null, status: "CANCELLED" })).toBe(false);
    expect(canMarkDone({ startDate: "2999-01-01", endDate: "2999-01-02", status: "PLANNED" })).toBe(false);
    expect(canMarkDone({ startDate: "2000-01-01", endDate: "2000-01-02", status: "PLANNED" })).toBe(true);
  });
});

describe("sumByCategory", () => {
  it("kategorileri sabit sırayla toplar", () => {
    expect(
      sumByCategory([
        { category: "FOOD", amount: 100 },
        { category: "TRANSPORT", amount: 50 },
        { category: "FOOD", amount: 25 },
      ])
    ).toEqual([
      { category: "TRANSPORT", total: 50 },
      { category: "FOOD", total: 125 },
    ]);
  });
});

describe("eski metin tabanlı planlar", () => {
  it("günlük programı başlıklara göre böler", () => {
    const days = splitMarkdownDays(
      "## Günlük Detaylı Program\n\n### 1. Gün: Eski Mardin\n- Ulu Cami\n\n---\n\n**Gün 2 – Midyat**\n- Konukevi\n- 3. gün için erken kalkın"
    );
    expect(days.map((day) => [day.day, day.title])).toEqual([
      [1, "1. Gün: Eski Mardin"],
      [2, "Gün 2 – Midyat"],
    ]);
    expect(days[1].body).toContain("3. gün için erken kalkın");
  });

  it("serbest metin bütçeden kalem çıkarır, toplam satırını atlar", () => {
    const lines = parseLegacyBudget(
      "- **Konaklama:** 2 gece, 4.200 TL\n- Yeme-içme: ₺2.600\n| Müze girişleri | 3 müze | 1.000 TL |\n**Toplam:** 7.800 TL"
    );
    expect(lines.map((line) => [line.category, line.amount])).toEqual([
      ["ACCOMMODATION", 4200],
      ["FOOD", 2600],
      ["ACTIVITIES", 1000],
    ]);
  });
});
