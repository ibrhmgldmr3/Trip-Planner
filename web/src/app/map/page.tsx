"use client";

import dynamic from 'next/dynamic';
import Link from "next/link";
import { Suspense, useEffect, useState } from 'react';

const LeafletMapView = dynamic(() => 
  import('@/app/components/MapView').then(mod => mod.default), {
  ssr: false,
  loading: () => <MapLoading />
});

const GoogleMapView = dynamic(() => 
  import('../../components/MapView').then(mod => mod.default), {
  ssr: false,
  loading: () => <MapLoading />
});

// Loading component
function MapLoading() {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 dark:bg-gray-800 dark:border-gray-700 flex items-center justify-center" style={{ height: "70vh" }}>
      <div className="text-center p-6">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-300">Harita yükleniyor...</p>
      </div>
    </div>
  );
}

export default function MapPage() {
  const [useGoogleMaps, setUseGoogleMaps] = useState(true);
  
  // Use localStorage to persist the user's map preference
  useEffect(() => {
    const savedPreference = localStorage.getItem('mapProvider');
    if (savedPreference) {
      setUseGoogleMaps(savedPreference === 'google');
    }
  }, []);
  
  const toggleMapProvider = () => {
    const newValue = !useGoogleMaps;
    setUseGoogleMaps(newValue);
    localStorage.setItem('mapProvider', newValue ? 'google' : 'leaflet');
  };

  return (
    <main className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-slate-900">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="fade-in">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              Rota Planlayıcı
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2 max-w-2xl">
              Şehir gezileri için en verimli rotayı planlayın. Haritaya tıklayarak merkez noktayı 
              değiştirin, ilgi çekici yerleri (POI) getirin ve optimum bir rota oluşturun.
            </p>
          </div>
          <div className="flex gap-3 mt-4 md:mt-0">
            <button
              onClick={toggleMapProvider}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors hover-lift fade-in delay-100"
            >
              {useGoogleMaps ? 'Leaflet Harita Kullan' : 'Google Harita Kullan'}
            </button>
            <Link 
              href="/"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors self-start hover-lift fade-in delay-100"
            >
              Ana Sayfaya Dön
            </Link>
          </div>
        </div>

        <div className="mb-8 fade-in delay-200">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-blue-100 dark:border-blue-900">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Nasıl Kullanılır
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg hover-scale">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 flex items-center justify-center mb-3 mx-auto text-lg font-bold">1</div>
                <p className="text-center text-sm text-blue-800 dark:text-blue-300">Haritaya tıklayarak merkez noktayı belirleyin</p>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg hover-scale">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 flex items-center justify-center mb-3 mx-auto text-lg font-bold">2</div>
                <p className="text-center text-sm text-blue-800 dark:text-blue-300">&quot;POI Getir&quot; butonuna tıklayarak yakındaki ilgi çekici yerleri getirin</p>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg hover-scale">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 flex items-center justify-center mb-3 mx-auto text-lg font-bold">3</div>
                <p className="text-center text-sm text-blue-800 dark:text-blue-300">İşaretlere tıklayarak POI&apos;leri rotanıza ekleyin veya çıkarın</p>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg hover-scale">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 flex items-center justify-center mb-3 mx-auto text-lg font-bold">4</div>
                <p className="text-center text-sm text-blue-800 dark:text-blue-300">&quot;Rota Oluştur&quot; butonuna tıklayarak en verimli rotayı oluşturun</p>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg hover-scale">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 flex items-center justify-center mb-3 mx-auto text-lg font-bold">5</div>
                <p className="text-center text-sm text-blue-800 dark:text-blue-300">Rota oluşturulduktan sonra istatistikleri görüntüleyin</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden shadow-lg fade-in delay-300">
          <Suspense fallback={<MapLoading />}>
            {useGoogleMaps ? <GoogleMapView /> : <LeafletMapView />}
          </Suspense>
        </div>
        
        <div className="mt-8 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md text-center fade-in delay-400">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Bu uygulama ile şehirlerinizde ve seyahatlerinizde en verimli rotaları planlayabilirsiniz. 
            Haritada belirlediğiniz merkez etrafındaki ilgi çekici noktaları keşfedin ve en kısa rotayı otomatik olarak oluşturun.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            &copy; {new Date().getFullYear()} Trip Planner - Tüm hakları saklıdır.
          </p>
        </div>
      </div>
    </main>
  );
}
