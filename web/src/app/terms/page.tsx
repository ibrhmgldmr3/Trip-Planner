// TASLAK: Bu metin hukuki danışmanlık değildir ve yayına alınmadan önce
// bir hukuk danışmanı tarafından gözden geçirilmelidir. İçindeki
// [doldurulacak] işaretli alanlar (şirket unvanı, adres, iletişim adresi,
// yürürlük tarihi) gerçek bilgilerle doldurulmadan yayınlanmamalıdır.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kullanım Şartları - Trip Planner",
  description: "Trip Planner hizmetinin kullanım şartları ve koşulları",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 md:px-8 py-12 md:py-16">
      <div className="mx-auto max-w-[68ch]">
        <div>
          <h1 className="font-[family-name:var(--font-serif)] text-3xl md:text-4xl text-[var(--fg)] mb-2">
            Kullanım Şartları
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
                1. Taraflar ve Kapsam
              </h2>
              <p>
                Bu şartlar, [doldurulacak: şirket/işletme unvanı] (&quot;Trip Planner&quot;,
                &quot;biz&quot;) tarafından sunulan seyahat planlama hizmetinin kullanımını
                düzenler. Hesap oluşturarak veya hizmeti kullanarak bu şartları kabul
                etmiş olursunuz. Kabul etmiyorsanız hizmeti kullanmamalısınız.
              </p>
            </div>

            <div>
              <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-2">
                2. Hizmetin Tanımı
              </h2>
              <p>
                Trip Planner; şehir seçimi, günlük rota oluşturma, bütçe tahmini ve
                harita üzerinde gezi noktalarını görüntüleme gibi planlama araçları sunar.
                Planların bir bölümü yapay zekâ modelleri tarafından üretilir.
              </p>
              <p className="mt-3">
                Hizmet <strong>yalnızca planlama amaçlıdır</strong>. Uygulama üzerinden
                uçak, otobüs, tren bileti veya konaklama rezervasyonu yapılmaz; ulaşım ve
                konaklama sayfalarındaki fiyat ve sefer bilgileri şu an demo verisidir ve
                gerçek satın alma imkânı sunmaz.
              </p>
            </div>

            <div>
              <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-2">
                3. Hesap ve Güvenlik
              </h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Hesap açarken doğru ve güncel bilgi vermekle yükümlüsünüz.</li>
                <li>Şifrenizin gizliliğinden ve hesabınız üzerinden yapılan işlemlerden siz sorumlusunuz.</li>
                <li>Hesabınızın izinsiz kullanıldığını fark ederseniz bize bildirin: [doldurulacak: iletişim adresi].</li>
                <li>13 yaşından küçük kullanıcılar hesap oluşturamaz.</li>
              </ul>
            </div>

            <div>
              <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-2">
                4. Kabul Edilebilir Kullanım
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
              <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-2">
                5. İçerik ve Yapay Zekâ Üretimi Uyarısı
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
              <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-2">
                6. Üçüncü Taraf Hizmetleri
              </h2>
              <p>
                Hizmet; harita ve yer verileri için Google Maps Platform, yapay zekâ
                planlaması için OpenRouter üzerinden erişilen dil modelleri ve isteğe
                bağlı olarak Google ile oturum açma sağlayıcısını kullanır. Bu
                sağlayıcıların kendi şartları ve gizlilik politikaları geçerlidir.
              </p>
            </div>

            <div>
              <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-2">
                7. Fikri Mülkiyet
              </h2>
              <p>
                Uygulamanın arayüzü, kaynak kodu ve markası bize aittir. Oluşturduğunuz
                seyahat planları size aittir; hizmeti işletebilmek ve size sunabilmek
                için bu içeriği saklamamıza ve işlememize izin vermiş olursunuz.
              </p>
            </div>

            <div>
              <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-2">
                8. Sorumluluğun Sınırlandırılması
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
              <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-2">
                9. Hesabın Sonlandırılması
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
              <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-2">
                10. Değişiklikler
              </h2>
              <p>
                Bu şartları güncelleyebiliriz. Önemli değişiklikleri hesabınıza kayıtlı
                e-posta adresi üzerinden veya uygulama içinde duyururuz. Güncellemeden
                sonra hizmeti kullanmaya devam etmeniz yeni şartları kabul ettiğiniz
                anlamına gelir.
              </p>
            </div>

            <div>
              <h2 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mb-2">
                11. Uygulanacak Hukuk ve İletişim
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
    </main>
  );
}
