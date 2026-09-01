"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import Image from "next/image";
import { logger } from "@/lib/logger";
import {
  GirisGerekli,
} from "@/components/ui";

interface UserProfile {
  id: string;
  name: string;
  email: string;
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

  // Loading durumu
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-[var(--fg-muted)]">
            Profil yükleniyor...
          </p>
        </div>
      </div>
    );
  }

  // Giriş yapmamış kullanıcı
  if (status === 'unauthenticated') {
    return <GirisGerekli />;
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="font-[family-name:var(--font-serif)] text-3xl md:text-4xl text-[var(--fg)] mb-3">
            Profilim
          </h1>
          <p className="text-[var(--fg-muted)]">
            Hesap bilgilerinizi görüntüleyin ve düzenleyin
          </p>
        </div>

        {/* Navigation */}
        <div className="text-center mb-8 flex justify-center space-x-4">
          <button
            onClick={() => router.push('/my-plans')}
            className="bg-[var(--accent)] text-[var(--accent-contrast)] px-6 py-3 rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
          >
            Planlarım
          </button>
          <button
            onClick={() => router.push('/budget')}
            className="bg-[var(--accent)] text-[var(--accent-contrast)] px-6 py-3 rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
          >
            Finansal Tercihler
          </button>
          <button
            onClick={() => router.push('/daily-planner')}
            className="bg-[var(--accent)] text-[var(--accent-contrast)] px-6 py-3 rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
          >
            Günlük Plan
          </button>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Profile Info */}
            <div className="lg:col-span-2">
              <div className="bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--line)] p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-[var(--fg)]">
                    Profil Bilgileri
                  </h2>
                  <div className="space-x-2">
                    {editing ? (
                      <>
                        <button
                          onClick={() => setEditing(false)}
                          className="px-4 py-2 text-[var(--fg-muted)] hover:bg-[var(--surface-2)] dark:hover:bg-[var(--surface-2)] rounded-lg transition-colors"
                        >
                          İptal
                        </button>
                        <button
                          onClick={updateProfile}
                          disabled={saving}
                          className="px-4 py-2 bg-[var(--accent)] text-[var(--accent-contrast)] rounded-lg hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
                        >
                          {saving ? 'Kaydediliyor...' : 'Kaydet'}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setEditing(true)}
                        className="px-4 py-2 bg-[var(--accent)] text-[var(--accent-contrast)] rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
                      >
                        Düzenle
                      </button>
                    )}
                  </div>
                </div>

                {/* Profile Photo */}
                <div className="flex flex-col md:flex-row items-center md:items-start space-y-4 md:space-y-0 md:space-x-6 mb-8">
                  <div className="relative">
                    {profile?.image || session?.user?.image ? (
                      <Image
                        src={profile?.image || session?.user?.image || ''}
                        alt="Profile"
                        width={120}
                        height={120}
                        className="rounded-full border-4 border-[var(--line)] dark:border-[var(--line)]"
                      />
                    ) : (
                      <div className="w-30 h-30 rounded-full bg-[var(--bg)] flex items-center justify-center text-white text-4xl font-bold">
                        {profile?.name?.charAt(0) || session?.user?.name?.charAt(0) || '?'}
                      </div>
                    )}
                  </div>
                  
                  <div className="text-center md:text-left">
                    <h3 className="text-2xl font-bold text-[var(--fg)]">
                      {profile?.name || session?.user?.name}
                    </h3>
                    <p className="text-[var(--fg-muted)] mb-2">
                      {profile?.email || session?.user?.email}
                    </p>
                    <p className="text-sm text-[var(--fg-subtle)]">
                      Üye olma tarihi: {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('tr-TR') : 'Bilinmiyor'}
                    </p>
                  </div>
                </div>

                {/* Profile Form */}
                <div className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-[var(--fg-muted)] mb-2">
                        Ad Soyad
                      </label>
                      {editing ? (
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                          className="w-full px-4 py-3 border border-[var(--line-strong)] rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-[var(--line)] dark:bg-[var(--surface-2)] dark:text-[var(--fg)]"
                          placeholder="Adınızı ve soyadınızı girin"
                        />
                      ) : (
                        <p className="px-4 py-3 bg-[var(--surface-2)] rounded-lg text-[var(--fg)]">
                          {profile?.name || 'Belirtilmemiş'}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--fg-muted)] mb-2">
                        Telefon
                      </label>
                      {editing ? (
                        <input
                          type="tel"
                          value={editForm.phone}
                          onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                          className="w-full px-4 py-3 border border-[var(--line-strong)] rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-[var(--line)] dark:bg-[var(--surface-2)] dark:text-[var(--fg)]"
                          placeholder="Telefon numaranızı girin"
                        />
                      ) : (
                        <p className="px-4 py-3 bg-[var(--surface-2)] rounded-lg text-[var(--fg)]">
                          {profile?.phone || 'Belirtilmemiş'}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--fg-muted)] mb-2">
                        Konum
                      </label>
                      {editing ? (
                        <input
                          type="text"
                          value={editForm.location}
                          onChange={(e) => setEditForm({...editForm, location: e.target.value})}
                          className="w-full px-4 py-3 border border-[var(--line-strong)] rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-[var(--line)] dark:bg-[var(--surface-2)] dark:text-[var(--fg)]"
                          placeholder="Şehir, Ülke"
                        />
                      ) : (
                        <p className="px-4 py-3 bg-[var(--surface-2)] rounded-lg text-[var(--fg)]">
                          {profile?.location || 'Belirtilmemiş'}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--fg-muted)] mb-2">
                        Doğum Tarihi
                      </label>
                      {editing ? (
                        <input
                          type="date"
                          value={editForm.birthDate}
                          onChange={(e) => setEditForm({...editForm, birthDate: e.target.value})}
                          className="w-full px-4 py-3 border border-[var(--line-strong)] rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-[var(--line)] dark:bg-[var(--surface-2)] dark:text-[var(--fg)]"
                        />
                      ) : (
                        <p className="px-4 py-3 bg-[var(--surface-2)] rounded-lg text-[var(--fg)]">
                          {profile?.birthDate ? new Date(profile.birthDate).toLocaleDateString('tr-TR') : 'Belirtilmemiş'}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--fg-muted)] mb-2">
                      Hakkımda
                    </label>
                    {editing ? (
                      <textarea
                        value={editForm.bio}
                        onChange={(e) => setEditForm({...editForm, bio: e.target.value})}
                        rows={4}
                        className="w-full px-4 py-3 border border-[var(--line-strong)] rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-[var(--line)] dark:bg-[var(--surface-2)] dark:text-[var(--fg)]"
                        placeholder="Kendiniz hakkında kısa bir açıklama yazın..."
                      />
                    ) : (
                      <p className="px-4 py-3 bg-[var(--surface-2)] rounded-lg text-[var(--fg)] min-h-[100px]">
                        {profile?.bio || 'Henüz bir açıklama eklenmemiş.'}
                      </p>
                    )}
                  </div>

                  {/* Preferred Transport */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-[var(--fg-muted)] mb-2">
                        Tercih Edilen Ulaşım
                      </label>
                      {editing ? (
                        <select
                          value={editForm.preferredTransport}
                          onChange={(e) => setEditForm({...editForm, preferredTransport: e.target.value})}
                          className="w-full px-4 py-3 border border-[var(--line-strong)] rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-[var(--line)] dark:bg-[var(--surface-2)] dark:text-[var(--fg)]"
                        >
                          <option value="all">Hepsi</option>
                          <option value="plane">Uçak</option>
                          <option value="car">Araba</option>
                          <option value="bus">Otobüs</option>
                          <option value="train">Tren</option>
                          <option value="boat">Gemi</option>
                        </select>
                      ) : (
                        <p className="px-4 py-3 bg-[var(--surface-2)] rounded-lg text-[var(--fg)]">
                          {(() => {
                            const transport = profile?.preferredTransport || 'all';
                            switch(transport) {
                              case 'plane': return 'Uçak';
                              case 'car': return 'Araba';
                              case 'bus': return 'Otobüs';
                              case 'train': return 'Tren';
                              case 'boat': return 'Gemi';
                              default: return 'Hepsi';
                            }
                          })()}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--fg-muted)] mb-2">
                        Tercih Edilen Para Birimi
                      </label>
                      {editing ? (
                        <select
                          value={editForm.preferredCurrency}
                          onChange={(e) => setEditForm({...editForm, preferredCurrency: e.target.value})}
                          className="w-full px-4 py-3 border border-[var(--line-strong)] rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-[var(--line)] dark:bg-[var(--surface-2)] dark:text-[var(--fg)]"
                        >
                          <option value="TRY">Türk Lirası (TRY)</option>
                          <option value="USD">Amerikan Doları (USD)</option>
                          <option value="EUR">Euro (EUR)</option>
                          <option value="GBP">İngiliz Sterlini (GBP)</option>
                        </select>
                      ) : (
                        <p className="px-4 py-3 bg-[var(--surface-2)] rounded-lg text-[var(--fg)]">
                          {(() => {
                            const currency = profile?.preferredCurrency || 'TRY';
                            switch(currency) {
                              case 'USD': return 'Amerikan Doları (USD)';
                              case 'EUR': return 'Euro (EUR)';
                              case 'GBP': return 'İngiliz Sterlini (GBP)';
                              default: return 'Türk Lirası (TRY)';
                            }
                          })()}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Interests */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--fg-muted)] mb-2">
                      İlgi Alanları
                    </label>
                    {editing ? (
                      <textarea
                        value={editForm.interests}
                        onChange={(e) => setEditForm({...editForm, interests: e.target.value})}
                        rows={3}
                        className="w-full px-4 py-3 border border-[var(--line-strong)] rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-[var(--line)] dark:bg-[var(--surface-2)] dark:text-[var(--fg)]"
                        placeholder="Örn: Tarih, müze, doğa yürüyüşü, gastronomi, fotoğrafçılık..."
                      />
                    ) : (
                      <p className="px-4 py-3 bg-[var(--surface-2)] rounded-lg text-[var(--fg)] min-h-[80px]">
                        {profile?.interests || 'İlgi alanları belirtilmemiş.'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--fg-muted)] mb-2">
                      E-posta
                    </label>
                    <p className="px-4 py-3 bg-[var(--surface-2)] dark:bg-[var(--surface-3)] rounded-lg text-[var(--fg-muted)]">
                      {profile?.email || session?.user?.email} (Değiştirilemez)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats & Actions */}
            <div className="space-y-6">
              {/* Travel Stats */}
              {stats && (
                <div className="bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--line)] p-6">
                  <h3 className="font-[family-name:var(--font-serif)] text-lg text-[var(--fg)] mb-5">
                    Seyahat İstatistiklerim
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-[var(--accent-soft)] rounded-lg">
                      <span className="text-[var(--fg-muted)]">Toplam Plan</span>
                      <span className="font-bold text-[var(--accent)]">{stats.totalTrips}</span>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-[var(--ok-soft)] rounded-lg">
                      <span className="text-[var(--fg-muted)]">Tamamlanan</span>
                      <span className="font-bold text-[var(--accent)]">{stats.completedTrips}</span>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-purple-50 dark:bg-[var(--surface-2)] rounded-lg">
                      <span className="text-[var(--fg-muted)]">Toplam Bütçe</span>
                      <span className="font-bold text-[var(--fg)]">
                        ₺{stats.totalBudget.toLocaleString('tr-TR')}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-[var(--warn-soft)] rounded-lg">
                      <span className="text-[var(--fg-muted)]">Ort. Süre</span>
                      <span className="font-bold text-[var(--warn)]">
                        {stats.averageTripDuration} gün
                      </span>
                    </div>
                    
                    {stats.favoriteDestination && (
                      <div className="flex justify-between items-center p-3 bg-pink-50 dark:bg-[var(--surface-2)] rounded-lg">
                        <span className="text-[var(--fg-muted)]">Favori Şehir</span>
                        <span className="font-bold text-[var(--fg)] dark:text-[var(--fg)]">
                          {stats.favoriteDestination}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--line)] p-6">
                <h3 className="font-[family-name:var(--font-serif)] text-lg text-[var(--fg)] mb-5">
                  Hızlı İşlemler
                </h3>
                
                <div className="space-y-3">
                  <button
                    onClick={() => router.push('/travel-mode')}
                    className="w-full bg-[var(--accent)] text-white py-3 px-4 rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
                  >
                    Yeni Plan Oluştur
                  </button>
                  
                  <button
                    onClick={() => router.push('/my-plans')}
                    className="w-full bg-[var(--accent)] text-[var(--accent-contrast)] py-3 px-4 rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
                  >
                    Planlarımı Görüntüle
                  </button>
                  
                  <button
                    onClick={() => router.push('/profile/my-trips')}
                    className="w-full bg-[var(--accent)] text-[var(--accent-contrast)] py-3 px-4 rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
                  >
                     Seyahat Geçmişi
                  </button>
                </div>
              </div>

              {/* Account Actions */}
              <div className="bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--line)] p-6">
                <h3 className="font-[family-name:var(--font-serif)] text-lg text-[var(--fg)] mb-5">
                  Hesap İşlemleri
                </h3>
                
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      if (confirm('Çıkış yapmak istediğinizden emin misiniz?')) {
                        signOut({ callbackUrl: '/' });
                      }
                    }}
                    className="w-full bg-[var(--danger)] text-white py-3 px-4 rounded-lg hover:bg-[var(--danger-hover)] transition-colors"
                  >
                    Çıkış Yap
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


