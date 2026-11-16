import type { Metadata } from "next";
import ExploreView, { type CoverUrls } from "@/components/explore/ExploreView";
import { DESTINATIONS, coverRef } from "@/lib/destinations";
import { coverKey, getCityCovers } from "@/server/covers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Keşfet",
  description: "Türkiye’de keşfedilecek rotalar: seyahat türüne, süreye ve bölgeye göre filtrele, planını başlat.",
};

async function loadCovers(): Promise<CoverUrls> {
  // Kapaklar tek istekte alınır; hata olursa kartlar renk geçişiyle görünür.
  try {
    const covers = await getCityCovers(DESTINATIONS.map(coverRef));
    return Object.fromEntries(
      DESTINATIONS.map((destination) => {
        const cover = covers.get(coverKey(destination.name));
        return [destination.name, { imageUrl: cover?.imageUrl ?? null, pageUrl: cover?.pageUrl ?? null }];
      })
    );
  } catch (error) {
    console.warn("[explore] Kapaklar alınamadı:", error instanceof Error ? error.message : error);
    return {};
  }
}

export default async function ExplorePage() {
  const covers = await loadCovers();
  return <ExploreView destinations={DESTINATIONS} covers={covers} />;
}
