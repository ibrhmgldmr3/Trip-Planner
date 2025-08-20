"use client";

export default function MapPage() {
  return (
    <main className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="max-w-6xl mx-auto">
        
        <div className="mt-8 p-4 bg-white rounded-xl shadow-md text-center fade-in delay-400">
          <p className="text-sm text-gray-500">
            Bu uygulama ile şehirlerinizde ve seyahatlerinizde en verimli rotaları planlayabilirsiniz. 
            Haritada belirlediğiniz merkez etrafındaki ilgi çekici noktaları keşfedin ve en kısa rotayı otomatik olarak oluşturun.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            &copy; {new Date().getFullYear()} Trip Planner - Tüm hakları saklıdır.
          </p>
        </div>
      </div>
    </main>
  );
}
