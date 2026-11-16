import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, readBody, requireUserId, route } from "@/server/api";
import { profileUpdateSchema } from "@/server/validation";

const profileSelect = {
  name: true,
  email: true,
  preferredTransport: true,
  preferredCurrency: true,
  interests: true,
} as const;

type ProfileRow = {
  name: string | null;
  email: string | null;
  preferredTransport: string | null;
  preferredCurrency: string | null;
  interests: string | null;
};

/** İlgi alanları veritabanında JSON metni olarak durur; dışarıya dizi verilir. */
function toProfile(row: ProfileRow) {
  let interests: string[] = [];
  try {
    const parsed = row.interests ? JSON.parse(row.interests) : [];
    if (Array.isArray(parsed)) interests = parsed.filter((item): item is string => typeof item === "string");
  } catch {
    // Bozuk kayıt: boş liste.
  }
  return {
    name: row.name,
    email: row.email,
    preferredTransport: row.preferredTransport ?? "all",
    preferredCurrency: row.preferredCurrency ?? "TRY",
    interests,
  };
}

export const GET = route(async () => {
  const userId = await requireUserId();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: profileSelect });
  if (!user) throw new ApiError(404, "Kullanıcı bulunamadı.");
  return NextResponse.json({ profile: toProfile(user) });
});

export const PUT = route(async (request) => {
  const userId = await requireUserId();
  const { name, preferredTransport, preferredCurrency, interests } = await readBody(request, profileUpdateSchema);

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(name !== undefined && { name }),
      ...(preferredTransport !== undefined && { preferredTransport }),
      ...(preferredCurrency !== undefined && { preferredCurrency }),
      ...(interests !== undefined && { interests: JSON.stringify(interests) }),
    },
    select: profileSelect,
  });
  return NextResponse.json({ profile: toProfile(user) });
});
