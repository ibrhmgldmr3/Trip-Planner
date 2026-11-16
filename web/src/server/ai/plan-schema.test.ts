import { describe, expect, it } from "vitest";
import { extractJson, parseAiPlan } from "./plan-schema";

const validPlan = {
  cityGuide: "İzmir hakkında",
  days: [
    {
      day: 1,
      title: "Kordon",
      stops: [
        { slot: "morning", time: "9:30", name: "Saat Kulesi", estimatedCost: 0, lat: 38.4189, lng: 27.1287 },
        { slot: "Akşam", time: "19.15", name: "Asansör", estimatedCost: "250 TL", lat: null, lng: null },
      ],
    },
  ],
  budget: [
    { category: "accommodation", description: "2 gece otel", amount: "3.600 TL" },
    { category: "bilinmeyen", description: "Diğer", amount: 500 },
  ],
};

describe("extractJson", () => {
  it("kod çitini ve düşünme bloğunu atar", () => {
    const text = `<think>plan yapıyorum {"a": 1}</think>\n\`\`\`json\n{"days": []}\n\`\`\`\nUmarım beğenirsin!`;
    expect(extractJson(text)).toEqual({ days: [] });
  });

  it("JSON yoksa hata verir", () => {
    expect(() => extractJson("Üzgünüm, plan hazırlayamadım.")).toThrow();
  });
});

describe("parseAiPlan", () => {
  it("geçerli planı normalleştirir", () => {
    const plan = parseAiPlan(JSON.stringify(validPlan));
    const [first, second] = plan.days[0].stops;

    expect(first).toMatchObject({ slot: "MORNING", time: "09:30", name: "Saat Kulesi", lat: 38.4189 });
    expect(second).toMatchObject({ slot: "EVENING", time: "19:15", estimatedCost: 250 });
    expect(second.lat).toBeUndefined();
  });

  it("tutarları Türkçe yazımdan çevirir ve tanınmayan kategoriyi 'diğer' sayar", () => {
    const plan = parseAiPlan(JSON.stringify(validPlan));
    expect(plan.budget).toEqual([
      { category: "ACCOMMODATION", description: "2 gece otel", amount: 3600 },
      { category: "OTHER", description: "Diğer", amount: 500 },
    ]);
  });

  it("bozuk durakları ve kalemleri atar, planın kalanını korur", () => {
    const plan = parseAiPlan(
      JSON.stringify({
        days: [{ day: 1, stops: [{ name: "" }, "metin", { name: "Kemeraltı" }] }],
        budget: [{ category: "food", description: "Yemek", amount: -5 }, { description: "eksik" }],
      })
    );
    expect(plan.days[0].stops.map((stop) => stop.name)).toEqual(["Kemeraltı"]);
    expect(plan.budget).toEqual([]);
  });

  it("durağı olmayan planı reddeder", () => {
    expect(() => parseAiPlan(JSON.stringify({ days: [{ day: 1, stops: [] }] }))).toThrow();
    expect(() => parseAiPlan(JSON.stringify({ cityGuide: "yalnızca metin" }))).toThrow();
  });

  it("bir günde en fazla 8 durak tutar", () => {
    const stops = Array.from({ length: 12 }, (_, index) => ({ name: `Durak ${index + 1}` }));
    expect(parseAiPlan(JSON.stringify({ days: [{ day: 1, stops }] })).days[0].stops).toHaveLength(8);
  });
});
