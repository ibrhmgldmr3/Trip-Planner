// TASLAK: Bu metin hukuki danışmanlık değildir ve yayına alınmadan önce
// bir hukuk danışmanı / veri koruma uzmanı tarafından gözden geçirilmelidir.
// [doldurulacak] işaretli alanlar (veri sorumlusu unvanı, adres, başvuru
// e-posta adresi, VERBİS kaydı, saklama süreleri) gerçek bilgilerle
// doldurulmadan yayınlanmamalıdır.

import type { Metadata } from "next";
import Link from "next/link";
import { KonturDoku, Serit } from "@/components/ui";

export const metadata: Metadata = {
  title: "Gizlilik Politikası - Trip Planner",
  description: "Trip Planner'ın hangi kişisel verileri neden işlediğine dair açıklama",
};

export default function PrivacyPage() {
  return (
    <div className="harita-zemin relative min-h-screen px-4 md:px-8 py-12 md:py-16 overflow-hidden">
      {/* Kontur dokusu: hukuki metin de uygulamanın yüzeyinde duruyor. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <KonturDoku yogunluk={0.45} />
      </div>

      <div className="relative mx-auto max-w-[68ch]">
        <div>
          <h1 className="font-[family-name:var(--font-serif)] text-3xl md:text-4xl text-[var(--fg)] mb-2">
            Gizlilik Politikası
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
                  { no: "01", ad: "Veri Sorumlusu", kimlik: "b-veri-sorumlusu" },
                  { no: "02", ad: "İşlenen Veriler", kimlik: "b-islenen-veriler" },
                  { no: "03", ad: "İşleme Amaçları ve Hukuki Sebep", kimlik: "b-isleme-amaclari-ve-hukuki-sebep" },
                  { no: "04", ad: "Aktarım ve Yurt Dışına Aktarım", kimlik: "b-aktarim-ve-yurt-disina-aktarim" },
                  { no: "05", ad: "Saklama Süresi", kimlik: "b-saklama-suresi" },
                  { no: "06", ad: "Haklarınız", kimlik: "b-haklariniz" },
                  { no: "07", ad: "Güvenlik", kimlik: "b-guvenlik" },
                  { no: "08", ad: "Çocukların Verileri", kimlik: "b-cocuklarin-verileri" },
                  { no: "09", ad: "Değişiklikler", kimlik: "b-degisiklikler" },
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
                id="b-veri-sorumlusu"
                className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-3 flex items-baseline gap-3 scroll-mt-24"
              >
                <span className="lejant text-[var(--route)] shrink-0">01</span>
                Veri Sorumlusu
              </h2>
              <p>
                Kişisel verileriniz, 6698 sayılı Kişisel Verilerin Korunması Kanunu
                (KVKK) ve ilgili olduğu ölçüde Avrupa Birliği Genel Veri Koruma Tüzüğü
                (GDPR) kapsamında, veri sorumlusu sıfatıyla [doldurulacak: işletme unvanı]
                tarafından işlenir.
              </p>
              <p className="mt-3">
                Adres: [doldurulacak]
                <br />
                Başvuru / iletişim: [doldurulacak: e-posta adresi]
                <br />
                VERBİS kaydı: [doldurulacak veya &quot;yükümlülük bulunmamaktadır&quot;]
              </p>
            </div>

            <div>
              <h2
                id="b-islenen-veriler"
                className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-3 flex items-baseline gap-3 scroll-mt-24"
              >
                <span className="lejant text-[var(--route)] shrink-0">02</span>
                İşlenen Veriler
              </h2>

              <h3 className="font-semibold text-[var(--fg)] mt-4 mb-1">
                Hesap verileri
              </h3>
              <p>
                Ad, e-posta adresi, şifrenizin geri döndürülemez şekilde şifrelenmiş
                (hash) hâli, hesap oluşturma ve güncelleme tarihleri. Google ile giriş
                yapmayı seçerseniz Google&apos;dan gelen kimlik bilgisi, profil görseli
                ve oturum jetonları da saklanır. Düz metin şifre hiçbir zaman saklanmaz.
              </p>

              <h3 className="font-semibold text-[var(--fg)] mt-4 mb-1">
                Seyahat planı verileri
              </h3>
              <p>
                Oluşturduğunuz planlara ait şehir, ülke, başlangıç ve bitiş tarihleri,
                gün sayısı, bütçe düzeyi ve tahmini maliyet, seyahat tarzı, günlük rota
                adımları, aktiviteler, notlar, konaklama ve ulaşım tercihleri, plan
                durumu (planlandı / tamamlandı / iptal) ve tamamlanma tarihi.
              </p>

              <h3 className="font-semibold text-[var(--fg)] mt-4 mb-1">
                Konum ve yer verileri
              </h3>
              <p>
                Planlarınızdaki duraklara ait yer tanımlayıcıları ve koordinatlar.
                Bunlar plandaki adreslerden ve harita üzerinde yaptığınız seçimlerden
                türetilir. Tarayıcınızın konum iznini yalnızca haritada konumunuzu
                göstermeniz için açıkça istediğinizde kullanırız; cihaz konumunuzu arka
                planda takip etmiyor ve sunucuya kaydetmiyoruz.
              </p>

              <h3 className="font-semibold text-[var(--fg)] mt-4 mb-1">
                Yapay zekâ sohbet verileri
              </h3>
              <p>
                Plan oluşturmak için yazdığınız istekler ve modelin ürettiği yanıtlar,
                planı yeniden görüntüleyebilmeniz için hesabınıza bağlı olarak saklanır.
              </p>

              <h3 className="font-semibold text-[var(--fg)] mt-4 mb-1">
                Teknik veriler
              </h3>
              <p>
                Oturum çerezleri ve oturum jetonları. Bunlar sizi oturum boyunca tanımak
                için zorunludur. Reklam veya profilleme amaçlı üçüncü taraf takip çerezi
                kullanmıyoruz.
              </p>
            </div>

            <div>
              <h2
                id="b-isleme-amaclari-ve-hukuki-sebep"
                className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-3 flex items-baseline gap-3 scroll-mt-24"
              >
                <span className="lejant text-[var(--route)] shrink-0">03</span>
                İşleme Amaçları ve Hukuki Sebep
              </h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Hesabınızı oluşturmak ve oturumu sürdürmek</strong> &mdash;
                  sözleşmenin kurulması ve ifası.
                </li>
                <li>
                  <strong>Seyahat planlarınızı üretmek, saklamak ve size göstermek</strong> &mdash;
                  sözleşmenin ifası.
                </li>
                <li>
                  <strong>Hizmet güvenliğini sağlamak, kötüye kullanımı önlemek</strong> &mdash;
                  meşru menfaat.
                </li>
                <li>
                  <strong>Yasal yükümlülüklere uymak</strong> &mdash; hukuki yükümlülük.
                </li>
              </ul>
              <p className="mt-3">
                Verilerinizi satmıyoruz ve rızanız olmadan pazarlama amacıyla
                kullanmıyoruz.
              </p>
            </div>

            <div>
              <h2
                id="b-aktarim-ve-yurt-disina-aktarim"
                className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-3 flex items-baseline gap-3 scroll-mt-24"
              >
                <span className="lejant text-[var(--route)] shrink-0">04</span>
                Aktarım ve Yurt Dışına Aktarım
              </h2>
              <p>
                Hizmetin çalışabilmesi için verilerin bir bölümü aşağıdaki sağlayıcılara
                aktarılır. Bu sağlayıcıların sunucuları yurt dışında bulunabilir:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-3">
                <li>
                  <strong>Google Maps Platform</strong> &mdash; harita, yer arama ve rota
                  hesaplaması için sorgulanan adres ve koordinatlar.
                </li>
                <li>
                  <strong>OpenRouter ve bağlı dil modeli sağlayıcıları</strong> &mdash;
                  plan üretimi için gönderdiğiniz istek metni ve plan parametreleri.
                  Bu istekler hesap kimliğinizi içermez.
                </li>
                <li>
                  <strong>Google kimlik doğrulama</strong> &mdash; yalnızca Google ile
                  giriş yapmayı seçerseniz.
                </li>
                <li>
                  <strong>[doldurulacak: barındırma ve veritabanı sağlayıcısı]</strong> &mdash;
                  uygulamanın ve veritabanının çalıştırılması.
                </li>
              </ul>
              <p className="mt-3">
                Yurt dışına aktarım, KVKK m.9 ve GDPR&apos;ın ilgili hükümlerinde
                öngörülen güvenceler çerçevesinde gerçekleştirilir.
              </p>
            </div>

            <div>
              <h2
                id="b-saklama-suresi"
                className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-3 flex items-baseline gap-3 scroll-mt-24"
              >
                <span className="lejant text-[var(--route)] shrink-0">05</span>
                Saklama Süresi
              </h2>
              <p>
                Hesap ve plan verileriniz, hesabınız açık olduğu sürece saklanır. Bir
                planı sildiğinizde ilgili kayıtlar veritabanından kaldırılır. Hesabınızı
                kapattığınızda hesabınıza bağlı planlar, sohbet kayıtları ve oturum
                bilgileri en geç [doldurulacak: gün sayısı] gün içinde silinir. Yasal
                saklama yükümlülüğü bulunan kayıtlar bu süreden bağımsız olarak
                mevzuatta öngörülen süre boyunca saklanır.
              </p>
            </div>

            <div>
              <h2
                id="b-haklariniz"
                className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-3 flex items-baseline gap-3 scroll-mt-24"
              >
                <span className="lejant text-[var(--route)] shrink-0">06</span>
                Haklarınız
              </h2>
              <p>
                KVKK m.11 ve GDPR kapsamında; kişisel verilerinizin işlenip
                işlenmediğini öğrenme, verilere erişme, düzeltilmesini veya silinmesini
                isteme, işlemenin sınırlandırılmasını talep etme, verilerinizi taşınabilir
                bir formatta alma ve meşru menfaate dayalı işlemeye itiraz etme
                haklarına sahipsiniz.
              </p>
              <p className="mt-3">
                Taleplerinizi [doldurulacak: başvuru e-posta adresi] adresine
                iletebilirsiniz. Başvurular en geç 30 gün içinde sonuçlandırılır.
                Sonuçtan memnun kalmazsanız Kişisel Verileri Koruma Kurumu&apos;na veya
                bulunduğunuz ülkedeki yetkili denetim makamına şikâyette bulunabilirsiniz.
              </p>
            </div>

            <div>
              <h2
                id="b-guvenlik"
                className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-3 flex items-baseline gap-3 scroll-mt-24"
              >
                <span className="lejant text-[var(--route)] shrink-0">07</span>
                Güvenlik
              </h2>
              <p>
                Şifreler tek yönlü hash algoritmasıyla saklanır, oturumlar imzalı
                jetonlarla yürütülür ve veri tabanı erişimi yetkilendirilmiş servislerle
                sınırlıdır. Hiçbir sistem mutlak güvenlik sağlayamaz; bir veri ihlali
                yaşanması hâlinde mevzuatta öngörülen süreler içinde ilgili kişileri ve
                yetkili makamı bilgilendiririz.
              </p>
            </div>

            <div>
              <h2
                id="b-cocuklarin-verileri"
                className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-3 flex items-baseline gap-3 scroll-mt-24"
              >
                <span className="lejant text-[var(--route)] shrink-0">08</span>
                Çocukların Verileri
              </h2>
              <p>
                Hizmet 13 yaşından küçük kullanıcılara yönelik değildir ve bu yaş
                grubundan bilerek veri toplamayız. Böyle bir kaydın varlığını fark
                edersek sileriz.
              </p>
            </div>

            <div>
              <h2
                id="b-degisiklikler"
                className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-3 flex items-baseline gap-3 scroll-mt-24"
              >
                <span className="lejant text-[var(--route)] shrink-0">09</span>
                Değişiklikler
              </h2>
              <p>
                Bu politikayı güncelleyebiliriz. Önemli değişiklikleri uygulama içinde
                veya kayıtlı e-posta adresiniz üzerinden duyururuz.
              </p>
            </div>
          </section>

          <div className="mt-10 pt-6 border-t border-[var(--line)] flex flex-wrap gap-4">
            <Link
              href="/terms"
              className="px-4 py-2 bg-[var(--accent)] text-[var(--accent-contrast)] rounded-lg text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
            >
              Kullanım Şartları
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
