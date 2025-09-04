'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';

export default function TravelModePage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  // Session kontrol
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600 dark:text-gray-300">Oturum kontrol ediliyor...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Giriş Gerekli</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Plan oluşturmak için önce giriş yapmanız gerekiyor.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 mr-4"
          >
            Giriş Yap
          </button>
          <button
            onClick={() => router.push('/')}
            className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600"
          >
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    );
  }

  const handleAIMode = () => {
    toast.success('AI destekli planlama moduna yönlendiriliyorsunuz...');
    router.push('/ai-planner');
  };

  const handleManualMode = () => {
    toast.success('Adım adım planlama moduna yönlendiriliyorsunuz...');
    router.push('/manual-planner');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-800 dark:text-white mb-6">
            Seyahat Planlama Modunu Seçin
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Size en uygun planlama yöntemini seçerek hayalinizdeki seyahati planlamaya başlayın
          </p>
        </div>

        {/* Mode Selection Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          
          {/* AI Mode Card */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden transform hover:scale-105 transition-all duration-300">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-8 text-white">
              <div className="flex items-center justify-center mb-4">
                <div className="bg-white/20 p-4 rounded-full">
                  <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                  </svg>
                </div>
              </div>
              <h2 className="text-3xl font-bold text-center mb-2">AI Destekli Planlama</h2>
              <p className="text-blue-100 text-center text-lg">Yapay zeka ile otomatik plan</p>
            </div>
            
            <div className="p-8">
              <div className="space-y-4 mb-8">
                <div className="flex items-start space-x-3">
                  <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-full mt-1">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 dark:text-white">Hızlı ve Kolay</h3>
                    <p className="text-gray-600 dark:text-gray-300">Bilgilerinizi girin, AI size özel plan oluştursun</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-full mt-1">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 dark:text-white">Akıllı Öneriler</h3>
                    <p className="text-gray-600 dark:text-gray-300">İlgi alanlarınıza göre kişiselleştirilmiş öneriler</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-full mt-1">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 dark:text-white">Kapsamlı Plan</h3>
                    <p className="text-gray-600 dark:text-gray-300">Günlük aktiviteler, yemek önerileri ve bütçe</p>
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleAIMode}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:from-blue-600 hover:to-purple-700 transform hover:scale-105 transition-all duration-200 shadow-lg"
              >
                AI ile Planla
              </button>
              
              <div className="mt-4 text-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">Yaklaşık 2-3 dakika</span>
              </div>
            </div>
          </div>

          {/* Manual Mode Card */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden transform hover:scale-105 transition-all duration-300">
            <div className="bg-gradient-to-r from-green-500 to-teal-600 p-8 text-white">
              <div className="flex items-center justify-center mb-4">
                <div className="bg-white/20 p-4 rounded-full">
                  <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.1 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
                  </svg>
                </div>
              </div>
              <h2 className="text-3xl font-bold text-center mb-2">Adım Adım Planlama</h2>
              <p className="text-green-100 text-center text-lg">Detaylı kontrol sizde olsun</p>
            </div>
            
            <div className="p-8">
              <div className="space-y-4 mb-8">
                <div className="flex items-start space-x-3">
                  <div className="bg-green-100 dark:bg-green-900 p-2 rounded-full mt-1">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 dark:text-white">Tam Kontrol</h3>
                    <p className="text-gray-600 dark:text-gray-300">Her detayı kendiniz belirleyin</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="bg-green-100 dark:bg-green-900 p-2 rounded-full mt-1">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 dark:text-white">Adım Adım Rehber</h3>
                    <p className="text-gray-600 dark:text-gray-300">Ulaşım, konaklama, aktiviteler ayrı ayrı</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="bg-green-100 dark:bg-green-900 p-2 rounded-full mt-1">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 dark:text-white">Bütçe Analizi</h3>
                    <p className="text-gray-600 dark:text-gray-300">Detaylı maliyet hesaplama ve analiz</p>
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleManualMode}
                className="w-full bg-gradient-to-r from-green-500 to-teal-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:from-green-600 hover:to-teal-700 transform hover:scale-105 transition-all duration-200 shadow-lg"
              >
                Adım Adım Planla
              </button>
              
              <div className="mt-4 text-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">Yaklaşık 10-15 dakika</span>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Comparison */}
        <div className="mt-16 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <h3 className="text-2xl font-bold text-center text-gray-800 dark:text-white mb-8">
            Hangi Mod Size Uygun?
          </h3>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-blue-600 dark:text-blue-400 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
                AI Destekli Modunu Seçin
              </h4>
              <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">?</span>
                  İlk kez seyahat planlıyorsanız
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">?</span>
                  Hızlı plan istiyorsanız
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">?</span>
                  Yeni öneriler keşfetmek istiyorsanız
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">?</span>
                  Temel tercihleri belirtmek yeterliyse
                </li>
              </ul>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-green-600 dark:text-green-400 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.1 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
                </svg>
                Adım Adım Modunu Seçin
              </h4>
              <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">?</span>
                  Deneyimli seyahat planlayıcısıysanız
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">?</span>
                  Her detayı kontrol etmek istiyorsanız
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">?</span>
                  Bütçe konusunda titizseniz
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">?</span>
                  Özel gereksinimleriniz varsa
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


