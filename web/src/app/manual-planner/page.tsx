'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

// TypeScript interfaces
interface BasicInfo {
  destination: string;
  country: string;
  startDate: string;
  endDate: string;
  travelers: number;
  travelStyle: string;
}

interface TransportOption {
  id: string;
  type: string;
  provider: string;
  price: number;
  duration: string;
  departure: string;
  arrival: string;
  selected: boolean;
}

interface AccommodationOption {
  id: string;
  name: string;
  type: string;
  rating: number;
  price: number;
  location: string;
  amenities: string[];
  selected: boolean;
}

interface DayPlan {
  day: number;
  activities: Activity[];
  notes: string;
  isEmpty: boolean;
}

interface Activity {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  cost: number;
  description?: string;
}

interface BudgetAnalysis {
  currentBudget: number;
  estimatedTotal: number;
  breakdown: {
    transport: number;
    accommodation: number;
    activities: number;
    food: number;
    other: number;
  };
}

interface TravelPlan {
  basicInfo: BasicInfo;
  transport: TransportOption | null;
  accommodation: AccommodationOption | null;
  dailyPlans: DayPlan[];
  budget: BudgetAnalysis;
}

// DayPlanCard component
interface DayPlanCardProps {
  day: DayPlan;
  dayIndex: number;
  onPlanChange: (dayIndex: number, field: keyof DayPlan, value: string | boolean) => void;
  onAddActivity: (dayIndex: number, activity: Activity) => void;
  onRemoveActivity: (dayIndex: number, activityIndex: number) => void;
}

function DayPlanCard({ day, dayIndex, onPlanChange, onAddActivity, onRemoveActivity }: DayPlanCardProps) {
  const [newActivity, setNewActivity] = useState({
    name: '',
    startTime: '',
    endTime: '',
    cost: 0,
    description: ''
  });

  const handleAddActivity = () => {
    if (newActivity.name.trim() && newActivity.startTime && newActivity.endTime) {
      const activity: Activity = {
        id: Date.now().toString(),
        name: newActivity.name.trim(),
        startTime: newActivity.startTime,
        endTime: newActivity.endTime,
        cost: newActivity.cost,
        description: newActivity.description
      };
      onAddActivity(dayIndex, activity);
      setNewActivity({
        name: '',
        startTime: '',
        endTime: '',
        cost: 0,
        description: ''
      });
    }
  };

  return (
    <div className="p-6 border border-gray-200 dark:border-gray-600 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
          {day.day}. Gün
        </h3>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={day.isEmpty}
            onChange={(e) => onPlanChange(dayIndex, 'isEmpty', e.target.checked)}
            className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 dark:focus:ring-green-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
          />
          <span className="text-sm text-gray-600 dark:text-gray-300">Boş gün</span>
        </label>
      </div>

      {!day.isEmpty && (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Aktiviteler
            </label>
            <div className="space-y-3 mb-4">
              {day.activities.map((activity, actIndex) => (
                <div key={activity.id} className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-blue-800 dark:text-blue-200">{activity.name}</h4>
                    <button
                      onClick={() => onRemoveActivity(dayIndex, actIndex)}
                      className="text-red-500 hover:text-red-700 ml-2"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm text-blue-700 dark:text-blue-300">
                    <div>
                      <span className="font-medium">Saat:</span> {activity.startTime} - {activity.endTime}
                    </div>
                    <div>
                      <span className="font-medium">Maliyet:</span> ₺{activity.cost}
                    </div>
                    <div className="text-right">
                      <span className="text-xs bg-blue-200 dark:bg-blue-800 px-2 py-1 rounded">
                        {(() => {
                          const start = new Date(`1970-01-01T${activity.startTime}:00`);
                          const end = new Date(`1970-01-01T${activity.endTime}:00`);
                          const diffMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
                          return `${Math.round(diffMinutes)} dk`;
                        })()}
                      </span>
                    </div>
                  </div>
                  {activity.description && (
                    <p className="text-sm text-blue-600 dark:text-blue-400 mt-2 italic">
                      {activity.description}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Aktivite Ekleme Formu */}
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Yeni Aktivite Ekle</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Aktivite Adı *
                  </label>
                  <input
                    type="text"
                    value={newActivity.name}
                    onChange={(e) => setNewActivity({...newActivity, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-800 dark:text-white text-sm"
                    placeholder="Ör: Müze ziyareti"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Maliyet (₺) *
                  </label>
                  <input
                    type="number"
                    value={newActivity.cost}
                    onChange={(e) => setNewActivity({...newActivity, cost: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-800 dark:text-white text-sm"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Başlangıç Saati *
                  </label>
                  <input
                    type="time"
                    value={newActivity.startTime}
                    onChange={(e) => setNewActivity({...newActivity, startTime: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-800 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Bitiş Saati *
                  </label>
                  <input
                    type="time"
                    value={newActivity.endTime}
                    onChange={(e) => setNewActivity({...newActivity, endTime: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-800 dark:text-white text-sm"
                  />
                </div>
              </div>
              
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Açıklama (İsteğe bağlı)
                </label>
                <textarea
                  value={newActivity.description}
                  onChange={(e) => setNewActivity({...newActivity, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-800 dark:text-white text-sm"
                  placeholder="Aktivite hakkında notlar..."
                  rows={2}
                />
              </div>
              
              <button
                onClick={handleAddActivity}
                disabled={!newActivity.name.trim() || !newActivity.startTime || !newActivity.endTime}
                className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
              >
                Aktivite Ekle
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Günlük Notlar
            </label>
            <textarea
              value={day.notes}
              onChange={(e) => onPlanChange(dayIndex, 'notes', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              rows={2}
              placeholder="Bu güne ait özel notlarınız..."
            />
          </div>

          {/* Günlük Özet */}
          {day.activities.length > 0 && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex justify-between items-center text-sm">
                <span className="text-green-700 dark:text-green-300">
                  <strong>Günlük Özet:</strong> {day.activities.length} aktivite
                </span>
                <span className="text-green-700 dark:text-green-300 font-bold">
                  Toplam: ₺{day.activities.reduce((sum, act) => sum + act.cost, 0)}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {day.isEmpty && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <span className="text-4xl">😴</span>
          <p className="mt-2">Bu gün dinlenme günü olarak ayarlandı</p>
        </div>
      )}
    </div>
  );
}

export default function ManualPlannerPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [travelPlan, setTravelPlan] = useState<TravelPlan>({
    basicInfo: {
      destination: '',
      country: '',
      startDate: '',
      endDate: '',
      travelers: 1,
      travelStyle: 'standard'
    },
    transport: null,
    accommodation: null,
    dailyPlans: [],
    budget: {
      currentBudget: 0,
      estimatedTotal: 0,
      breakdown: {
        transport: 0,
        accommodation: 0,
        activities: 0,
        food: 0,
        other: 0
      }
    }
  });

  // Mock data - gerçek uygulamada API'den gelecek
  const [transportOptions, setTransportOptions] = useState<TransportOption[]>([]);
  const [accommodationOptions, setAccommodationOptions] = useState<AccommodationOption[]>([]);

  const steps = [
    { id: 1, title: 'Temel Bilgiler', icon: '📍' },
    { id: 2, title: 'Ulaşım', icon: '✈️' },
    { id: 3, title: 'Konaklama', icon: '🏨' },
    { id: 4, title: 'Günlük Planlar', icon: '📅' },
    { id: 5, title: 'Bütçe Analizi', icon: '💰' },
    { id: 6, title: 'Özet & Kaydet', icon: '✅' }
  ];

  // Calculate trip duration
  const getTripDuration = useCallback(() => {
    if (!travelPlan.basicInfo.startDate || !travelPlan.basicInfo.endDate) return 0;
    const start = new Date(travelPlan.basicInfo.startDate);
    const end = new Date(travelPlan.basicInfo.endDate);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }, [travelPlan.basicInfo.startDate, travelPlan.basicInfo.endDate]);

  // Initialize daily plans when dates change
  useEffect(() => {
    const duration = getTripDuration();
    if (duration > 0 && duration !== travelPlan.dailyPlans.length) {
      const newPlans: DayPlan[] = Array.from({ length: duration }, (_, index) => ({
        day: index + 1,
        activities: [],
        notes: '',
        isEmpty: false
      }));
      setTravelPlan(prev => ({ ...prev, dailyPlans: newPlans }));
    }
  }, [travelPlan.basicInfo.startDate, travelPlan.basicInfo.endDate, getTripDuration, travelPlan.dailyPlans.length]);

  // Mock API calls
  const fetchTransportOptions = async () => {
    // Simulated API call
    const mockTransport: TransportOption[] = [
      {
        id: '1',
        type: 'Uçak',
        provider: 'Turkish Airlines',
        price: 2500,
        duration: '2 saat 30 dk',
        departure: '10:00',
        arrival: '12:30',
        selected: false
      },
      {
        id: '2',
        type: 'Otobüs',
        provider: 'Metro Turizm',
        price: 150,
        duration: '8 saat',
        departure: '22:00',
        arrival: '06:00',
        selected: false
      },
      {
        id: '3',
        type: 'Kendi Aracı',
        provider: 'Özel Araç',
        price: 300,
        duration: '6 saat',
        departure: 'Esnek',
        arrival: 'Esnek',
        selected: false
      }
    ];
    setTransportOptions(mockTransport);
  };

  const fetchAccommodationOptions = async () => {
    // Simulated API call
    const mockAccommodation: AccommodationOption[] = [
      {
        id: '1',
        name: 'Grand Hotel',
        type: 'Otel',
        rating: 5,
        price: 800,
        location: 'Şehir Merkezi',
        amenities: ['WiFi', 'Kahvaltı', 'Spa', 'Havuz'],
        selected: false
      },
      {
        id: '2',
        name: 'Boutique Inn',
        type: 'Butik Otel',
        rating: 4,
        price: 450,
        location: 'Tarihi Bölge',
        amenities: ['WiFi', 'Kahvaltı', 'Restoran'],
        selected: false
      },
      {
        id: '3',
        name: 'Budget Hostel',
        type: 'Hostel',
        rating: 3,
        price: 120,
        location: 'Genç Bölge',
        amenities: ['WiFi', 'Ortak Mutfak'],
        selected: false
      }
    ];
    setAccommodationOptions(mockAccommodation);
  };

  const handleBasicInfoChange = (field: keyof BasicInfo, value: string | number) => {
    setTravelPlan(prev => ({
      ...prev,
      basicInfo: { ...prev.basicInfo, [field]: value }
    }));
  };

  const handleTransportSelect = (transportId: string) => {
    const selected = transportOptions.find(t => t.id === transportId);
    if (selected) {
      setTravelPlan(prev => ({
        ...prev,
        transport: { ...selected, selected: true },
        budget: {
          ...prev.budget,
          breakdown: { ...prev.budget.breakdown, transport: selected.price }
        }
      }));
    }
  };

  const handleAccommodationSelect = (accommodationId: string) => {
    const selected = accommodationOptions.find(a => a.id === accommodationId);
    if (selected) {
      const totalNights = getTripDuration() - 1;
      const totalPrice = selected.price * totalNights;
      setTravelPlan(prev => ({
        ...prev,
        accommodation: { ...selected, selected: true },
        budget: {
          ...prev.budget,
          breakdown: { ...prev.budget.breakdown, accommodation: totalPrice }
        }
      }));
    }
  };

  const handleDayPlanChange = (dayIndex: number, field: keyof DayPlan, value: string | boolean) => {
    setTravelPlan(prev => ({
      ...prev,
      dailyPlans: prev.dailyPlans.map((plan, index) =>
        index === dayIndex ? { ...plan, [field]: value } : plan
      )
    }));
  };

  const addActivity = (dayIndex: number, activity: Activity) => {
    setTravelPlan(prev => ({
      ...prev,
      dailyPlans: prev.dailyPlans.map((plan, index) =>
        index === dayIndex
          ? { ...plan, activities: [...plan.activities, activity] }
          : plan
      )
    }));
  };

  const removeActivity = (dayIndex: number, activityIndex: number) => {
    setTravelPlan(prev => ({
      ...prev,
      dailyPlans: prev.dailyPlans.map((plan, index) =>
        index === dayIndex
          ? {
              ...plan,
              activities: plan.activities.filter((_, i) => i !== activityIndex)
            }
          : plan
      )
    }));
  };

  const calculateBudget = () => {
    const { transport, dailyPlans } = travelPlan;
    const breakdown = {
      transport: transport?.price || 0,
      accommodation: travelPlan.budget.breakdown.accommodation,
      activities: dailyPlans.length * 200, // Günlük ortalama aktivite maliyeti
      food: dailyPlans.length * 150, // Günlük ortalama yemek maliyeti
      other: 500 // Diğer masraflar
    };

    const estimatedTotal = Object.values(breakdown).reduce((sum, value) => sum + value, 0);

    setTravelPlan(prev => ({
      ...prev,
      budget: { ...prev.budget, breakdown, estimatedTotal }
    }));
  };

  const nextStep = () => {
    if (currentStep < steps.length) {
      if (currentStep === 1 && !travelPlan.basicInfo.destination) {
        toast.error('Lütfen hedef şehri belirtin');
        return;
      }
      if (currentStep === 2) {
        fetchTransportOptions();
      }
      if (currentStep === 3) {
        fetchAccommodationOptions();
      }
      if (currentStep === 5) {
        calculateBudget();
      }
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const savePlan = async () => {
    try {
      const response = await fetch('/api/manual-travel-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(travelPlan)
      });

      if (response.ok) {
        toast.success('Seyahat planınız başarıyla kaydedildi!');
        router.push('/my-plans');
      } else {
        toast.error('Plan kaydedilirken bir hata oluştu');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Plan kaydedilirken bir hata oluştu');
    }
  };

  const cancelPlan = () => {
    if (confirm('Planınızı iptal etmek istediğinizden emin misiniz? Tüm veriler kaybolacak.')) {
      router.push('/travel-mode');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-teal-50 dark:from-gray-900 dark:via-gray-800 dark:to-teal-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-4">
            Adım Adım Seyahat Planlama
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Seyahatinizi detaylıca planlayın ve bütçenizi kontrol edin
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex justify-center space-x-4 overflow-x-auto pb-4">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex flex-col items-center min-w-0 ${
                  currentStep >= step.id
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-400 dark:text-gray-600'
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-xl mb-2 transition-all duration-300 ${
                    currentStep >= step.id
                      ? 'bg-green-100 dark:bg-green-900 border-2 border-green-500'
                      : 'bg-gray-100 dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {step.icon}
                </div>
                <span className="text-sm font-medium text-center px-2">{step.title}</span>
                {index < steps.length - 1 && (
                  <div
                    className={`hidden md:block absolute top-6 left-full w-16 h-0.5 ${
                      currentStep > step.id ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                    style={{ marginLeft: '1rem' }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="max-w-4xl mx-auto">
          {/* Step 2: Ulaşım */}
          {currentStep === 2 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center">
                ✈️ Ulaşım Seçenekleri
              </h2>
              
              <div className="space-y-4">
                {transportOptions.map((option) => (
                  <div
                    key={option.id}
                    onClick={() => handleTransportSelect(option.id)}
                    className={`p-6 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                      travelPlan.transport?.id === option.id
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-green-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                          {option.type} - {option.provider}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-300">
                          Süre: {option.duration} | {option.departure} - {option.arrival}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                          ₺{option.price}
                        </span>
                        <p className="text-sm text-gray-500">kişi başı</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Konaklama */}
          {currentStep === 3 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center">
                🏨 Konaklama Seçenekleri
              </h2>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {accommodationOptions.map((option) => (
                  <div
                    key={option.id}
                    onClick={() => handleAccommodationSelect(option.id)}
                    className={`p-6 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                      travelPlan.accommodation?.id === option.id
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-green-300'
                    }`}
                  >
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
                      {option.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                      {option.type} • {option.location}
                    </p>
                    <div className="flex items-center mb-3">
                      {[...Array(5)].map((_, i) => (
                        <span
                          key={i}
                          className={`text-sm ${
                            i < option.rating ? 'text-yellow-400' : 'text-gray-300'
                          }`}
                        >
                          ⭐
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1 mb-4">
                      {option.amenities.map((amenity) => (
                        <span
                          key={amenity}
                          className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded"
                        >
                          {amenity}
                        </span>
                      ))}
                    </div>
                    <div className="text-center">
                      <span className="text-xl font-bold text-green-600 dark:text-green-400">
                        ₺{option.price}
                      </span>
                      <p className="text-sm text-gray-500">gecelik</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Günlük Planlar */}
          {currentStep === 4 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center">
                📅 Günlük Planlar
              </h2>
              
              <div className="space-y-6">
                {travelPlan.dailyPlans.map((day, index) => (
                  <DayPlanCard
                    key={index}
                    day={day}
                    dayIndex={index}
                    onPlanChange={handleDayPlanChange}
                    onAddActivity={addActivity}
                    onRemoveActivity={removeActivity}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Bütçe Analizi */}
          {currentStep === 5 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center">
                💰 Bütçe Analizi
              </h2>
              
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Mevcut Bütçeniz (₺)
                  </label>
                  <input
                    type="number"
                    value={travelPlan.budget.currentBudget}
                    onChange={(e) => setTravelPlan(prev => ({
                      ...prev,
                      budget: { ...prev.budget, currentBudget: parseFloat(e.target.value) || 0 }
                    }))}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="Örn: 10000"
                  />
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                    Tahmini Harcama Dağılımı
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(travelPlan.budget.breakdown).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="capitalize text-gray-600 dark:text-gray-300">
                          {key === 'transport' ? 'Ulaşım' :
                           key === 'accommodation' ? 'Konaklama' :
                           key === 'activities' ? 'Aktiviteler' :
                           key === 'food' ? 'Yemek' : 'Diğer'}:
                        </span>
                        <span className="font-semibold">₺{value}</span>
                      </div>
                    ))}
                    <hr className="my-2" />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Toplam:</span>
                      <span>₺{travelPlan.budget.estimatedTotal}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 rounded-lg">
                {travelPlan.budget.currentBudget > travelPlan.budget.estimatedTotal ? (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200">
                    <h4 className="font-semibold">✅ Bütçeniz Yeterli!</h4>
                    <p>Kalan tutar: ₺{travelPlan.budget.currentBudget - travelPlan.budget.estimatedTotal}</p>
                  </div>
                ) : (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200">
                    <h4 className="font-semibold">⚠️ Bütçe Aşımı!</h4>
                    <p>Eksik tutar: ₺{travelPlan.budget.estimatedTotal - travelPlan.budget.currentBudget}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 6: Özet & Kaydet */}
          {currentStep === 6 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center">
                ✅ Plan Özeti
              </h2>
              
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <h3 className="font-semibold text-gray-800 dark:text-white mb-2">Temel Bilgiler</h3>
                    <p><strong>Hedef:</strong> {travelPlan.basicInfo.destination}, {travelPlan.basicInfo.country}</p>
                    <p><strong>Tarih:</strong> {travelPlan.basicInfo.startDate} - {travelPlan.basicInfo.endDate}</p>
                    <p><strong>Süre:</strong> {getTripDuration()} gün</p>
                    <p><strong>Kişi:</strong> {travelPlan.basicInfo.travelers}</p>
                  </div>
                  
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <h3 className="font-semibold text-gray-800 dark:text-white mb-2">Seçimler</h3>
                    <p><strong>Ulaşım:</strong> {travelPlan.transport?.type} - ₺{travelPlan.transport?.price}</p>
                    <p><strong>Konaklama:</strong> {travelPlan.accommodation?.name} - ₺{travelPlan.accommodation?.price}/gece</p>
                    <p><strong>Toplam Maliyet:</strong> ₺{travelPlan.budget.estimatedTotal}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {currentStep === 1 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center">
                📍 Temel Bilgiler
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Hedef Şehir *
                  </label>
                  <input
                    type="text"
                    value={travelPlan.basicInfo.destination}
                    onChange={(e) => handleBasicInfoChange('destination', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="Örn: İstanbul"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ülke
                  </label>
                  <input
                    type="text"
                    value={travelPlan.basicInfo.country}
                    onChange={(e) => handleBasicInfoChange('country', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="Örn: Türkiye"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Başlangıç Tarihi *
                  </label>
                  <input
                    type="date"
                    value={travelPlan.basicInfo.startDate}
                    onChange={(e) => handleBasicInfoChange('startDate', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Bitiş Tarihi *
                  </label>
                  <input
                    type="date"
                    value={travelPlan.basicInfo.endDate}
                    onChange={(e) => handleBasicInfoChange('endDate', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Kişi Sayısı
                  </label>
                  <select
                    value={travelPlan.basicInfo.travelers}
                    onChange={(e) => handleBasicInfoChange('travelers', parseInt(e.target.value))}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  >
                    {[1, 2, 3, 4, 5, 6].map(num => (
                      <option key={num} value={num}>{num} kişi</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Seyahat Tarzı
                  </label>
                  <select
                    value={travelPlan.basicInfo.travelStyle}
                    onChange={(e) => handleBasicInfoChange('travelStyle', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  >
                    <option value="budget">Ekonomik</option>
                    <option value="standard">Standart</option>
                    <option value="luxury">Lüks</option>
                    <option value="adventure">Macera</option>
                    <option value="cultural">Kültürel</option>
                  </select>
                </div>
              </div>

              {getTripDuration() > 0 && (
                <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-green-800 dark:text-green-200">
                    <strong>Seyahat Süresi:</strong> {getTripDuration()} gün
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="mt-8 flex justify-between">
            <button
              onClick={prevStep}
              disabled={currentStep === 1}
              className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Önceki
            </button>
            
            <div className="text-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {currentStep} / {steps.length}
              </span>
            </div>
            
            {currentStep < steps.length ? (
              <button
                onClick={nextStep}
                className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                Sonraki
              </button>
            ) : (
              <div className="space-x-4">
                <button
                  onClick={cancelPlan}
                  className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  İptal Et
                </button>
                <button
                  onClick={savePlan}
                  className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  Kaydet
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
