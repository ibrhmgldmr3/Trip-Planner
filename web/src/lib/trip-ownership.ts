import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * `Trip` ve alt kayıtları için sahiplik kontrolü.
 *
 * NEDEN VAR: yedi rota "seyahati bul, userId eşleşiyor mu bak, yoksa 404 dön"
 * kalıbını elle tekrarlıyordu. Kopya kontrol, unutulan kontrol demektir —
 * denetimde tam olarak bu yüzden sahiplik filtresi bazı uçlarda sessizce
 * düşüyordu. Tek fonksiyona indirince yeni bir alt kaynak ucu yazarken
 * kontrolü atlamak zorlaşıyor.
 *
 * Kullanım:
 *   const sahiplik = await requireOwnedTrip(tripId, userId);
 *   if (!sahiplik.ok) return sahiplik.response;
 *   // sahiplik.trip artık güvenle kullanılabilir
 */

export type OwnershipResult<T> =
  | { ok: true; trip: T }
  | { ok: false; response: NextResponse };

/** Sahiplik kontrolünde okunan asgari seyahat alanları. */
export interface OwnedTrip {
  id: string;
  userId: string;
  startDate: Date;
  endDate: Date;
}

/**
 * Seyahatin var olduğunu ve kullanıcıya ait olduğunu doğrular.
 *
 * "Yok" ile "senin değil" ayrımını YAPMIYORUZ: 403 dönmek, id'yi bilen birine
 * o kaydın var olduğunu doğrular. İkisi de 404.
 */
export async function requireOwnedTrip(
  tripId: string | null | undefined,
  userId: string
): Promise<OwnershipResult<OwnedTrip>> {
  if (!tripId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Seyahat kimliği gereklidir" },
        { status: 400 }
      ),
    };
  }

  const trip = await prisma.trip.findFirst({
    where: { id: tripId, userId },
    select: { id: true, userId: true, startDate: true, endDate: true },
  });

  if (!trip) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Seyahat bulunamadı" },
        { status: 404 }
      ),
    };
  }

  return { ok: true, trip };
}

/** Alt kayıt tablolarının ortak arayüzü; `tripId` üzerinden sahiplik kurulur. */
type AltKayitDelegesi = {
  findUnique: (args: {
    where: { id: string };
    select: { id: true; tripId: true };
  }) => Promise<{ id: string; tripId: string } | null>;
};

/**
 * Alt kaydın (bütçe kalemi, günlük plan, konaklama, ulaşım) kullanıcıya ait
 * bir seyahate bağlı olduğunu doğrular.
 *
 * İki adımda yapılıyor: önce kayıt okunuyor, sonra onun `tripId`'si sahiplik
 * kontrolünden geçiyor. Tek sorguda `trip: { userId }` ile de yapılabilirdi
 * ama o zaman her çağıran `include` şeklini kendi yazmak zorunda kalıyor.
 */
export async function requireOwnedSubresource(
  delege: AltKayitDelegesi,
  kayitId: string | null | undefined,
  userId: string,
  bulunamadiMesaji = "Kayıt bulunamadı"
): Promise<OwnershipResult<OwnedTrip>> {
  if (!kayitId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Kayıt kimliği gereklidir" },
        { status: 400 }
      ),
    };
  }

  const kayit = await delege.findUnique({
    where: { id: kayitId },
    select: { id: true, tripId: true },
  });

  if (!kayit) {
    return {
      ok: false,
      response: NextResponse.json({ error: bulunamadiMesaji }, { status: 404 }),
    };
  }

  const sahiplik = await requireOwnedTrip(kayit.tripId, userId);
  if (!sahiplik.ok) {
    // Seyahat başkasınınsa alt kayıt da yok sayılır — aynı gerekçe.
    return {
      ok: false,
      response: NextResponse.json({ error: bulunamadiMesaji }, { status: 404 }),
    };
  }

  return sahiplik;
}
