// TASLAK: Bu metin hukuki danışmanlık değildir ve yayına alınmadan önce
// bir hukuk danışmanı tarafından gözden geçirilmelidir. İçindeki
// [doldurulacak] işaretli alanlar (şirket unvanı, adres, iletişim adresi,
// yürürlük tarihi) gerçek bilgilerle doldurulmadan yayınlanmamalıdır.

import type { Metadata } from "next";
import Link from "next/link";
import { KonturDoku, Serit } from "@/components/ui";

export const metadata: Metadata = {
  title: "Kullanım Şartları - Trip Planner",
  description: "Trip Planner hizmetinin kullanım şartları ve koşulları",
};

export default function TermsPage() {
  return (
    <div className="harita-zemin relative min-h-screen px-4 md:px-8 py-12 md:py-16 overflow-hidden">
      {/* Kontur dokusu: hukuki metin de uygulamanın yüzeyinde duruyor. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <KonturDoku yogunluk={0.45} />
      </div>

      <div className="relative mx-auto max-w-[68ch]">
        <div>
          <h1 className="font-[family-name:var(--font-serif)] text-3xl md:text-4xl text-[var(--fg)] mb-2">
            Kullanım Şartları
          </h1>
          <p className="text-sm text-[var(--fg-muted)] mb-8">
            Son güncelleme: [doldurulacak] &middot; Yürürlük tarihi: [doldurulacak]
          </p>

          {/* Ölçek çubuğu: sayfanın nerede başladığını söyleyen işaret. */}
          <div className="flex items-center mb-10" aria-hidden="true">
            <span className="h-[3px] w-14 rounded-full bg-[var(--accent)]" />
            <span className="h-px flex-1 bg-[var(--line)]" />
          </div>

          {/* İçindekiler: 9–11 bölümlük bir metinde okuyucu aradığı
              maddeye doğrudan gitmeli. */}
          <nav
            aria-label="Bölümler"
            className="mb-12 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-5"
          >
            <p className="lejant text-[var(--fg-subtle)] mb-3">İçindekiler</p>
            <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
              {[
                  { no: "01", ad: "Taraflar ve Kapsam", kimlik: "b-taraflar-ve-kapsam" },
                  { no: "02", ad: "Hizmetin Tanımı", kimlik: "b-hizmetin-tanimi" },
                  { no: "03", ad: "Hesap ve Güvenlik", kimlik: "b-hesap-ve-guvenlik" },
                  { no: "04", ad: "Kabul Edilebilir Kullanım", kimlik: "b-kabul-edilebilir-kullanim" },
                  { no: "05", ad: "İçerik ve Yapay Zekâ Üretimi Uyarısı", kimlik: "b-icerik-ve-yapay-zeka-uretimi-uyarisi" },
                  { no: "06", ad: "Üçüncü Taraf Hizmetleri", kimlik: "b-ucuncu-taraf-hizmetleri" },
                  { no: "07", ad: "Fikri Mülkiyet", kimlik: "b-fikri-mulkiyet" },
                  { no: "08", ad: "Sorumluluğun Sınırlandırılması", kimlik: "b-sorumlulugun-sinirlandirilmasi" },
                  { no: "09", ad: "Hesabın Sonlandırılması", kimlik: "b-hesabin-sonlandirilmasi" },
                  { no: "10", ad: "Değişiklikler", kimlik: "b-degisiklikler" },
                  { no: "11", ad: "Uygulanacak Hukuk ve İletişim", kimlik: "b-uygulanacak-hukuk-ve-iletisim" },
              ].map((b) => (
                <li key={b.kimlik}>
                  <a
                    href={`#${b.kimlik}`}
                    className="group flex items-baseline gap-2.5 py-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--accent)] transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    <span className="lejant text-[var(--fg-subtle)] group-hover:text-[var(--route)] shrink-0">
                      {b.no}
                    </span>
                    {b.ad}
                  </a>
                </li>
              ))}
            </ol>
          </nav>


          <div className="mb-10">
            <Serit ton="uyari" baslik="Taslak metin">
              Bu sayfa henüz hukuki incelemeden geçmemiştir.
              Köşeli parantez içindeki alanlar doldurulmadan yayına alınmamalıdır.
            </Serit>
          </div>

          <section className="space-y-10 text-[var(--fg)] leading-[1.75]">
            <div>
              <h2
                id="b-taraflar-ve-kapsam"
                className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-3 flex items-baseline gap-3 scroll-mt-24"
              >
                <span className="lejant text-[var(--route)] shrink-0">01</span>
                Taraflar ve Kapsam
              </h2>
              <p>
                Bu şartlar, [doldurulacak: şirket/işletme unvanı] (&quot;Trip Planner&quot;,
                &quot;biz&quot;) tarafından sunulan seyahat planlama hizmetinin kullanımını
                düzenler. Hesap oluşturarak veya hizmeti kullanarak bu şartları kabul
                etmiş olursunuz. Kabul etmiyorsanız hizmeti kullanmamalısınız.
              </p>
            </div>

            <div>
              <h2
                id="b-hizmetin-tanimi"
                className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-3 flex items-baseline gap-3 scroll-mt-24"
              >
                <span className="lejant text-[var(--route)] shrink-0">02</span>
                Hizmetin Tanımı
              </h2>
              <p>
                Trip Planner; şehir seçimi, günlük rota oluşturma, bütçe tahmini ve
                harita üzerinde gezi noktalarını görüntüleme gibi planlama araçları sunar.
                Planların bir bölümü yapay zekâ modelleri tarafından üretilir.
              </p>
              <p className="mt-3">
                Hizmet <strong>yalnızca planlama amaçlıdır</strong>. Uygulama üzerinden
                uçak, otobüs, tren bileti veya konaklama rezervasyonu yapılmaz.
                Ulaşım sayfasındaki süre ve maliyet değerleri şehirler arası mesafeden
                hesaplanan <strong>tahminlerdir</strong>; sefer tarifesi ya da canlı
                bilet fiyatı değildir. Konaklama sayfası, fiyat bilgisi içeren harici
                siteleri listeler; oda müsaitliği ve kesin fiyat o sitelerin
                sorumluluğundadır.
              </p>
            </div>

            <div>
              <h2
                id="b-hesap-ve-guvenlik"
                className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-3 flex items-baseline gap-3 scroll-mt-24"
              >
                <span className="lejant text-[var(--route)] shrink-0">03</span>
                Hesap ve Güvenlik
              </h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Hesap açarken doğru ve güncel bilgi vermekle yükümlüsünüz.</li>
                <li>Şifrenizin gizliliğinden ve hesabınız üzerinden yapılan işlemlerden siz sorumlusunuz.</li>
                <li>Hesabınızın izinsiz kullanıldığını fark ederseniz bize bildirin: [doldurulacak: iletişim adresi].</li>
                <li>13 yaşından küçük kullanıcılar hesap oluşturamaz.</li>
              </ul>
            </div>

            <div>
              <h2
                id="b-kabul-edilebilir-kullanim"
                className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-3 flex items-baseline gap-3 scroll-mt-24"
              >
                <span className="lejant text-[var(--route)] shrink-0">04</span>
                Kabul Edilebilir Kullanım
              </h2>
              <p>Hizmeti kullanırken aşağıdakileri yapmamayı kabul edersiniz:</p>
              <ul className="list-disc pl-5 space-y-2 mt-3">
                <li>Yürürlükteki mevzuata aykırı veya üçüncü kişilerin haklarını ihlal eden içerik oluşturmak.</li>
                <li>Otomatik araçlarla hizmete aşırı yük bindirmek veya erişim kısıtlarını aşmaya çalışmak.</li>
                <li>Başka kullanıcıların verilerine yetkisiz erişmeye çalışmak.</li>
                <li>Hizmeti tersine mühendisliğe tabi tutmak veya güvenlik önlemlerini devre dışı bırakmak.</li>
              </ul>
            </div>

            <div>
              <h2
                id="b-icerik-ve-yapay-zeka-uretimi-uyarisi"
                className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-3 flex items-baseline gap-3 scroll-mt-24"
              >
                <span className="lejant text-[var(--route)] shrink-0">05</span>
                İçerik ve Yapay Zekâ Üretimi Uyarısı
              </h2>
              <p>
                Oluşturulan planlar, mesafe ve süre tahminleri ile bütçe hesapları
                bilgilendirme amaçlıdır ve hata içerebilir. Açılış saatleri, giriş
                ücretleri, ulaşım bağlantıları ve güvenlik durumu gibi bilgileri
                seyahatten önce resmî kaynaklardan doğrulamak sizin sorumluluğunuzdadır.
                Vize, sigorta ve sağlık gereklilikleri konusunda hiçbir taahhütte
                bulunmuyoruz.
              </p>
            </div>

            <div>
              <h2
                id="b-ucuncu-taraf-hizmetleri"
                className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-3 flex items-baseline gap-3 scroll-mt-24"
              >
                <span className="lejant text-[var(--route)] shrink-0">06</span>
                Üçüncü Taraf Hizmetleri
              </h2>
              <p>
                Hizmet; harita ve yer verileri için Google Maps Platform, yapay zekâ
                planlaması için OpenRouter üzerinden erişilen dil modelleri ve isteğe
                bağlı olarak Google ile oturum açma sağlayıcısını kullanır. Bu
                sağlayıcıların kendi şartları ve gizlilik politikaları geçerlidir.
              </p>
            </div>

            <div>
              <h2
                id="b-fikri-mulkiyet"
                className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-3 flex items-baseline gap-3 scroll-mt-24"
              >
                <span className="lejant text-[var(--route)] shrink-0">07</span>
                Fikri Mülkiyet
              </h2>
              <p>
                Uygulamanın arayüzü, kaynak kodu ve markası bize aittir. Oluşturduğunuz
                seyahat planları size aittir; hizmeti işletebilmek ve size sunabilmek
                için bu içeriği saklamamıza ve işlememize izin vermiş olursunuz.
              </p>
            </div>

            <div>
              <h2
                id="b-sorumlulugun-sinirlandirilmasi"
                className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-3 flex items-baseline gap-3 scroll-mt-24"
              >
                <span className="lejant text-[var(--route)] shrink-0">08</span>
                Sorumluluğun Sınırlandırılması
              </h2>
              <p>
                Hizmet &quot;olduğu gibi&quot; sunulur. Kesintisiz veya hatasız çalışacağına
                dair garanti verilmez. Mevzuatın izin verdiği azami ölçüde; hizmetin
                kullanımından doğan dolaylı zararlardan, kâr kaybından ve veri kaybından
                sorumlu tutulamayız. Bu sınırlama, tüketici mevzuatından doğan
                haklarınızı ortadan kaldırmaz.
              </p>
            </div>

            <div>
              <h2
                id="b-hesabin-sonlandirilmasi"
                className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-3 flex items-baseline gap-3 scroll-mt-24"
              >
                <span className="lejant text-[var(--route)] shrink-0">09</span>
                Hesabın Sonlandırılması
              </h2>
              <p>
                Hesabınızı dilediğiniz zaman kapatabilirsiniz. Bu şartların ağır ihlali
                hâlinde hesabınızı askıya alabilir veya kapatabiliriz. Hesap kapatıldığında
                verilerinizin ne kadar süre saklandığı{" "}
                <Link href="/privacy" className="text-[var(--accent)] hover:opacity-80 font-medium">
                  Gizlilik Politikası
                </Link>{" "}
                sayfasında açıklanmıştır.
              </p>
            </div>

            <div>
              <h2
                id="b-degisiklikler"
                className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-3 flex items-baseline gap-3 scroll-mt-24"
              >
                <span className="lejant text-[var(--route)] shrink-0">10</span>
                Değişiklikler
              </h2>
              <p>
                Bu şartları güncelleyebiliriz. Önemli değişiklikleri hesabınıza kayıtlı
                e-posta adresi üzerinden veya uygulama içinde duyururuz. Güncellemeden
                sonra hizmeti kullanmaya devam etmeniz yeni şartları kabul ettiğiniz
                anlamına gelir.
              </p>
            </div>

            <div>
              <h2
                id="b-uygulanacak-hukuk-ve-iletisim"
                className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-3 flex items-baseline gap-3 scroll-mt-24"
              >
                <span className="lejant text-[var(--route)] shrink-0">11</span>
                Uygulanacak Hukuk ve İletişim
              </h2>
              <p>
                Bu şartlara [doldurulacak: uygulanacak hukuk] uygulanır ve uyuşmazlıklarda
                [doldurulacak: yetkili mahkeme/icra daireleri] yetkilidir.
              </p>
              <p className="mt-3">
                İşletme unvanı: [doldurulacak]
                <br />
                Adres: [doldurulacak]
                <br />
                İletişim: [doldurulacak: e-posta adresi]
              </p>
            </div>
          </section>

          <div className="mt-10 pt-6 border-t border-[var(--line)] flex flex-wrap gap-4">
            <Link
              href="/privacy"
              className="px-4 py-2 bg-[var(--accent)] text-[var(--accent-contrast)] rounded-lg text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
            >
              Gizlilik Politikası
            </Link>
            <Link
              href="/"
              className="px-4 py-2 border border-[var(--line-strong)] text-[var(--fg-muted)] rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-[var(--surface-2)] transition-colors"
            >
              Ana Sayfaya Dön
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
