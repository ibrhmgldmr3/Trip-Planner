"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import Image from "next/image";
import { logger } from "@/lib/logger";
import {
  Alan,
  BagDugme,
  Dugme,
  GIRDI_SINIFI,
  GirisGerekli,
  Kocan,
  KonturDoku,
  Rozet,
  SayfaBasi,
  SayfaKabugu,
  Yukleniyor,
  cx,
} from "@/components/ui";
import { PlanTasima } from "@/components/PlanTasima";
import { EpostaDogrulama, HesapSilme } from "@/components/HesapYonetimi";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  /** Doğrulama damgası; null ise adres doğrulanmamış (B9). */
  emailVerified?: string | null;
  /**
   * Hesabın ŞİFRESİ var mı — değerin kendisi değil, varlığı.
   *
   * Hesap silme onayının şifre mi yoksa e-posta adresi mi isteyeceğini
   * belirliyor: yalnızca Google ile açılmış hesaplarda doğrulanacak bir
   * şifre yok.
   */
  sifreVar?: boolean;
  phone?: string;
  bio?: string;
  location?: string;
  birthDate?: string;
  image?: string;
  preferredTransport?: string;
  preferredCurrency?: string;
  interests?: string;
  preferences?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface UserStats {
  totalTrips: number;
  completedTrips: number;
  totalBudget: number;
  averageTripDuration: number;
  favoriteDestination?: string;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    bio: '',
    location: '',
    birthDate: '',
    preferredTransport: '',
    preferredCurrency: '',
    interests: ''
  });

  // Profil verilerini getir
  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/profile');
      
      if (!response.ok) {
        throw new Error('Profil bilgileri yüklenemedi');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setProfile(data.profile);
        setStats(data.stats);
        setEditForm({
          name: data.profile.name || '',
          phone: data.profile.phone || '',
          bio: data.profile.bio || '',
          location: data.profile.location || '',
          birthDate: data.profile.birthDate || '',
          preferredTransport: data.profile.preferredTransport || 'all',
          preferredCurrency: data.profile.preferredCurrency || 'TRY',
          interests: data.profile.interests || ''
        });
      }
    } catch (err) {
      logger.error("Profil yüklenemedi", err);
      toast.error('Profil bilgileri yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  // Profil güncelle
  const updateProfile = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/profile/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });

      if (!response.ok) {
        throw new Error('Profil güncellenemedi');
      }

      const data = await response.json();
      
      if (data.success) {
        setProfile(data.profile);
        setEditing(false);
        toast.success('Profil başarıyla güncellendi');
      }
    } catch (err) {
      logger.error("Profil güncellenemedi", err);
      toast.error('Profil güncellenirken hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated') {
      toast.error('Bu sayfayı görüntülemek için giriş yapmanız gerekiyor');
      router.push('/login');
      return;
    }
    
    if (status === 'authenticated') {
      fetchProfile();
    }
  }, [status, router]);

  // Yükleme durumu
  if (status === 'loading' || loading) {
    return (
      <SayfaKabugu>
        <Yukleniyor
          metin={status === 'loading' ? 'Oturum kontrol ediliyor…' : 'Profiliniz yükleniyor…'}
        />
      </SayfaKabugu>
    );
  }

  if (status === 'unauthenticated') {
    return <GirisGerekli />;
  }

  /** Kod → etiket çevirileri; iki yerde (görünüm ve düzenleme) kullanılıyor. */
  const ULASIM: Record<string, string> = {
    all: 'Hepsi',
    plane: 'Uçak',
    car: 'Araba',
    bus: 'Otobüs',
    train: 'Tren',
    boat: 'Gemi',
  };

  const PARA: Record<string, string> = {
    TRY: 'Türk Lirası (TRY)',
    USD: 'Amerikan Doları (USD)',
    EUR: 'Euro (EUR)',
    GBP: 'İngiliz Sterlini (GBP)',
  };

  const adBasHarfi = (profile?.name || session?.user?.name || '?').trim().charAt(0).toUpperCase();

  /**
   * Görünüm modundaki değer satırı.
   *
   * Eskiden her değer `bg-[var(--surface-2)] px-4 py-3 rounded-lg` ile bir
   * KUTU içindeydi; on bir kutu üst üste gelince sayfa forma benziyordu ama
   * düzenlenebilir değildi. Görünüm modunda kutu yok — etiket + değer.
   */
  const Deger = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[var(--fg)] leading-relaxed">{children}</p>
  );

  const BosDeger = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[var(--fg-subtle)] leading-relaxed">{children}</p>
  );

  return (
    <SayfaKabugu>
      <SayfaBasi
        baslik="Profil"
        aciklama="Hesap bilgileriniz ve seyahat tercihleriniz. Tercihler yeni plan oluştururken başlangıç değeri olarak kullanılır."
        yan={
          editing ? (
            <div className="flex gap-2">
              <Dugme
                tur="ikincil"
                onClick={() => {
                  setEditing(false);
                  // İptal düzenlemeyi GERİ ALMALI: eskiden yalnızca modu
                  // kapatıyordu, girilen değerler formda kalıyordu ve bir
                  // sonraki "Düzenle"de kaydedilmemiş veri görünüyordu.
                  if (profile) {
                    setEditForm({
                      name: profile.name || '',
                      phone: profile.phone || '',
                      bio: profile.bio || '',
                      location: profile.location || '',
                      birthDate: profile.birthDate || '',
                      preferredTransport: profile.preferredTransport || 'all',
                      preferredCurrency: profile.preferredCurrency || 'TRY',
                      interests: profile.interests || '',
                    });
                  }
                }}
              >
                Vazgeç
              </Dugme>
              <Dugme onClick={updateProfile} bekliyor={saving}>
                Kaydet
              </Dugme>
            </div>
          ) : (
            <Dugme tur="ikincil" onClick={() => setEditing(true)}>
              Düzenle
            </Dugme>
          )
        }
      />

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
        {/* ================================================================ */}
        {/* Kimlik belgesi                                                    */}
        {/* ================================================================ */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-kart)]">
          {/* Künye başlığı */}
          <div className="relative overflow-hidden p-6">
            <KonturDoku yogunluk={0.5} />
            <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
              {profile?.image ? (
                <Image
                  src={profile.image}
                  alt=""
                  width={96}
                  height={96}
                  className="h-24 w-24 shrink-0 rounded-full border-2 border-[var(--line)] object-cover"
                />
              ) : (
                /* DÜZELTİLDİ: burada `w-30 h-30` yazıyordu — Tailwind'in
                   varsayılan ölçeğinde 30 adımı YOK, yani kutunun boyutu
                   hiç uygulanmıyordu. Metin de `text-white` idi ve zemin
                   `--bg` (açık temada neredeyse beyaz kâğıt) olduğu için
                   baş harf GÖRÜNMÜYORDU. */
                <span
                  className="grid h-24 w-24 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] font-[family-name:var(--font-serif)] text-4xl"
                  aria-hidden="true"
                >
                  {adBasHarfi}
                </span>
              )}

              <div className="min-w-0">
                <h2 className="font-[family-name:var(--font-serif)] text-2xl text-[var(--fg)]">
                  {profile?.name || session?.user?.name || 'İsimsiz kullanıcı'}
                </h2>
                <p className="text-[var(--fg-muted)] mt-1 break-all">
                  {profile?.email || session?.user?.email}
                </p>
                {profile?.createdAt && (
                  <p className="lejant text-[var(--fg-subtle)] mt-3 sayisal">
                    Üyelik ·{' '}
                    {new Date(profile.createdAt).toLocaleDateString('tr-TR', {
                      year: 'numeric',
                      month: 'long',
                    })}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="px-6">
            <Kocan />
          </div>

          {/* Alanlar */}
          <div className="p-6 space-y-6">
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-6">
              <Alan etiket="Ad Soyad" htmlFor="p-name">
                {editing ? (
                  <input
                    id="p-name"
                    type="text"
                    className={GIRDI_SINIFI}
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="Adınız ve soyadınız"
                  />
                ) : profile?.name ? (
                  <Deger>{profile.name}</Deger>
                ) : (
                  <BosDeger>Belirtilmemiş</BosDeger>
                )}
              </Alan>

              <Alan etiket="Telefon" htmlFor="p-phone">
                {editing ? (
                  <input
                    id="p-phone"
                    type="tel"
                    className={cx(GIRDI_SINIFI, 'sayisal')}
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="05XX XXX XX XX"
                  />
                ) : profile?.phone ? (
                  <Deger>
                    <span className="sayisal">{profile.phone}</span>
                  </Deger>
                ) : (
                  <BosDeger>Belirtilmemiş</BosDeger>
                )}
              </Alan>

              <Alan etiket="Konum" htmlFor="p-location">
                {editing ? (
                  <input
                    id="p-location"
                    type="text"
                    className={GIRDI_SINIFI}
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    placeholder="Şehir, ülke"
                  />
                ) : profile?.location ? (
                  <Deger>{profile.location}</Deger>
                ) : (
                  <BosDeger>Belirtilmemiş</BosDeger>
                )}
              </Alan>

              <Alan etiket="Doğum tarihi" htmlFor="p-birth">
                {editing ? (
                  <input
                    id="p-birth"
                    type="date"
                    className={cx(GIRDI_SINIFI, 'sayisal')}
                    value={editForm.birthDate}
                    onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })}
                  />
                ) : profile?.birthDate ? (
                  <Deger>
                    <span className="sayisal">
                      {new Date(profile.birthDate).toLocaleDateString('tr-TR')}
                    </span>
                  </Deger>
                ) : (
                  <BosDeger>Belirtilmemiş</BosDeger>
                )}
              </Alan>
            </div>

            <Alan etiket="Hakkımda" htmlFor="p-bio">
              {editing ? (
                <textarea
                  id="p-bio"
                  rows={3}
                  className={GIRDI_SINIFI}
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  placeholder="Kendinizden kısaca bahsedin…"
                />
              ) : profile?.bio ? (
                <Deger>{profile.bio}</Deger>
              ) : (
                <BosDeger>Henüz bir şey yazmadınız.</BosDeger>
              )}
            </Alan>

            <div className="pt-2">
              <Kocan />
            </div>

            <div>
              <p className="lejant text-[var(--fg-subtle)] mb-4">Seyahat tercihleri</p>

              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-6">
                <Alan etiket="Tercih edilen ulaşım" htmlFor="p-transport">
                  {editing ? (
                    <select
                      id="p-transport"
                      className={GIRDI_SINIFI}
                      value={editForm.preferredTransport}
                      onChange={(e) =>
                        setEditForm({ ...editForm, preferredTransport: e.target.value })
                      }
                    >
                      {Object.entries(ULASIM).map(([kod, etiket]) => (
                        <option key={kod} value={kod}>
                          {etiket}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Deger>{ULASIM[profile?.preferredTransport || 'all'] ?? 'Hepsi'}</Deger>
                  )}
                </Alan>

                <Alan etiket="Para birimi" htmlFor="p-currency">
                  {editing ? (
                    <select
                      id="p-currency"
                      className={GIRDI_SINIFI}
                      value={editForm.preferredCurrency}
                      onChange={(e) =>
                        setEditForm({ ...editForm, preferredCurrency: e.target.value })
                      }
                    >
                      {Object.entries(PARA).map(([kod, etiket]) => (
                        <option key={kod} value={kod}>
                          {etiket}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Deger>{PARA[profile?.preferredCurrency || 'TRY'] ?? PARA.TRY}</Deger>
                  )}
                </Alan>
              </div>
            </div>

            <Alan
              etiket="İlgi alanları"
              htmlFor="p-interests"
              ipucu={editing ? 'Virgülle ayırın; plan üretilirken dikkate alınır.' : undefined}
            >
              {editing ? (
                <textarea
                  id="p-interests"
                  rows={3}
                  className={GIRDI_SINIFI}
                  value={editForm.interests}
                  onChange={(e) => setEditForm({ ...editForm, interests: e.target.value })}
                  placeholder="Tarih, müze, doğa yürüyüşü, gastronomi, fotoğrafçılık…"
                />
              ) : profile?.interests ? (
                /* Virgülle ayrılmış metin, etiketlere dönüyor: göz tek tek
                   ilgi alanını bir metin bloğundan daha hızlı tarıyor. */
                <ul className="flex flex-wrap gap-1.5">
                  {profile.interests
                    .split(',')
                    .map((i) => i.trim())
                    .filter(Boolean)
                    .map((ilgi) => (
                      <li key={ilgi}>
                        <Rozet ton="aksan">{ilgi}</Rozet>
                      </li>
                    ))}
                </ul>
              ) : (
                <BosDeger>Belirtilmemiş</BosDeger>
              )}
            </Alan>

            <Alan
              etiket="E-posta"
              htmlFor="p-email"
              ipucu="E-posta adresi hesabınızın kimliğidir ve değiştirilemez."
            >
              <p
                id="p-email"
                className="text-[var(--fg-muted)] leading-relaxed break-all"
              >
                {profile?.email || session?.user?.email}
              </p>
            </Alan>
          </div>
        </div>

        {/* ================================================================ */}
        {/* Yan sütun                                                         */}
        {/* ================================================================ */}
        <div className="space-y-6">
          {stats && (
            <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-kart)] p-6">
              <h3 className="font-[family-name:var(--font-serif)] text-lg text-[var(--fg)]">
                Seyahat özetiniz
              </h3>

              {/*
                BEŞ İSTATİSTİK, BEŞ AYRI RENK VARDI (aksan / yeşil / mor /
                sarı / pembe) — üstelik ikisi ham Tailwind rengiydi
                (`bg-purple-50`, `bg-pink-50`) ve paletin dışındaydı. Renk
                "bunlar farklı türde şeyler" diyordu; oysa hepsi aynı türde:
                bir ölçüm. Artık hepsi aynı yüzeyde, ayrım çizgiyle.
              */}
              <dl className="mt-5 divide-y divide-[var(--line)]">
                {[
                  { etiket: 'Toplam plan', deger: stats.totalTrips.toLocaleString('tr-TR') },
                  { etiket: 'Tamamlanan', deger: stats.completedTrips.toLocaleString('tr-TR') },
                  {
                    etiket: 'Toplam bütçe',
                    deger: `₺${stats.totalBudget.toLocaleString('tr-TR')}`,
                  },
                  { etiket: 'Ortalama süre', deger: `${stats.averageTripDuration} gün` },
                  ...(stats.favoriteDestination
                    ? [{ etiket: 'Favori şehir', deger: stats.favoriteDestination }]
                    : []),
                ].map((satir) => (
                  <div
                    key={satir.etiket}
                    className="flex items-baseline justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <dt className="lejant text-[var(--fg-subtle)]">{satir.etiket}</dt>
                    <dd className="font-[family-name:var(--font-serif)] text-lg text-[var(--fg)] sayisal">
                      {satir.deger}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-kart)] p-6">
            <h3 className="font-[family-name:var(--font-serif)] text-lg text-[var(--fg)]">
              Hızlı işlemler
            </h3>

            {/* Üç eşit ağırlıkta aksan düğmesi vardı; hangisinin asıl eylem
                olduğu belli değildi. Tek birincil, ikisi ikincil. */}
            <div className="mt-5 space-y-2.5">
              <BagDugme href="/travel-mode" className="w-full">
                Yeni plan oluştur
              </BagDugme>
              <BagDugme href="/my-plans" tur="ikincil" className="w-full">
                Planlarım
              </BagDugme>
              <BagDugme href="/profile/my-trips" tur="ikincil" className="w-full">
                Seyahat geçmişi
              </BagDugme>
            </div>
          </div>

          {/* Doğrulanmış hesapta hiçbir şey basmıyor (bkz. bileşen notu).
              Profil henüz okunamadıysa da basmıyor: doğrulama DURUMU
              bilinmeden uyarı göstermek, doğrulanmış kullanıcıya yanlış
              bir eksiklik bildirmek olurdu. */}
          {profile && <EpostaDogrulama dogrulanmis={Boolean(profile.emailVerified)} />}

          <PlanTasima />

          <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-kart)] p-6">
            <h3 className="font-[family-name:var(--font-serif)] text-lg text-[var(--fg)]">
              Hesap
            </h3>

            {/* Çıkış yıkıcı olmasa da geri dönüşü zahmetli: dolu kırmızı bir
                düğme yerine sessiz tehlike biçimi. */}
            <div className="mt-5">
              <Dugme
                tur="tehlike"
                className="w-full"
                onClick={() => {
                  if (confirm('Çıkış yapmak istediğinizden emin misiniz?')) {
                    signOut({ callbackUrl: '/' });
                  }
                }}
              >
                Çıkış yap
              </Dugme>
            </div>

            {/* Hesap silme, çıkışın ALTINDA ve ayrı bir onay akışında:
                aynı görsel ağırlıkta iki tehlike düğmesi yan yana
                durursa yanlışına basmak an meselesi.

                Profil okunamadıysa gösterilmiyor: onayın şifre mi adres mi
                isteyeceğini profil belirliyor ve yanlış alanı sormak,
                kullanıcıyı silemediği bir hesapla baş başa bırakırdı. */}
            {profile && (
              <HesapSilme
                eposta={profile.email}
                sifreVar={profile.sifreVar !== false}
              />
            )}
          </div>
        </div>
      </div>
    </SayfaKabugu>
  );
}
