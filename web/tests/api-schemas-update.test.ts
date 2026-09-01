import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ilkHataMesaji,
  manualPlanSchema,
  planBudgetPatchSchema,
  planDailyPlansPutSchema,
  registerSchema,
  tripPlanStatusSchema,
} from "@/lib/api-schemas";

const GECERLI_MANUEL_PLAN = {
  basicInfo: {
    destination: "Roma",
    country: "İtalya",
    startDate: "2026-05-01",
    endDate: "2026-05-05",
    travelers: 2,
    travelStyle: "kültür",
  },
  transport: null,
  accommodation: null,
  dailyPlans: [{ day: 1, activities: [], notes: "", isEmpty: true }],
  budget: {
    currentBudget: 20000,
    estimatedTotal: 18000,
    breakdown: {
      transport: 6000,
      accommodation: 8000,
      activities: 2000,
      food: 1500,
      other: 500,
    },
  },
};

describe("ilkHataMesaji", () => {
  it("alan hatasının mesajını döndürür", () => {
    // Asıl düzeltme: route'lar `error.format()._errors[0]` okuyordu ve o
    // dizi ALAN hatalarında daima boştu; kullanıcı şemadaki Türkçe mesaj
    // yerine hep genel yedek metni görüyordu.
    const sonuc = registerSchema.safeParse({
      name: "A",
      email: "gecersiz",
      password: "kisa",
    });

    expect(sonuc.success).toBe(false);
    if (sonuc.success) return;

    expect(sonuc.error.format()._errors[0]).toBeUndefined();
    expect(ilkHataMesaji(sonuc.error)).toContain("name");
    expect(ilkHataMesaji(sonuc.error)).toContain("en az 2 karakter");
  });

  it("kök hatasında yol öneki eklemez", () => {
    const sema = z.object({ a: z.number() }).refine(() => false, { message: "Kök hata" });
    const sonuc = sema.safeParse({ a: 1 });
    expect(sonuc.success).toBe(false);
    if (sonuc.success) return;
    expect(ilkHataMesaji(sonuc.error)).toBe("Kök hata");
  });
});

describe("planBudgetPatchSchema", () => {
  it("bütçe JSON'unu kabul eder", () => {
    expect(planBudgetPatchSchema.safeParse({ butce_tahmini: "{}" }).success).toBe(true);
  });

  it("tekil sayısal alanları kabul eder", () => {
    expect(planBudgetPatchSchema.safeParse({ total_cost: 1000 }).success).toBe(true);
  });

  it("sayısal olmayan tutarı reddeder", () => {
    // Eskiden `Number(body.total_cost)` NaN üretip Prisma'da patlıyordu.
    expect(planBudgetPatchSchema.safeParse({ total_cost: "bin lira" }).success).toBe(false);
    expect(planBudgetPatchSchema.safeParse({ total_cost: Number.NaN }).success).toBe(false);
  });

  it("negatif tutarı reddeder", () => {
    expect(planBudgetPatchSchema.safeParse({ total_cost: -5 }).success).toBe(false);
  });

  it("boş gövdeyi reddeder", () => {
    expect(planBudgetPatchSchema.safeParse({}).success).toBe(false);
  });

  it("aşırı büyük bütçe metnini reddeder", () => {
    const dev = "x".repeat(200_001);
    expect(planBudgetPatchSchema.safeParse({ butce_tahmini: dev }).success).toBe(false);
  });
});

describe("planDailyPlansPutSchema", () => {
  it("JSON metnini kabul eder", () => {
    expect(planDailyPlansPutSchema.safeParse({ daily_plans: "[]" }).success).toBe(true);
  });

  it("alan eksikse reddeder", () => {
    expect(planDailyPlansPutSchema.safeParse({}).success).toBe(false);
  });

  it("sınırın üstündeki metni reddeder", () => {
    expect(
      planDailyPlansPutSchema.safeParse({ daily_plans: "x".repeat(500_001) }).success
    ).toBe(false);
  });
});

describe("tripPlanStatusSchema", () => {
  it("geçerli durumu kabul eder", () => {
    expect(tripPlanStatusSchema.safeParse({ status: "CANCELLED" }).success).toBe(true);
    expect(tripPlanStatusSchema.safeParse({ status: "DONE" }).success).toBe(true);
  });

  it("Türkçe durum metinlerini reddeder", () => {
    // Arayüzde bir dönem 'PLANLANDI' gibi değerler dolaşıyordu.
    expect(tripPlanStatusSchema.safeParse({ status: "PLANLANDI" }).success).toBe(false);
  });

  it("durum zorunlu", () => {
    expect(tripPlanStatusSchema.safeParse({}).success).toBe(false);
    expect(tripPlanStatusSchema.safeParse({ status: "" }).success).toBe(false);
  });
});

describe("manualPlanSchema", () => {
  it("geçerli planı kabul eder", () => {
    expect(manualPlanSchema.safeParse(GECERLI_MANUEL_PLAN).success).toBe(true);
  });

  it("basicInfo yoksa reddeder (eskiden TypeError + 500 oluyordu)", () => {
    expect(manualPlanSchema.safeParse({}).success).toBe(false);
    expect(manualPlanSchema.safeParse({ budget: GECERLI_MANUEL_PLAN.budget }).success).toBe(false);
  });

  it("hedef şehir boşsa reddeder", () => {
    const bozuk = {
      ...GECERLI_MANUEL_PLAN,
      basicInfo: { ...GECERLI_MANUEL_PLAN.basicInfo, destination: "  " },
    };
    expect(manualPlanSchema.safeParse(bozuk).success).toBe(false);
  });

  it("negatif bütçeyi reddeder", () => {
    const bozuk = {
      ...GECERLI_MANUEL_PLAN,
      budget: { ...GECERLI_MANUEL_PLAN.budget, estimatedTotal: -1 },
    };
    expect(manualPlanSchema.safeParse(bozuk).success).toBe(false);
  });

  it("kişi sayısını sınırlar", () => {
    const bozuk = {
      ...GECERLI_MANUEL_PLAN,
      basicInfo: { ...GECERLI_MANUEL_PLAN.basicInfo, travelers: 0 },
    };
    expect(manualPlanSchema.safeParse(bozuk).success).toBe(false);
  });

  it("bilinmeyen alanları (userInfo gibi) sessizce atar", () => {
    const sonuc = manualPlanSchema.safeParse({
      ...GECERLI_MANUEL_PLAN,
      userInfo: { id: "baskasinin-id-si", email: "kotu@ornek.test" },
    });

    expect(sonuc.success).toBe(true);
    // Kimlik gövdeden ASLA okunmuyor; sunucu oturumdan çözüyor.
    expect(sonuc.success && "userInfo" in sonuc.data).toBe(false);
  });

  it("çok uzun günlük plan listesini reddeder", () => {
    const bozuk = {
      ...GECERLI_MANUEL_PLAN,
      dailyPlans: Array.from({ length: 61 }, (_, i) => ({
        day: Math.min(i + 1, 60),
        activities: [],
        notes: "",
        isEmpty: true,
      })),
    };
    expect(manualPlanSchema.safeParse(bozuk).success).toBe(false);
  });
});
