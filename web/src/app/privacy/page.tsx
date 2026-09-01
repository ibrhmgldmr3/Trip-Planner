// TASLAK: Bu metin hukuki danışmanlık değildir ve yayına alınmadan önce
// bir hukuk danışmanı / veri koruma uzmanı tarafından gözden geçirilmelidir.
// [doldurulacak] işaretli alanlar (veri sorumlusu unvanı, adres, başvuru
// e-posta adresi, VERBİS kaydı, saklama süreleri) gerçek bilgilerle
// doldurulmadan yayınlanmamalıdır.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Gizlilik Politikası - Trip Planner",
  description: "Trip Planner'ın hangi kişisel verileri neden işlediğine dair açıklama",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 md:px-8 py-12 md:py-16">
      <div className="mx-auto max-w-[68ch]">
        <div>
          <h1 className="font-[family-name:var(--font-serif)] text-3xl md:text-4xl text-[var(--fg)] mb-2">
            Gizlilik Politikası
          </h1>
          <p className="text-sm text-[var(--fg-muted)] mb-8">
            Son güncelleme: [doldurulacak] &middot; Yürürlük tarihi: [doldurulacak]
          </p>

          <div className="rounded-[var(--radius)] bg-[var(--warn-soft)] p-4 mb-8">
            <p className="text-sm text-[var(--warn)] leading-relaxed">
              <strong>Taslak metin.</strong> Bu sayfa henüz hukuki incelemeden geçmemiştir.
              Köşeli parantez içindeki alanlar doldurulmadan yayına alınmamalıdır.
            </p>
          </div>

          <section className="space-y-8 text-[var(--fg-muted)] leading-relaxed">
            <div>
              <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-2">
                1. Veri Sorumlusu
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
              <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-2">
                2. İşlenen Veriler
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
              <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-2">
                3. İşleme Amaçları ve Hukuki Sebep
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
              <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-2">
                4. Aktarım ve Yurt Dışına Aktarım
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
              <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-2">
                5. Saklama Süresi
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
              <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-2">
                6. Haklarınız
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
              <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-2">
                7. Güvenlik
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
              <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-2">
                8. Çocukların Verileri
              </h2>
              <p>
                Hizmet 13 yaşından küçük kullanıcılara yönelik değildir ve bu yaş
                grubundan bilerek veri toplamayız. Böyle bir kaydın varlığını fark
                edersek sileriz.
              </p>
            </div>

            <div>
              <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-2">
                9. Değişiklikler
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
    </main>
  );
}
