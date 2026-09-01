import { describe, expect, it } from "vitest";
import { serializeStructuredPlan } from "@/lib/trip-plan-serialize";
import {
  tripPlanJsonSchema,
  tripPlanStructuredSchema,
  type TripPlanStructured,
} from "@/lib/trip-plan-schema";

/**
 * Serileştirmenin `source` alanına dair davranışı (Faz C).
 *
 * Buradaki asıl sözleşme: model çıktısı GÜVENİLMEZ. `source` bütçe
 * sayfasında tıklanabilir bir bağlantıya dönüştüğü için serileştirme
 * sırasında filtreleniyor — ama geçersiz bir URL koca bir planı
 * reddettirmemeli.
 */

function planIskeleti(): TripPlanStructured {
  return tripPlanStructuredSchema.parse({
    city: "Roma",
    country: "İtalya",
    durationDays: 1,
    cityInfo: {
      summary: "Özet",
      population: "1M",
      climate: "Ilıman",
      currency: "EUR",
      bestTimeToVisit: "İlkbahar",
    },
    days: [{ day: 1, title: "1. gün", activities: [], notes: "" }],
    foodGuide: { restaurants: [], localDishes: [], budgetTips: [] },
    practicalInfo: { transportation: [], safety: [], notes: [] },
    budget: {
      categories: {
        "ulaşım": { items: [], total: 0 },
        konaklama: { items: [], total: 0 },
        yemek: { items: [], total: 0 },
        aktiviteler: { items: [], total: 0 },
        diğer: { items: [], total: 0 },
      },
      total: 0,
      dailyAverage: 0,
    },
  });
}

/** Konaklama kategorisine tek bir kalem koyan plan üretir. */
function konaklamaKalemli(kalem: Record<string, unknown>): TripPlanStructured {
  const plan = planIskeleti();
  plan.budget.categories.konaklama = {
    items: [kalem as never],
    total: Number(kalem.amount) || 0,
  };
  plan.budget.total = Number(kalem.amount) || 0;
  return plan;
}

function konaklamaKalemleri(plan: TripPlanStructured) {
  const butce = JSON.parse(serializeStructuredPlan(plan).butce_tahmini);
  return butce.categories.konaklama.items as Array<Record<string, unknown>>;
}

describe("tripPlanStructuredSchema — source alanı", () => {
  it("eksik source'u boş stringe düşürür (plan reddedilmez)", () => {
    // `json_object` ve düz prompt stratejilerinde model alanı atlayabiliyor;
    // `.default("")` sayesinde bu bir doğrulama hatası değil.
    const parsed = tripPlanStructuredSchema.safeParse({
      ...planIskeleti(),
      budget: {
        ...planIskeleti().budget,
        categories: {
          ...planIskeleti().budget.categories,
          konaklama: { items: [{ description: "Otel", amount: 6000 }], total: 6000 },
        },
      },
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.budget.categories.konaklama.items[0].source).toBe("");
  });

  it("JSON Schema'da source yine de required kalır (strict mod şartı)", () => {
    // OpenRouter `strict: true` şemadaki TÜM alanların `required` olmasını
    // istiyor; `.default()` bunu bozmamalı.
    const sema = tripPlanJsonSchema() as Record<string, unknown>;
    const kalem = (
      (
        (
          (sema.properties as Record<string, Record<string, unknown>>).budget
            .properties as Record<string, Record<string, unknown>>
        ).categories.properties as Record<string, Record<string, unknown>>
      ).konaklama.properties as Record<string, Record<string, unknown>>
    ).items.items as Record<string, unknown>;

    expect(kalem.required).toEqual(
      expect.arrayContaining(["description", "amount", "source"])
    );
  });
});

describe("serializeStructuredPlan — source alanı", () => {
  it("geçerli http(s) kaynağını kaleme taşır", () => {
    const kalemler = konaklamaKalemleri(
      konaklamaKalemli({ description: "Otel", amount: 6000, source: "https://otel.test/x" })
    );

    expect(kalemler[0].source).toBe("https://otel.test/x");
  });

  it("boş source alanını hiç yazmaz", () => {
    const kalemler = konaklamaKalemleri(
      konaklamaKalemli({ description: "Otel", amount: 6000, source: "" })
    );

    expect(kalemler[0]).not.toHaveProperty("source");
  });

  it("tehlikeli şemayı düşürür ama kalemi ve tutarı korur", () => {
    const kalemler = konaklamaKalemleri(
      konaklamaKalemli({ description: "Otel", amount: 6000, source: "javascript:alert(1)" })
    );

    expect(kalemler[0]).not.toHaveProperty("source");
    expect(kalemler[0].amount).toBe(6000);
    expect(kalemler[0].description).toBe("Otel");
  });

  it("URL olmayan serbest metni düşürür", () => {
    const kalemler = konaklamaKalemleri(
      konaklamaKalemli({ description: "Otel", amount: 6000, source: "booking sitesinden" })
    );

    expect(kalemler[0]).not.toHaveProperty("source");
  });
});
