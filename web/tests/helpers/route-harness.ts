import { NextRequest } from "next/server";

/**
 * Route handler testleri için küçük yardımcılar.
 *
 * Handler'lar `NextRequest` alıp `NextResponse` döndüren sade fonksiyonlar;
 * bir sunucu ayağa kaldırmadan doğrudan çağrılabiliyorlar. Eksik olan tek
 * şey Prisma ve oturum; ikisi de `vi.mock` ile değiştiriliyor
 * (bkz. tests/routes/*.test.ts başlıkları).
 */

/** JSON gövdeli bir istek üretir. */
export function jsonIstek(
  url: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown
): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Gövdesiz (GET/DELETE) istek üretir. */
export function istek(url: string, method: "GET" | "DELETE" = "GET"): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), { method });
}

/**
 * App Router'ın dinamik segment sözleşmesi: `params` bir Promise.
 *
 * Jenerik: handler'lar `Promise<{ id: string }>` bekliyor; `Record<string,
 * string>` döndürmek çağrı yerinde tip hatası veriyordu.
 */
export function params<T extends Record<string, string>>(değerler: T) {
  return { params: Promise.resolve(değerler) };
}

/** Yanıtın durum kodunu ve JSON gövdesini birlikte okur. */
export async function yanit(
  response: Response
): Promise<{ status: number; body: Record<string, unknown> }> {
  const metin = await response.text();
  let body: Record<string, unknown> = {};

  if (metin) {
    try {
      body = JSON.parse(metin);
    } catch {
      body = { ham: metin };
    }
  }

  return { status: response.status, body };
}

/** `requireUser` başarılı sonucu. */
export function oturum(id: string, email = `${id}@ornek.test`) {
  return { ok: true as const, user: { id, email } };
}

/** `requireUser` başarısız sonucu (401). */
export function oturumYok() {
  return {
    ok: false as const,
    response: new Response(JSON.stringify({ error: "Giriş yapmanız gerekiyor" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    }),
  };
}

/* -------------------------------------------------------------------------- */
/* Örnek veri                                                                 */
/* -------------------------------------------------------------------------- */

export const AHMET = "kullanici-ahmet";
export const BURCU = "kullanici-burcu";

/** İki kullanıcı ve her birine ait birer seyahat içeren başlangıç verisi. */
export function ikiKullanicili() {
  const baslangic = new Date(2026, 4, 1, 12);
  const bitis = new Date(2026, 4, 5, 12);

  return {
    user: [
      { id: AHMET, email: "ahmet@ornek.test", name: "Ahmet" },
      { id: BURCU, email: "burcu@ornek.test", name: "Burcu" },
    ],
    trip: [
      {
        id: "gezi-ahmet",
        userId: AHMET,
        title: "Roma Gezisi",
        city: "Roma",
        country: "İtalya",
        startDate: baslangic,
        endDate: bitis,
        status: "PLANNED",
        budget: 10000,
        description: null,
        notes: null,
      },
      {
        id: "gezi-burcu",
        userId: BURCU,
        title: "Paris Gezisi",
        city: "Paris",
        country: "Fransa",
        startDate: baslangic,
        endDate: bitis,
        status: "PLANNED",
        budget: 8000,
        description: null,
        notes: null,
      },
    ],
    tripPlan: [
      {
        id: "plan-ahmet",
        userId: AHMET,
        city: "Roma",
        country: "İtalya",
        startDate: baslangic,
        endDate: bitis,
        status: "PLANNED",
        total_cost: 10000,
        daily_cost: 2000,
        butce_tahmini: JSON.stringify({
          categories: { "ulaşım": { items: [], total: 10000 } },
          currency: "TRY",
        }),
        gun_plani: JSON.stringify([{ day: 1, date: "2026-05-01", activities: [], notes: "" }]),
        sehir_bilgisi: null,
        pratik_bilgiler: null,
        tripId: null,
        migratedAt: null,
        completedAt: null,
      },
      {
        id: "plan-burcu",
        userId: BURCU,
        city: "Paris",
        country: "Fransa",
        startDate: baslangic,
        endDate: bitis,
        status: "PLANNED",
        total_cost: 8000,
        daily_cost: 1600,
        butce_tahmini: null,
        gun_plani: null,
        sehir_bilgisi: null,
        pratik_bilgiler: null,
        tripId: null,
        migratedAt: null,
        completedAt: null,
      },
    ],
    budgetItem: [
      {
        id: "kalem-ahmet",
        tripId: "gezi-ahmet",
        category: "ulaşım",
        description: "Uçak",
        amount: 4000,
        currency: "TRY",
        isEstimate: true,
        isPaid: false,
        date: null,
      },
      {
        id: "kalem-burcu",
        tripId: "gezi-burcu",
        category: "konaklama",
        description: "Otel",
        amount: 3000,
        currency: "TRY",
        isEstimate: true,
        isPaid: false,
        date: null,
      },
    ],
    dailyPlan: [
      {
        id: "gun-ahmet",
        tripId: "gezi-ahmet",
        date: new Date(2026, 4, 1),
        title: null,
        notes: null,
        activities: [],
      },
      {
        id: "gun-burcu",
        tripId: "gezi-burcu",
        date: new Date(2026, 4, 1),
        title: null,
        notes: null,
        activities: [],
      },
    ],
    accommodation: [
      {
        id: "konaklama-ahmet",
        tripId: "gezi-ahmet",
        name: "Hotel Roma",
        checkIn: baslangic,
        checkOut: bitis,
        price: 6000,
        priceUnit: "total",
        status: "pending",
      },
      {
        id: "konaklama-burcu",
        tripId: "gezi-burcu",
        name: "Hotel Paris",
        checkIn: baslangic,
        checkOut: bitis,
        price: 5000,
        priceUnit: "total",
        status: "pending",
      },
    ],
    transportation: [
      {
        id: "ulasim-ahmet",
        tripId: "gezi-ahmet",
        type: "ucak",
        departureTime: baslangic,
        arrivalTime: bitis,
        departureLocation: "İstanbul",
        arrivalLocation: "Roma",
        price: 4000,
        status: "pending",
      },
      {
        id: "ulasim-burcu",
        tripId: "gezi-burcu",
        type: "tren",
        departureTime: baslangic,
        arrivalTime: bitis,
        departureLocation: "İstanbul",
        arrivalLocation: "Paris",
        price: 3000,
        status: "pending",
      },
    ],
    aiConversation: [],
  };
}
