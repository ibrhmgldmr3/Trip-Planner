"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast, Toaster } from "react-hot-toast";


interface Trip {
    id: string;
    title: string;
    description: string;
    createdAt: string;
    city?: string;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState({
    id: "",
    name: "",
    email: "",
  });
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'loading') return; // Hala session yükleniyor
    
    if (status === 'unauthenticated') {
      toast.error('Bu sayfayı görüntülemek için giriş yapmanız gerekiyor');
      router.push('/login');
      return;
    }
    
    if (status === 'authenticated') {
      fetchTrips();
    }
  }, [status, router]);

  const fetchTrips = async () => {
    try {
      const response = await fetch('/api/my-trips');
      if (response.ok) {
        const data = await response.json();
        setTrips(data.trips || []);
      } else {
        setError('Planlar yüklenemedi');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Planlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-nature-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-primary-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-nature-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-nature-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">Gezi Planlarım</h1>
          
          {trips.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 mb-4">Henüz hiç gezi planınız yok.</p>
              <a 
                href="/ai-planner" 
                className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors"
              >
                İlk Planınızı Oluşturun
              </a>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {trips.map((trip: Trip) => (
                <div key={trip.id} className="travel-card bg-white rounded-xl shadow-lg overflow-hidden">
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">{trip.title}</h3>
                    <p className="text-gray-600 mb-4">{trip.description}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">
                        {trip.createdAt ? new Date(trip.createdAt).toLocaleDateString('tr-TR') : ''}
                      </span>
                      <a 
                        href={`/plan-detail/${trip.id}`}
                        className="text-primary-600 hover:text-primary-800 font-medium"
                      >
                        Detayları Gör
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <Toaster />
    </div>
  );
}