import PanelSidebar from "@/components/PanelSidebar";

/**
 * Hesap sayfalarının ortak düzeni: solda yan menü, sağda içerik.
 * Genişlik ve iç boşluk burada verilir; sayfalar kendi dış sarmalayıcısını eklemez.
 */
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-6 px-5 py-6 md:px-8 md:py-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
      <PanelSidebar />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
