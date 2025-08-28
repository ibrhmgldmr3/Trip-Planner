'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const handlePlanClick = (route: string) => {
    if (status === 'unauthenticated') {
      toast.error('Plan oluşturmak için önce giriş yapmanız gerekiyor');
      router.push('/login');
      return;
    }
    router.push(route);
  };

  return (
    <main className="min-h-screen">
      {/* Hero Section with enhanced animations */}
      <section className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 md:px-8 text-gray-800 dark:text-gray-200">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="md:w-1/2">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-gray-900 dark:text-white mb-6 fade-in">
                Hayalinizdeki Seyahati<br /><span className="animated-gradient">Kolay Planlayın</span>
              </h1>
              <p className="text-lg text-gray-800 dark:text-gray-200 font-medium mb-8 max-w-lg fade-in delay-100">
                Tarih, şehir, bütçe ve ilgi alanlarınıza göre kişiselleştirilmiş 
                seyahat planları oluşturun. Bütçenize uygun ulaşım, konaklama ve 
                etkinlik önerileriyle eksiksiz bir gezi deneyimi planlayın.
              </p>
              
              <div className="flex flex-wrap gap-4 fade-in delay-200">
                <button 
                  onClick={() => handlePlanClick('/travel-mode')}
                  className="px-5 py-3 bg-blue-600 text-white rounded-lg font-medium shadow-md hover:bg-blue-700 transition hover-lift"
                >
                  Planlamaya Başlayın
                </button>
                <button 
                  onClick={() => handlePlanClick('/my-plans')}
                  className="px-5 py-3 bg-green-600 text-white rounded-lg font-medium shadow-md hover:bg-green-700 transition hover-lift"
                >
                  Planlarım
                </button>
                <Link 
                  href="/map" 
                  className="px-5 py-3 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg font-medium hover:bg-blue-50 dark:hover:bg-gray-700 transition hover-scale"
                >
                  Rota Planlayıcı
                </Link>
              </div>
            </div>
            
            <div className="md:w-1/2 relative fade-in delay-300">
              <div className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-xl hover-lift">
                <div 
                  className="w-full h-64 bg-gradient-to-br from-blue-100 to-indigo-200 dark:from-blue-800 dark:to-indigo-900 rounded-lg flex items-center justify-center overflow-hidden"
                >
                  <div className="text-blue-600 dark:text-blue-300 relative">
                    <div className="absolute w-24 h-24 bg-blue-200 dark:bg-blue-700 rounded-full -top-12 -left-12 opacity-50"></div>
                    <div className="absolute w-16 h-16 bg-green-200 dark:bg-green-700 rounded-full -bottom-8 -right-8 opacity-50"></div>
                    
                    <div className="relative">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto pop-in" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      <p className="mt-2 text-center font-medium">Seyahat Planlama</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Decorative elements with animation */}
              <div className="absolute -bottom-6 -left-6 bg-yellow-400 w-16 h-16 rounded-full opacity-80 hidden md:block bounce"></div>
              <div className="absolute -top-6 -right-6 bg-blue-400 w-12 h-12 rounded-full opacity-80 hidden md:block bounce" style={{ animationDelay: "0.5s" }}></div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section with enhanced cards */}
      <section className="py-16 bg-white dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4 fade-in text-gray-900 dark:text-white">Seyahat Planlayıcımızın Özellikleri</h2>
          <p className="text-center text-gray-800 dark:text-gray-200 font-medium max-w-2xl mx-auto mb-12 fade-in delay-100">
            Seyahatinizi A&apos;dan Z&apos;ye planlayın, her şeyi tek bir uygulamada organize edin.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-blue-50 dark:bg-blue-900 rounded-xl p-6 transition-all hover-lift fade-in delay-100">
              <div className="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Akıllı Rota Planlama</h3>
              <p className="text-gray-800 dark:text-gray-200 font-medium">En optimum rotaları hesaplayarak, zamanınızı verimli kullanmanızı sağlıyoruz.</p>
              <Link href="/map" className="mt-4 inline-block text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium">
                Rota Planlayıcıya Git →
              </Link>
            </div>
            
            {/* Feature 2 */}
            <div className="bg-indigo-50 dark:bg-indigo-900 rounded-xl p-6 transition-all hover-lift fade-in delay-200">
              <div className="bg-indigo-600 text-white rounded-full w-12 h-12 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Bütçe Analizi</h3>
              <p className="text-gray-800 dark:text-gray-200 font-medium">Ulaşım, konaklama ve aktivite maliyetlerini hesaplayarak seyahat bütçenizi kontrol edin.</p>
              <Link href="/budget" className="mt-4 inline-block text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-sm font-medium">
                Bütçe Planlayıcıya Git →
              </Link>
            </div>
            
            {/* Feature 3 */}
            <div className="bg-green-50 dark:bg-green-900 rounded-xl p-6 transition-all hover-lift fade-in delay-300">
              <div className="bg-green-600 text-white rounded-full w-12 h-12 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Günlük Planlama</h3>
              <p className="text-gray-800 dark:text-gray-200 font-medium">Sabah, öğlen ve akşam aktivitelerini içeren detaylı günlük gezi planları oluşturun.</p>
              <Link href="/daily-planner" className="mt-4 inline-block text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 text-sm font-medium">
                Günlük Planlamaya Git →
              </Link>
            </div>
            
            {/* Feature 4 */}
            <div className="bg-red-50 dark:bg-red-900 rounded-xl p-6 transition-all hover-lift fade-in delay-200">
              <div className="bg-red-600 text-white rounded-full w-12 h-12 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Mekan Önerileri</h3>
              <p className="text-gray-800 dark:text-gray-200 font-medium">İlgi alanlarınıza göre kişiselleştirilmiş turistik mekan ve etkinlik önerileri.</p>
              <button 
                onClick={() => handlePlanClick('/ai-planner')}
                className="mt-4 inline-block text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-medium cursor-pointer"
              >
                Planlayıcıya Git →
              </button>
            </div>
            
            {/* Feature 5 */}
            <div className="bg-purple-50 dark:bg-purple-900 rounded-xl p-6 transition-all hover-lift fade-in delay-300">
              <div className="bg-purple-600 text-white rounded-full w-12 h-12 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Uygun Ulaşım Seçenekleri</h3>
              <p className="text-gray-800 dark:text-gray-200 font-medium">Uçak, otobüs ve diğer ulaşım seçeneklerinin fiyat karşılaştırması ve rezervasyon bağlantıları.</p>
              <Link href="/transportation" className="mt-4 inline-block text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 text-sm font-medium">
                Ulaşım Seçeneklerine Git →
              </Link>
            </div>
            
            {/* Feature 6 */}
            <div className="bg-yellow-50 dark:bg-yellow-900 rounded-xl p-6 transition-all hover-lift fade-in delay-400">
              <div className="bg-yellow-600 text-white rounded-full w-12 h-12 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Konaklama Seçenekleri</h3>
              <p className="text-gray-800 dark:text-gray-200 font-medium">Bütçenize ve tercihlerinize göre en uygun konaklama seçeneklerini bulun ve rezervasyon yapın.</p>
              <Link href="/accommodation" className="mt-4 inline-block text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300 text-sm font-medium">
                Konaklama Seçeneklerine Git →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section - New */}
      <section className="py-16 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4 fade-in text-gray-900 dark:text-white">Nasıl Çalışır?</h2>
          <p className="text-center text-gray-800 dark:text-gray-200 font-medium max-w-2xl mx-auto mb-12 fade-in delay-100">
            Birkaç basit adımda seyahat planınızı oluşturun ve seyahatinizi sorunsuz bir şekilde gerçekleştirin.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-gray-700 p-6 rounded-xl shadow-md hover-lift fade-in delay-100">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 flex items-center justify-center mb-4 text-xl font-bold">1</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Seyahat Bilgilerinizi Girin</h3>
              <p className="text-gray-800 dark:text-gray-200 font-medium">Tarih, bütçe, konum ve tercihlerinizi belirterek size özel planlamayı başlatın.</p>
            </div>
            
            <div className="bg-white dark:bg-gray-700 p-6 rounded-xl shadow-md hover-lift fade-in delay-200">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 flex items-center justify-center mb-4 text-xl font-bold">2</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Öneriler ve Seçenekler</h3>
              <p className="text-gray-800 dark:text-gray-200 font-medium">Ulaşım, konaklama ve aktivite önerilerini inceleyin ve size uygun olanları seçin.</p>
            </div>
            
            <div className="bg-white dark:bg-gray-700 p-6 rounded-xl shadow-md hover-lift fade-in delay-300">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 flex items-center justify-center mb-4 text-xl font-bold">3</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Seyahat Planınızı Oluşturun</h3>
              <p className="text-gray-800 dark:text-gray-200 font-medium">Tüm seçimlerinizi bir araya getirerek tam bir seyahat planı oluşturun ve kaydedin.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section with enhanced animation and design */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-indigo-700 dark:from-blue-800 dark:to-indigo-900 text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full">
          <svg className="absolute left-0 top-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 1440 560">
            <path fill="rgba(255,255,255,0.05)" d="M0,0L48,37.3C96,75,192,149,288,165.3C384,181,480,139,576,144C672,149,768,203,864,208C960,213,1056,171,1152,144C1248,117,1344,107,1392,101.3L1440,96L1440,560L1392,560C1344,560,1248,560,1152,560C1056,560,960,560,864,560C768,560,672,560,576,560C480,560,384,560,288,560C192,560,96,560,48,560L0,560Z"></path>
          </svg>
        </div>
        
        <div className="max-w-6xl mx-auto px-4 md:px-8 text-center relative z-10">
          <h2 className="text-2xl md:text-3xl font-bold mb-6 fade-in">Hayalinizdeki Tatili Planlamaya Başlayın</h2>
          <p className="text-lg mb-8 max-w-2xl mx-auto fade-in delay-100">
            Sadece birkaç tıklama ile kişiselleştirilmiş, bütçenize uygun ve zamanınızı en iyi şekilde değerlendireceğiniz bir seyahat planı oluşturun.
          </p>
          <button 
            onClick={() => handlePlanClick('/ai-planner')}
            className="px-6 py-3 bg-white text-blue-600 dark:bg-gray-800 dark:text-blue-400 rounded-lg font-medium shadow-md hover:bg-blue-50 dark:hover:bg-gray-700 transition inline-block hover-lift fade-in delay-200 cursor-pointer"
          >
            Ücretsiz Planlayıcıyı Kullanın
          </button>
        </div>
      </section>

      {/* Footer with enhanced design */}
      <footer className="py-8 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8">
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400 mb-4 md:mb-0">Trip Planner</div>
            
            <div className="flex space-x-6">
              <Link href="/" className="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition">Ana Sayfa</Link>
              <Link href="/map" className="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition">Rota Planlayıcı</Link>
              <Link href="/daily-planner" className="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition">Günlük Plan</Link>
              <Link href="/budget" className="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition">Bütçe</Link>
            </div>
          </div>
          
          <div className="border-t border-gray-200 dark:border-gray-800 pt-6 text-center">
            <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">
              &copy; {new Date().getFullYear()} AnkaGeo Trip Planner - Tüm hakları saklıdır.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
