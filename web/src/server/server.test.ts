import { beforeEach, describe, expect, it } from "vitest";
import { distanceKm, sanitizeStopCoordinates } from "./geo";
import { manualBudget } from "./plans";
import { rateLimit, resetRateLimits } from "./rate-limit";
import { generatePlanSchema, manualPlanSchema } from "./validation";

const izmir = { latitude: 38.4237, longitude: 27.1428 };

describe("konum doğrulama", () => {
  it("kuş uçuşu mesafeyi hesaplar", () => {
    const istanbul = { latitude: 41.0082, longitude: 28.9784 };
    expect(distanceKm(izmir, istanbul)).toBeGreaterThan(320);
    expect(distanceKm(izmir, istanbul)).toBeLessThan(340);
  });

  it("şehirden uzak, geçersiz ya da (0,0) koordinatları atar", () => {
    expect(sanitizeStopCoordinates(38.4189, 27.1287, izmir)).toEqual({ latitude: 38.4189, longitude: 27.1287 });
    expect(sanitizeStopCoordinates(41.0082, 28.9784, izmir)).toBeNull();
    expect(sanitizeStopCoordinates(0, 0, izmir)).toBeNull();
    // Günübirlik mesafe kabul edilir (Efes), komşu büyük şehir edilmez (Bursa → İstanbul).
    expect(sanitizeStopCoordinates(37.9395, 27.3417, izmir)).not.toBeNull();
    expect(sanitizeStopCoordinates(41.0082, 28.9784, { latitude: 40.1826, longitude: 29.0675 })).toBeNull();
    expect(sanitizeStopCoordinates(138.4, 27.1, null)).toBeNull();
    expect(sanitizeStopCoordinates(undefined, "27.1", izmir)).toBeNull();
  });

  it("şehir merkezi bilinmiyorsa geçerli koordinatı kabul eder", () => {
    expect(sanitizeStopCoordinates(48.8584, 2.2945, null)).not.toBeNull();
  });
});

describe("istek doğrulama", () => {
  it("AI isteğinde şehir zorunludur, metinler kırpılır, etiketler tekilleşir", () => {
    expect(generatePlanSchema.safeParse({ city: "   " }).success).toBe(false);

    const parsed = generatePlanSchema.parse({
      city: "  İzmir ",
      country: "",
      startDate: "",
      budgetAmount: "15000",
      interests: ["Doğa", "Doğa", " Müzeler "],
    });
    expect(parsed).toMatchObject({ city: "İzmir", budgetAmount: 15000, travelers: 1, interests: ["Doğa", "Müzeler"] });
    expect(parsed.country).toBeUndefined();
    expect(parsed.startDate).toBeUndefined();
  });

  it("dönüş tarihi gidişten önce olamaz", () => {
    const result = generatePlanSchema.safeParse({ city: "İzmir", startDate: "2026-08-30", endDate: "2026-08-21" });
    expect(result.success).toBe(false);
  });

  it("bozuk tarih ve saat biçimlerini reddeder", () => {
    expect(generatePlanSchema.safeParse({ city: "İzmir", startDate: "21.08.2026" }).success).toBe(false);
    expect(
      manualPlanSchema.safeParse({
        city: "Eskişehir",
        startDate: "2026-12-05",
        endDate: "2026-12-06",
        days: [{ stops: [{ name: "Müze", startTime: "25:00" }] }],
      }).success
    ).toBe(false);
  });
});

describe("manuel plan bütçesi", () => {
  it("tutarları girilen kalemlerden hesaplar", () => {
    const input = manualPlanSchema.parse({
      city: "Kapadokya",
      startDate: "2026-12-27",
      endDate: "2026-12-30",
      travelers: 2,
      transport: { type: "Uçak", price: 5200 },
      accommodation: { type: "Otel", price: 3200 },
      days: [
        { stops: [{ name: "Müze", cost: 600 }, { name: "Kale", cost: 250 }] },
        { isFree: true, stops: [{ name: "Sayılmamalı", cost: 9999 }] },
      ],
      foodPerDay: 1200,
      otherCost: 1000,
    });
    const { lines, total, dayCount } = manualBudget(input);

    expect(dayCount).toBe(4);
    expect(Object.fromEntries(lines.map((line) => [line.category, line.amount]))).toEqual({
      TRANSPORT: 5200,
      ACCOMMODATION: 9600, // 3 gece
      ACTIVITIES: 850,
      FOOD: 4800,
      OTHER: 1000,
    });
    expect(total).toBe(21450);
  });

  it("günübirlik gezide konaklama tutarı oluşmaz", () => {
    const input = manualPlanSchema.parse({
      city: "Bursa",
      startDate: "2026-12-05",
      endDate: "2026-12-05",
      accommodation: { type: "Otel", price: 3000 },
    });
    expect(manualBudget(input)).toMatchObject({ lines: [], total: 0, dayCount: 1 });
  });
});

describe("hız sınırı", () => {
  beforeEach(() => resetRateLimits());

  it("pencere içindeki sınırı aşan isteği reddeder", () => {
    expect(rateLimit("test", 2, 60_000).ok).toBe(true);
    expect(rateLimit("test", 2, 60_000).ok).toBe(true);
    const third = rateLimit("test", 2, 60_000);
    expect(third.ok).toBe(false);
    expect(third.retryAfter).toBeGreaterThan(0);
    expect(rateLimit("baska-anahtar", 2, 60_000).ok).toBe(true);
  });
});
