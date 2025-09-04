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
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Hero Section with enhanced animations */}
      <section className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900 dark:via-indigo-900 dark:to-purple-900 py-16 md:py-24 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute w-96 h-96 bg-gradient-to-br from-blue-200/20 to-purple-200/20 dark:from-blue-800/20 dark:to-purple-800/20 rounded-full -top-48 -left-48 animate-pulse"></div>
          <div className="absolute w-80 h-80 bg-gradient-to-br from-green-200/20 to-blue-200/20 dark:from-green-800/20 dark:to-blue-800/20 rounded-full -bottom-40 -right-40 animate-pulse" style={{ animationDelay: "2s" }}></div>
          <div className="absolute w-64 h-64 bg-gradient-to-br from-purple-200/20 to-pink-200/20 dark:from-purple-800/20 dark:to-pink-800/20 rounded-full top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" style={{ animationDelay: "4s" }}></div>
        </div>
        
        <div className="max-w-6xl mx-auto px-4 md:px-8 text-gray-800 dark:text-gray-200 relative z-10">
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
                  className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold shadow-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-300 hover-lift btn-modern ripple"
                >
                  Planlamaya Başlayın
                </button>
                <button 
                  onClick={() => handlePlanClick('/my-plans')}
                  className="px-6 py-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold shadow-lg hover:from-green-700 hover:to-green-800 transition-all duration-300 hover-lift btn-modern ripple"
                >
                  Planlarım
                </button>
                <Link 
                  href="/map" 
                  className="px-6 py-4 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 text-blue-600 dark:text-blue-400 border-2 border-blue-200 dark:border-blue-800 rounded-xl font-semibold hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300 hover-lift btn-modern"
                >
                  Rota Planlayıcı
                </Link>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-2xl hover-lift card-hover float">
              <div 
                className="w-full h-64 bg-gradient-to-br from-blue-100 via-purple-100 to-indigo-200 dark:from-blue-800 dark:via-purple-800 dark:to-indigo-900 rounded-xl flex items-center justify-center overflow-hidden relative"
              >
                <div className="text-blue-600 dark:text-blue-300 relative z-10">
                  <div className="absolute w-32 h-32 bg-gradient-to-br from-blue-200 to-purple-200 dark:from-blue-700 dark:to-purple-700 rounded-full -top-16 -left-16 opacity-50 float"></div>
                  <div className="absolute w-20 h-20 bg-gradient-to-br from-green-200 to-teal-200 dark:from-green-700 dark:to-teal-700 rounded-full -bottom-10 -right-10 opacity-50 float" style={{ animationDelay: "1s" }}></div>
                  
                  <div className="relative text-center">
                    <div className="inline-block p-4 bg-white/80 dark:bg-gray-800/80 rounded-full shadow-lg mb-4 hover-glow">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto pop-in" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                    </div>
                    <p className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      Akıllı Seyahat Planlama
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      AI destekli optimizasyon
                    </p>
                  </div>
                </div>
                
                {/* Animated background elements */}
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute w-4 h-4 bg-yellow-400 rounded-full top-4 left-4 animate-ping"></div>
                  <div className="absolute w-3 h-3 bg-pink-400 rounded-full top-8 right-8 animate-pulse"></div>
                  <div className="absolute w-5 h-5 bg-green-400 rounded-full bottom-6 left-6 animate-bounce"></div>
                </div>
              </div>
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
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 rounded-2xl p-8 transition-all hover-lift card-hover fade-in delay-100 border border-blue-200 dark:border-blue-700">
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-2xl w-16 h-16 flex items-center justify-center mb-6 shadow-lg hover-glow">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Akıllı Rota Planlama</h3>
              <p className="text-gray-700 dark:text-gray-200 font-medium mb-6 leading-relaxed">En optimum rotaları hesaplayarak, zamanınızı verimli kullanmanızı sağlıyoruz. AI destekli algoritma ile en kısa yolu buluyoruz.</p>
              <Link href="/map" className="inline-flex items-center space-x-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold transition-all duration-300 hover-lift">
                <span>Rota Planlayıcıya Git</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            
            {/* Feature 2 */}
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900 dark:to-indigo-800 rounded-2xl p-8 transition-all hover-lift card-hover fade-in delay-200 border border-indigo-200 dark:border-indigo-700">
              <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-2xl w-16 h-16 flex items-center justify-center mb-6 shadow-lg hover-glow">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">💰 Maliyet Analizi</h3>
              <p className="text-gray-700 dark:text-gray-200 font-medium mb-6 leading-relaxed">Ulaşım, konaklama ve aktivite maliyetlerini detaylı analiz ederek bütçenizi optimize ediyoruz.</p>
              <Link href="/budget" className="inline-flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-semibold transition-all duration-300 hover-lift">
                <span>Maliyet Planlayıcıya Git</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
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
              <Link href="/budget" className="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition">Maliyet</Link>
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
