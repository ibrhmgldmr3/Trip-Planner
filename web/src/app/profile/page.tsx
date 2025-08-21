"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast, Toaster } from "react-hot-toast";

interface UserProfile {
  name: string;
  preferredTransport: string;
  preferredCurrency: string;
  interests: string[];
}

export default function ProfilePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: "",
    preferredTransport: "all",
    preferredCurrency: "TRY",
    interests: [],
  });

  // Tüm ilgi alanları listesi
  const allInterests = ["Tarihi Yerler", "Doğa", "Gastronomi", "Alışveriş", "Müzeler", "Plajlar", "Gece Hayatı", "Aktiviteler"];

  // Kullanıcı tercihlerini API'den al
  const fetchUserPreferences = useCallback(async () => {
    try {
      const response = await fetch("/api/profile", {
        method: "GET",
      });
      
      if (response.ok) {
        const data = await response.json();
        setUserProfile({
          name: session?.user?.name || "",
          preferredTransport: data.preferredTransport || "all",
          preferredCurrency: data.preferredCurrency || "TRY",
          interests: data.interests ? JSON.parse(data.interests) : [],
        });
      }
    } catch (error) {
      console.error("Kullanıcı tercihleri alınamadı:", error);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login?callbackUrl=/profile");
    } else if (status === "authenticated" && session?.user) {
      // Session'dan kullanıcı bilgilerini al
      setUserProfile(prev => ({
        ...prev,
        name: session.user?.name || "",
      }));
      
      // Kullanıcı tercihlerini API'den al
      fetchUserPreferences();
    }
  }, [status, router, session, fetchUserPreferences]);

  // Profil bilgilerini güncelle
  const handleProfileUpdate = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/profile/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: userProfile.name,
          preferredTransport: userProfile.preferredTransport,
          preferredCurrency: userProfile.preferredCurrency,
          interests: userProfile.interests,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Profil güncellenirken bir hata oluştu");
      }

      toast.success("Profil başarıyla güncellendi");
      
      // Session'u güncelle (isim değişmiş olabilir)
      if (userProfile.name !== session?.user?.name) {
        await update({
          ...session,
          user: {
            ...session?.user,
            name: userProfile.name,
          },
        });
      }
    } catch (error) {
      console.error("Profil güncelleme hatası:", error);
      toast.error(error instanceof Error ? error.message : "Profil güncellenirken bir hata oluştu");
    } finally {
      setIsSubmitting(false);
    }
  };

  // İlgi alanlarını güncelle
  const handleInterestChange = (interest: string) => {
    setUserProfile(prev => {
      const updatedInterests = prev.interests.includes(interest)
        ? prev.interests.filter(item => item !== interest)
        : [...prev.interests, interest];
      
      return { ...prev, interests: updatedInterests };
    });
  };

  if (isLoading) {
    return (
      <main className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 border-t-2 border-blue-600 border-solid rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-800">Yükleniyor...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-blue-50 to-indigo-50">
      <Toaster position="top-center" />
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-blue-800">
              Profilim
            </h1>
            <p className="text-gray-800 mt-2 max-w-2xl">
              Hesap bilgilerinizi görüntüleyin ve yönetin.
            </p>
          </div>
          <Link 
            href="/"
            className="mt-4 md:mt-0 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors self-start"
          >
            Ana Sayfaya Dön
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-full bg-white text-blue-600 flex items-center justify-center text-2xl font-bold">
                {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : "U"}
              </div>
              <div>
                <h2 className="text-xl font-semibold">{session?.user?.name || "Kullanıcı"}</h2>
                <p className="text-blue-100">{session?.user?.email || ""}</p>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Hesap Bilgileri</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-1">Ad Soyad</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={userProfile.name}
                      onChange={(e) => setUserProfile({...userProfile, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-1">E-posta</label>
                    <input 
                      type="email" 
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={session?.user?.email || ""}
                      readOnly 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-1">Üyelik Tarihi</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={new Date().toLocaleDateString("tr-TR")}
                      readOnly 
                    />
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Seyahat Tercihleri</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-1">Tercih Edilen Ulaşım</label>
                    <select 
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={userProfile.preferredTransport}
                      onChange={(e) => setUserProfile({...userProfile, preferredTransport: e.target.value})}
                    >
                      <option value="all">Hepsi</option>
                      <option value="plane">Uçak</option>
                      <option value="bus">Otobüs</option>
                      <option value="train">Tren</option>
                      <option value="car">Araba</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-1">Para Birimi</label>
                    <select 
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={userProfile.preferredCurrency}
                      onChange={(e) => setUserProfile({...userProfile, preferredCurrency: e.target.value})}
                    >
                      <option value="TRY">Türk Lirası (₺)</option>
                      <option value="USD">Amerikan Doları ($)</option>
                      <option value="EUR">Euro (€)</option>
                      <option value="GBP">İngiliz Sterlini (£)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-1">İlgi Alanları</label>
                    <div className="grid grid-cols-2 gap-2">
                      {allInterests.map((interest) => (
                        <label key={interest} className="inline-flex items-center">
                          <input 
                            type="checkbox" 
                            className="form-checkbox text-blue-600"
                            checked={userProfile.interests.includes(interest)}
                            onChange={() => handleInterestChange(interest)}
                          />
                          <span className="ml-2 text-sm">{interest}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-8 flex justify-end">
              <button 
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium shadow-md hover:bg-blue-700 transition disabled:opacity-50"
                onClick={handleProfileUpdate}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Güncelleniyor..." : "Bilgileri Güncelle"}
              </button>
            </div>
          </div>
        </div>
        
        <div className="mt-8 bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Yaklaşan Seyahatlerim</h3>
          
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-6 flex flex-col items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-800 mb-4 text-center">Henüz planlanmış bir seyahatiniz bulunmuyor.</p>
            <Link
              href="/planner"
              className="px-5 py-2 bg-blue-600 text-white rounded-lg font-medium shadow-md hover:bg-blue-700 transition"
            >
              Seyahat Planla
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
