'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import {
  Dugme,
  GirisGerekli,
  Ikon,
  Kocan,
  KonturDoku,
  Olcum,
  SayfaBasi,
  SayfaKabugu,
  Yukleniyor,
  cx,
} from "@/components/ui";

/**
 * Planlama modu seçimi — yol ayrımı.
 *
 * Bu sayfa tek bir karar aldırıyor: hangi yoldan gideceksiniz. Kartografik
 * karşılığı bir YOL AYRIMI, o yüzden her seçenek kendi rota eskiziyle
 * geliyor — AI tek çekişte çizilen yumuşak bir hat, adım adım mod ise
 * kendi koyduğunuz noktalardan geçen kırıklı bir hat. İki eskiz, iki
 * çalışma biçimi; metni okumadan önce fark görülüyor.
 *
 * BU TURDA DÜZELTİLEN GERÇEK HATALAR:
 *  - Aksan zemin üzerinde `text-[var(--accent)]` vardı: alt başlık kendi
 *    zeminiyle aynı renkti, yani GÖRÜNMÜYORDU. Aynı yerde `text-[var(--ok)]`
 *    de kullanılmıştı — yeşil metin teal zeminde okunmuyordu.
 *  - Onay işaretleri unicode "✓" karakteriydi: fonttan fonta kayıyor ve
 *    ekran okuyucuda metin olarak okunuyordu. Artık çizilmiş ikon.
 *  - "Hangi Mod Size Uygun?" bölümü kartların söylediğini tekrar ediyordu.
 *    İçerik kartların içine taşındı; kullanıcı kararı tek yerde veriyor.
 *  - `text-3xl font-bold` + `rounded-3xl`: sayfa sistemin dışındaydı.
 */

/* -------------------------------------------------------------------------- */

const yaziOrtak = {
  fill: "none" as const,
  viewBox: "0 0 24 24",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

interface Kazanim {
  baslik: string;
  aciklama: string;
  ikon: React.ReactNode;
}

interface Mod {
  anahtar: "ai" | "manuel";
  baslik: string;
  ozet: string;
  sure: string;
  rota: string;
  kazanimlar: Kazanim[];
  kimIcin: string[];
  eylem: string;
}

const MODLAR: Mod[] = [
  {
    anahtar: "ai",
    baslik: "Yapay zekâ ile",
    ozet:
      "Şehri, tarihleri ve bütçenizi girin; günlük program, öneriler ve kalem kalem bütçe taslak olarak gelsin.",
    sure: "2–3 dk",
    rota: "/ai-planner",
    kazanimlar: [
      {
        baslik: "Tek seferde taslak",
        aciklama: "Program, yeme-içme ve bütçe birlikte üretilir.",
        ikon: (
          <svg {...yaziOrtak} className="h-4 w-4">
            <path d="M12 3.5l1.6 4.4 4.4 1.6-4.4 1.6L12 15.5l-1.6-4.4L6 9.5l4.4-1.6z" />
          </svg>
        ),
      },
      {
        baslik: "İlgi alanına göre",
        aciklama: "Tarih, mutfak, müze — neye önem verdiğinizi söylersiniz.",
        ikon: (
          <svg {...yaziOrtak} className="h-4 w-4">
            <path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
        ),
      },
      {
        baslik: "Sonra düzenlenebilir",
        aciklama: "Taslak kilitli değil; her kalemi kendiniz değiştirirsiniz.",
        ikon: (
          <svg {...yaziOrtak} className="h-4 w-4">
            <path d="M4 20h4l10-10a2.5 2.5 0 10-3.5-3.5L4.5 16.5 4 20z" />
          </svg>
        ),
      },
    ],
    kimIcin: [
      "İlk kez seyahat planlıyorsanız",
      "Hızlıca bir başlangıç noktası istiyorsanız",
      "Yeni yerler keşfetmeye açıksanız",
    ],
    eylem: "Yapay zekâ ile planla",
  },
  {
    anahtar: "manuel",
    baslik: "Adım adım",
    ozet:
      "Ulaşım, konaklama ve aktiviteleri sırayla kendiniz girin. Her kalem sizin koyduğunuz gibi kalır.",
    sure: "10–15 dk",
    rota: "/manual-planner",
    kazanimlar: [
      {
        baslik: "Tam kontrol",
        aciklama: "Hiçbir kalem sizin onayınız olmadan plana girmez.",
        ikon: (
          <svg {...yaziOrtak} className="h-4 w-4">
            <path d="M12 3l7 3v5.5c0 4.3-2.9 8.1-7 9.5-4.1-1.4-7-5.2-7-9.5V6l7-3z" />
          </svg>
        ),
      },
      {
        baslik: "Bölüm bölüm",
        aciklama: "Ulaşım, konaklama ve aktiviteler ayrı adımlarda.",
        ikon: (
          <svg {...yaziOrtak} className="h-4 w-4">
            <path d="M4 6h16M4 12h16M4 18h9" />
          </svg>
        ),
      },
      {
        baslik: "Kesin bütçe",
        aciklama: "Gerçek fiyatları girersiniz, toplam tahmin değil ölçüdür.",
        ikon: (
          <svg {...yaziOrtak} className="h-4 w-4">
            <path d="M3 7a2 2 0 012-2h11a1 1 0 011 1v2M3 7v11a2 2 0 002 2h14a1 1 0 001-1v-3M3 7h17a1 1 0 011 1v3h-5a2 2 0 100 4h5" />
          </svg>
        ),
      },
    ],
    kimIcin: [
      "Daha önce plan yaptıysanız",
      "Bütçe konusunda titizseniz",
      "Özel gereksinimleriniz varsa",
    ],
    eylem: "Adım adım planla",
  },
];

/* -------------------------------------------------------------------------- */
/* Rota eskizleri — iki çalışma biçiminin görsel farkı                        */
/* -------------------------------------------------------------------------- */

/** Yapay zekâ: tek çekişte çizilmiş yumuşak bir hat. */
function EskizAi() {
  return (
    <svg viewBox="0 0 300 96" className="w-full h-auto block" aria-hidden="true">
      <path
        d="M22 74C70 74 78 22 150 22S238 66 278 30"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeDasharray="320"
        className="rota-ciz"
        style={{ ["--rota-uzunluk" as string]: "320" }}
      />
      <circle cx="22" cy="74" r="5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
      <circle cx="278" cy="30" r="5" fill="var(--accent)" />
    </svg>
  );
}

/** Adım adım: kendi koyduğunuz noktalardan geçen kırıklı hat. */
function EskizManuel() {
  const noktalar = [22, 86, 150, 214, 278];
  const yukseklik = [74, 44, 60, 30, 52];

  return (
    <svg viewBox="0 0 300 96" className="w-full h-auto block" aria-hidden="true">
      <polyline
        points={noktalar.map((x, i) => `${x},${yukseklik[i]}`).join(" ")}
        fill="none"
        stroke="var(--route-vivid)"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="320"
        className="rota-ciz"
        style={{ ["--rota-uzunluk" as string]: "320" }}
      />
      {noktalar.map((x, i) => (
        <rect
          key={x}
          x={x - 4.5}
          y={yukseklik[i] - 4.5}
          width="9"
          height="9"
          fill="var(--surface)"
          stroke="var(--route-vivid)"
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */

export default function TravelModePage() {
  const router = useRouter();
  const { status } = useSession();

  if (status === 'loading') {
    return (
      <SayfaKabugu>
        <Yukleniyor metin="Oturum kontrol ediliyor…" />
      </SayfaKabugu>
    );
  }

  if (status === 'unauthenticated') {
    return <GirisGerekli />;
  }

  const modaGit = (mod: Mod) => {
    toast.success(`${mod.baslik} planlamaya geçiliyor…`);
    router.push(mod.rota);
  };

  return (
    <SayfaKabugu>
      <SayfaBasi
        baslik="Nasıl planlamak istersiniz?"
        aciklama="İki yol da aynı plana çıkar. Fark, ilk taslağı kimin yazdığında: yapay zekâ mı, siz mi. Sonradan her kalemi düzenleyebilirsiniz."
      />

      <div className="grid md:grid-cols-2 gap-6">
        {MODLAR.map((mod) => {
          const aiMi = mod.anahtar === "ai";
          const vurgu = aiMi ? "var(--accent)" : "var(--route)";

          return (
            <section
              key={mod.anahtar}
              className={cx(
                "relative flex flex-col overflow-hidden rounded-[var(--radius-lg)]",
                "bg-[var(--surface)] border border-[var(--line)] shadow-[var(--shadow-kart)]",
                "transition-[border-color,box-shadow] duration-200 hover:shadow-[var(--shadow-pop)]",
                aiMi ? "hover:border-[var(--accent-border)]" : "hover:border-[var(--route-border)]"
              )}
            >
              {/* Rota eskizi: iki modun farkı metinden önce görünüyor. */}
              <div className="relative border-b border-[var(--line)] bg-[var(--surface-2)] px-6 pt-6 pb-2">
                <KonturDoku yogunluk={0.6} />
                <div className="relative">
                  <p className="lejant" style={{ color: vurgu }}>
                    {aiMi ? "Otomatik taslak" : "Elle kurulum"}
                  </p>
                  {aiMi ? <EskizAi /> : <EskizManuel />}
                </div>
              </div>

              <div className="flex flex-1 flex-col p-6">
                <h2 className="font-[family-name:var(--font-serif)] text-2xl text-[var(--fg)]">
                  {mod.baslik}
                </h2>
                <p className="text-[var(--fg-muted)] mt-2 leading-relaxed">{mod.ozet}</p>

                {/* Süre ölçülen bir değer: mono, tabular, lejant etiketli. */}
                <div className="mt-5">
                  <Olcum
                    etiket="Yaklaşık süre"
                    deger={mod.sure}
                    ton={aiMi ? "aksan" : "rota"}
                  />
                </div>

                <ul className="mt-6 space-y-3">
                  {mod.kazanimlar.map((kazanim) => (
                    <li key={kazanim.baslik} className="flex gap-3">
                      <span
                        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-[var(--radius-sm)] border"
                        style={{
                          color: vurgu,
                          borderColor: aiMi ? "var(--accent-border)" : "var(--route-border)",
                          backgroundColor: aiMi ? "var(--accent-soft)" : "var(--route-soft)",
                        }}
                      >
                        {kazanim.ikon}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium text-[var(--fg)]">
                          {kazanim.baslik}
                        </span>
                        <span className="block text-sm text-[var(--fg-muted)] leading-relaxed">
                          {kazanim.aciklama}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Koçan: "kime uygun" bölümü belgenin koparılabilir kısmı. */}
                <div className="mt-6">
                  <Kocan />
                </div>

                <p className="lejant text-[var(--fg-subtle)] mt-5">Şunlardan biriyseniz</p>
                <ul className="mt-2.5 space-y-1.5">
                  {mod.kimIcin.map((satir) => (
                    <li key={satir} className="flex items-start gap-2 text-sm text-[var(--fg-muted)]">
                      {/* Unicode "✓" değil, çizilmiş ikon. */}
                      <Ikon.Onay className="h-4 w-4 shrink-0 mt-0.5" />
                      {satir}
                    </li>
                  ))}
                </ul>

                {/* Eylem her zaman kartın dibinde: iki kart farklı uzunlukta
                    olsa da düğmeler aynı hizada duruyor. */}
                <div className="mt-auto pt-7">
                  <Dugme
                    tur={aiMi ? "birincil" : "rota"}
                    boy="lg"
                    className="w-full"
                    onClick={() => modaGit(mod)}
                  >
                    {mod.eylem}
                    <Ikon.Sag className="h-4 w-4" />
                  </Dugme>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <p className="text-sm text-[var(--fg-subtle)] mt-8 text-center max-w-[60ch] mx-auto leading-relaxed">
        Kararsızsanız yapay zekâ ile başlayın: gelen taslağı adım adım düzenlemek,
        boş sayfadan başlamaktan hızlıdır.
      </p>
    </SayfaKabugu>
  );
}
