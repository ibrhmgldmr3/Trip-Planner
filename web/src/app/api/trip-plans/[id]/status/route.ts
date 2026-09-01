import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth-session';
import { tripPlanStatusSchema, ilkHataMesaji } from '@/lib/api-schemas';
import { planDurumunuGuncelle } from '@/lib/plan-status-service';
import { logger } from "@/lib/logger";

/**
 * Plan durumunu günceller.
 *
 * Plan durumunu değiştirmenin TEK ucu. İş mantığı
 * `src/lib/plan-status-service.ts` içinde; geçiş kuralları orada zorlanıyor.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = tripPlanStatusSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: ilkHataMesaji(parsed.error, 'Geçersiz durum') },
        { status: 400 }
      );
    }

    const sonuc = await planDurumunuGuncelle(id, auth.user.id, parsed.data.status);
    if (!sonuc.ok) return sonuc.response;

    return NextResponse.json(sonuc.plan);
  } catch (error) {
    logger.error("Plan statüsü güncellenemedi", error);
    return NextResponse.json(
      { error: 'Plan durumu güncellenemedi' },
      { status: 500 }
    );
  }
}
