import Link from "next/link";

export default function PlannerPage() {
  return (
    <main className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Seyahat Planlaması
            </h1>
            <p className="text-gray-600 mt-2 max-w-2xl">
              Tarihinizi, bütçenizi ve tercihlerinizi belirleyerek kişiselleştirilmiş seyahat planınızı oluşturun.
            </p>
          </div>
          <Link 
            href="/"
            className="mt-4 md:mt-0 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors self-start"
          >
            Ana Sayfaya Dön
          </Link>
        </div>

        {/* Form Section */}
        <div className="bg-white p-6 rounded-xl shadow-md mb-8">
          <h2 className="text-xl font-semibold mb-6 text-gray-800">Seyahat Bilgileriniz</h2>
          
          <form className="space-y-6">
            {/* Destination */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">Gidilecek Şehir</label>
                <input 
                  type="text" 
                  id="city" 
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  placeholder="Örn: İstanbul"
                />
              </div>
              
              <div>
                <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">Ülke</label>
                <input 
                  type="text" 
                  id="country" 
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  placeholder="Örn: Türkiye"
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">Başlangıç Tarihi</label>
                <input 
                  type="date" 
                  id="startDate" 
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                />
              </div>
              
              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">Bitiş Tarihi</label>
                <input 
                  type="date" 
                  id="endDate" 
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                />
              </div>
            </div>

            {/* Budget */}
            <div>
              <label htmlFor="budget" className="block text-sm font-medium text-gray-700 mb-1">Bütçe (TL)</label>
              <input 
                type="number" 
                id="budget" 
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                placeholder="Örn: 10000"
              />
            </div>

            {/* Transportation */}
            <div>
              <span className="block text-sm font-medium text-gray-700 mb-2">Ulaşım Tercihleri</span>
              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center">
                  <input type="checkbox" className="form-checkbox text-blue-600" />
                  <span className="ml-2">Uçak</span>
                </label>
                <label className="inline-flex items-center">
                  <input type="checkbox" className="form-checkbox text-blue-600" />
                  <span className="ml-2">Otobüs</span>
                </label>
                <label className="inline-flex items-center">
                  <input type="checkbox" className="form-checkbox text-blue-600" />
                  <span className="ml-2">Tren</span>
                </label>
                <label className="inline-flex items-center">
                  <input type="checkbox" className="form-checkbox text-blue-600" />
                  <span className="ml-2">Araba</span>
                </label>
              </div>
            </div>

            {/* Interests */}
            <div>
              <span className="block text-sm font-medium text-gray-700 mb-2">İlgi Alanları</span>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <label className="inline-flex items-center">
                  <input type="checkbox" className="form-checkbox text-blue-600" />
                  <span className="ml-2">Tarihi Yerler</span>
                </label>
                <label className="inline-flex items-center">
                  <input type="checkbox" className="form-checkbox text-blue-600" />
                  <span className="ml-2">Müzeler</span>
                </label>
                <label className="inline-flex items-center">
                  <input type="checkbox" className="form-checkbox text-blue-600" />
                  <span className="ml-2">Doğa</span>
                </label>
                <label className="inline-flex items-center">
                  <input type="checkbox" className="form-checkbox text-blue-600" />
                  <span className="ml-2">Gastronomi</span>
                </label>
                <label className="inline-flex items-center">
                  <input type="checkbox" className="form-checkbox text-blue-600" />
                  <span className="ml-2">Alışveriş</span>
                </label>
                <label className="inline-flex items-center">
                  <input type="checkbox" className="form-checkbox text-blue-600" />
                  <span className="ml-2">Eğlence</span>
                </label>
              </div>
            </div>

            {/* Additional Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Ek Notlar</label>
              <textarea 
                id="notes" 
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                placeholder="Seyahatinizle ilgili eklemek istediğiniz notlar..."
              ></textarea>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <button 
                type="submit"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium shadow-md hover:bg-blue-700 transition"
              >
                Plan Oluştur
              </button>
            </div>
          </form>
        </div>

        {/* Coming Soon Message */}
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-center mb-8">
          <p className="text-yellow-800">
            <strong>Bilgilendirme:</strong> Bu özellik yakında aktif olacaktır. Şu an için 
            <Link href="/map" className="text-blue-600 hover:underline mx-1">Rota Planlayıcı</Link>
            kullanabilirsiniz.
          </p>
        </div>
        
        {/* Kullanıcı Senaryoları Bölümü */}
        <div className="bg-white p-6 rounded-xl shadow-md mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Kullanıcı Senaryoları</h2>
          
          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Senaryo 1 – Detaylı Tatil Planlama</h3>
              <div className="flex flex-col md:flex-row md:gap-8">
                <div className="mb-4 md:mb-0 md:w-1/3">
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <p className="text-blue-600 font-medium mb-2">Kullanıcı Girdisi:</p>
                    <p className="text-gray-700">&quot;21.08.2025 – 30.08.2025, İzmir, deniz gören yerler ve tatlıcılar, bütçe 15.000₺&quot;</p>
                  </div>
                </div>
                <div className="md:w-2/3">
                  <p className="text-blue-600 font-medium mb-2">Sistemin Yanıtı:</p>
                  <ol className="list-decimal list-inside space-y-1 text-gray-700 ml-2">
                    <li>İzmir&apos;deki POI&apos;leri (sahil, tatlıcı, tarihi yerler) getirir</li>
                    <li>Uçuş biletlerini listeler</li>
                    <li>Günlük rota planı oluşturur</li>
                    <li>Tahmini bütçe çıkartır</li>
                  </ol>
                </div>
              </div>
            </div>
            
            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Senaryo 2 – Sadece Şehir Girişi</h3>
              <div className="flex flex-col md:flex-row md:gap-8">
                <div className="mb-4 md:mb-0 md:w-1/3">
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <p className="text-indigo-600 font-medium mb-2">Kullanıcı Girdisi:</p>
                    <p className="text-gray-700">&quot;05.09.2025 – 08.09.2025 İstanbul&quot;</p>
                  </div>
                </div>
                <div className="md:w-2/3">
                  <p className="text-indigo-600 font-medium mb-2">Sistemin Yanıtı:</p>
                  <ol className="list-decimal list-inside space-y-1 text-gray-700 ml-2">
                    <li>En popüler 5 turistik mekanı listeler</li>
                    <li>Kullanıcıya rota önerir</li>
                    <li>Günlük plan sunar</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        
        {/* Sonuç Bölümü */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-6 rounded-xl shadow-md mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Sonuç</h2>
          <p className="text-gray-700 mb-4">
            Bu sistem, yapay zeka destekli tatil planlama çözümleri arasında kullanıcı dostu, özelleştirilebilir ve ekonomik bir seçenek sunmayı hedeflemektedir. İlk etapta temel işlevler (şehir seçimi, mekan önerisi, rota, bütçe) geliştirilecek; sonraki aşamalarda çoklu şehir planlama, sosyal paylaşım, konaklama entegrasyonu gibi ek özellikler eklenebilir.
          </p>
        </div>
        
        <div className="mt-8 text-sm text-gray-500 text-center">
          &copy; {new Date().getFullYear()} Trip Planner - Tüm hakları saklıdır.
        </div>
      </div>
    </main>
  );
}
