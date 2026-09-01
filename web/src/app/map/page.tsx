"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { logger } from "@/lib/logger";
import {
  gunleriCoz,
  type Koordinat,
  type PlanAktivitesi,
  type PlanGunu,
} from "@/lib/plan-budget";

/** Koordinatı çözülmüş aktivite; rota çizimi yalnızca bunlarla çalışıyor. */
type KoordinatliAktivite = PlanAktivitesi & { coordinates: Koordinat };

/** Sayfanın iki kipi: serbest POI arama ve kaydedilmiş bir planın rotası. */
type HaritaKipi = "kesfet" | "plan";

/** `/api/my-plans` listesinden bu sayfanın kullandığı alanlar. */
interface PlanOzeti {
  id: string;
  city: string;
  country: string | null;
  startDate: string | null;
}

interface POI {
  id: string;
  name: string;
  vicinity: string;
  rating?: number;
  types: string[];
  geometry: {
    location: {
      lat: () => number;
      lng: () => number;
    };
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  photos?: any[];
  price_level?: number;
}

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [map, setMap] = useState<any>(null);
  const [pois, setPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [selectedPois, setSelectedPois] = useState<POI[]>([]);
  const [routeInfo, setRouteInfo] = useState<{distance: string, duration: string} | null>(null);

  /**
   * Haritaya çizilen güncel rotanın polyline'ları.
   *
   * Ref, state değil: her değişiklik render tetiklemesin diye.
   * `google.maps.routes.Route` (yeni Routes API) `DirectionsRenderer`'ın
   * yerini alıyor; polyline'lar `route.createPolylines()`'tan geliyor ve
   * elle temizlenmesi gerekiyor — `DirectionsRenderer` gibi tek çağrıyla
   * temizlenen bir nesne yok.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rotaPolylineleriRef = useRef<any[]>([]);

  /* ---------------------------------------------------------------------- */
  /* Plan rotası kipi (Faz D)                                               */
  /* ---------------------------------------------------------------------- */

  const [kip, setKip] = useState<HaritaKipi>("kesfet");
  const [planlar, setPlanlar] = useState<PlanOzeti[]>([]);
  const [seciliPlanId, setSeciliPlanId] = useState<string>("");
  const [planGunleri, setPlanGunleri] = useState<PlanGunu[]>([]);
  const [seciliGun, setSeciliGun] = useState<number | null>(null);
  const [planYukleniyor, setPlanYukleniyor] = useState(false);
  const [konumlarCozuluyor, setKonumlarCozuluyor] = useState(false);

  /**
   * Plan kipinde haritaya eklenen işaretçiler.
   *
   * Ref, state değil: işaretçiler render'a girmiyor, yalnızca temizlenmek
   * için tutuluyorlar. State olsalardı her ekleme gereksiz bir render
   * tetiklerdi. (Keşfet kipindeki POI işaretçileri bugün hiç
   * temizlenmiyor — bilinen bir eksik; bu kip aynı hatayı tekrarlamıyor.)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const planMarkerlariRef = useRef<any[]>([]);

  useEffect(() => {
    const loadGoogleMaps = () => {
      // Google Maps API zaten yüklü mü kontrol et
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).google && (window as any).google.maps) {
        // API zaten yüklü, doğrudan haritayı oluştur
        initializeMap();
        return;
      }

      // Script zaten eklendi mi kontrol et
      const existingScript = document.getElementById('google-maps-script');
      if (existingScript) {
        // Script eklendi ama henüz yüklenmedi, onload event'ini bekle
        existingScript.addEventListener('load', initializeMap);
        return;
      }

      
      // Google Maps API'yi yükle
      // `v=weekly` ŞART: varsayılan (`v` belirtilmeyen) sürüm kanalında
      // `Place.searchNearby`/`Route.computeRoutes` istekleri, tam olarak
      // dokümantasyona uygun şekilde kurulmuş olsalar bile sunucuya hiç
      // gitmeden "Invalid LocationRestriction" gibi hatalarla istemci
      // tarafında reddediliyor — `weekly` kanalı bu doğrulayıcıyı düzeltiyor.
      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places,routes&v=weekly`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        initializeMap();
      };

      script.onerror = () => {
        logger.error("Google Maps API yüklenemedi");
        toast.error('Harita yüklenirken hata oluştu');
      };
      
      document.head.appendChild(script);
    };

    const initializeMap = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (mapRef.current && (window as any).google && (window as any).google.maps) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mapInstance = new (window as any).google.maps.Map(mapRef.current, {
            zoom: 13,
            center: { lat: 41.0082, lng: 28.9784 }, // Türkiye/İstanbul
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            mapTypeId: (window as any).google.maps.MapTypeId.ROADMAP,
          });
          
          setMap(mapInstance);
          setCurrentLocation({ lat: 39.9334, lng: 32.8597 });
        } catch (error) {
          logger.error("Harita oluşturulamadı", error);
          toast.error('Harita oluşturulamadı');
        }
      } else {
        logger.warn("Harita oluşturulamadı - gerekli elemanlar eksik");
      }
    };

    loadGoogleMaps();
  }, []);

  // Places API (New) `priceLevel` bir metin enum'u ("PRICE_LEVEL_MODERATE" gibi);
  // arayüz 0-4 arası nokta gösterdiği için sayıya çeviriyoruz.
  const priceLevelToNumber = (priceLevel: unknown): number | undefined => {
    const eslesme: Record<string, number> = {
      PRICE_LEVEL_FREE: 0,
      PRICE_LEVEL_INEXPENSIVE: 1,
      PRICE_LEVEL_MODERATE: 2,
      PRICE_LEVEL_EXPENSIVE: 3,
      PRICE_LEVEL_VERY_EXPENSIVE: 4,
    };
    return typeof priceLevel === "string" ? eslesme[priceLevel] : undefined;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const placeToPoi = (place: any): POI => ({
    id: place.id ?? "",
    name: place.displayName ?? "",
    vicinity: place.formattedAddress ?? "",
    rating: place.rating ?? undefined,
    types: place.types ?? [],
    geometry: { location: place.location },
    price_level: priceLevelToNumber(place.priceLevel),
  });

  /**
   * Places API (New) ile yakındaki yerleri arar.
   *
   * `PlacesService.nearbySearch` (legacy Places API) Google Cloud'da ayrı
   * bir etkinleştirme gerektiriyordu ve "legacy API" hatasına yol açıyordu;
   * `Place.searchNearby` aynı `places` kütüphanesinin güncel API'si.
   */
  const yakindaYerAra = async (
    types: string[],
    yaricap: number,
    markerRengi: string,
    basariMesaji: (adet: number) => string,
    sonucYokMesaji: string
  ) => {
    if (!map || !currentLocation) {
      toast.error('Harita henüz yüklenmedi!');
      return;
    }

    setLoading(true);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gmaps = (window as any).google.maps;

      const { places } = await gmaps.places.Place.searchNearby({
        fields: ["id", "displayName", "location", "types", "rating", "priceLevel", "formattedAddress"],
        locationRestriction: {
          center: new gmaps.LatLng(currentLocation.lat, currentLocation.lng),
          radius: yaricap,
        },
        includedTypes: types,
        maxResultCount: 8,
        rankPreference: gmaps.places.SearchNearbyRankPreference.POPULARITY,
      });

      setLoading(false);

      if (!places || places.length === 0) {
        toast.error(sonucYokMesaji);
        setPois([]);
        return;
      }

      const yeniPois: POI[] = places.map(placeToPoi);
      setPois(yeniPois);
      toast.success(basariMesaji(yeniPois.length));

      // Haritaya marker'ları ekle
      yeniPois.forEach((poi, index) => {
        new gmaps.Marker({
          position: poi.geometry.location,
          map: map,
          title: poi.name,
          label: (index + 1).toString(),
          icon: {
            url: `https://maps.google.com/mapfiles/ms/icons/${markerRengi}-dot.png`,
            scaledSize: new gmaps.Size(32, 32),
          },
        });
      });
    } catch (error) {
      setLoading(false);
      logger.error("Yakındaki yerler getirilemedi", error);
      toast.error('Yerler yüklenirken hata oluştu!');
    }
  };

  // POI'leri getir
  const fetchPOIs = () =>
    yakindaYerAra(
      ['tourist_attraction'],
      3000,
      'red',
      (adet) => `${adet} yer bulundu!`,
      'Bu bölgede hiç yer bulunamadı!'
    );

  // Belirli türde POI'leri getir
  const fetchPOIsByType = (types: string[]) =>
    yakindaYerAra(
      types,
      2000,
      'orange',
      (adet) => `${adet} yer bulundu!`,
      'Bu bölgede bu türde yer bulunamadı!'
    );

  // Mevcut konumu al
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          
          setCurrentLocation(pos);
          if (map) {
            map.setCenter(pos);
            map.setZoom(15);
            
            // Mevcut konum marker'ı
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            new (window as any).google.maps.Marker({
              position: pos,
              map: map,
              title: 'Mevcut Konumunuz',
              icon: {
                url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                scaledSize: new (window as any).google.maps.Size(40, 40)
              }
            });
          }
          toast.success('Konumunuz bulundu!');
        },
        () => {
          toast.error('Konum erişimi reddedildi!');
        }
      );
    }
  };

  // POI türlerini Türkçe'ye çevir
  const translateType = (type: string): string => {
    const translations: Record<string, string> = {
      'tourist_attraction': 'Turistik Yer',
      'restaurant': 'Restoran',
      'museum': 'Müze',
      'park': 'Park',
      'shopping_mall': 'AVM',
      'gas_station': 'Benzinlik',
      'hospital': 'Hastane',
      'bank': 'Banka',
      'atm': 'ATM',
      'pharmacy': 'Eczane',
      'lodging': 'Konaklama',
      'food': 'Yemek',
      'establishment': 'İşletme',
      'point_of_interest': 'İlgi Noktası'
    };
    return translations[type] || type;
  };

  // POI seç/seçimi kaldır
  const togglePoiSelection = (poi: POI) => {
    setSelectedPois(prev => {
      const isSelected = prev.some(p => 
        (p.id && poi.id && p.id === poi.id) || 
        (p.name === poi.name && p.vicinity === poi.vicinity)
      );
      
      if (isSelected) {
        // POI'yi listeden çıkar
        return prev.filter(p => 
          !((p.id && poi.id && p.id === poi.id) || 
            (p.name === poi.name && p.vicinity === poi.vicinity))
        );
      } else {
        // POI'yi listeye ekle
        return [...prev, poi];
      }
    });
  };

  // POI seçili mi kontrol et
  const isPoiSelected = (poi: POI) => {
    const isSelected = selectedPois.some(p => 
      (p.id && poi.id && p.id === poi.id) || 
      (p.name === poi.name && p.vicinity === poi.vicinity)
    );
    return isSelected;
  };

  // En kısa rotayı hesapla
  const calculateOptimalRoute = async () => {
    if (!map || !currentLocation || selectedPois.length === 0) {
      toast.error('Rota oluşturmak için en az 1 POI seçin!');
      return;
    }

    setLoading(true);
    rotaCizimiTemizle();

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gmaps = (window as any).google.maps;

      // POI'lerin koordinatları; son POI destination oluyor.
      const noktalar = selectedPois.map((poi) => ({
        lat: poi.geometry.location.lat(),
        lng: poi.geometry.location.lng(),
      }));
      const destination = noktalar.pop() ?? currentLocation;

      const { routes } = await gmaps.routes.Route.computeRoutes({
        origin: currentLocation,
        destination,
        intermediates: noktalar.map((location) => ({ location })),
        optimizeWaypointOrder: true, // En kısa rota için sırayı optimize et
        travelMode: "WALKING",
        routeModifiers: { avoidTolls: true },
        fields: ["path", "distanceMeters", "durationMillis"],
      });

      const route = routes?.[0];
      if (!route) {
        toast.error('Rota hesaplanamadı. Lütfen farklı POIler seçin.');
        return;
      }

      rotaPolylineleriRef.current = route.createPolylines({
        polylineOptions: { map, strokeColor: '#4285F4', strokeWeight: 4, strokeOpacity: 0.8 },
      });

      setRouteInfo({
        distance: `${(route.distanceMeters / 1000).toFixed(1)} km`,
        duration: `${Math.round(route.durationMillis / 60000)} dk`,
      });

      toast.success(`Rota oluşturuldu! ${selectedPois.length} POI için en kısa yol hesaplandı.`);
    } catch (error) {
      logger.error("Rota hesaplanamadı", error);
      toast.error('Rota hesaplanamadı. Lütfen farklı POIler seçin.');
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Plan rotası kipi (Faz D)                                               */
  /* ---------------------------------------------------------------------- */

  /** Haritadaki numaralı işaretçileri ve çizili rotayı kaldırır (her iki kip de kullanıyor). */
  const rotaCizimiTemizle = useCallback(() => {
    planMarkerlariRef.current.forEach((marker) => marker.setMap(null));
    planMarkerlariRef.current = [];

    rotaPolylineleriRef.current.forEach((polyline) => polyline.setMap(null));
    rotaPolylineleriRef.current = [];

    setRouteInfo(null);
  }, []);

  // Plan listesi yalnızca plan kipine geçildiğinde ve bir kez yükleniyor;
  // keşfet kipini kullanan bir ziyaretçi için gereksiz bir istek olurdu.
  useEffect(() => {
    if (kip !== "plan" || planlar.length > 0) return;

    let iptal = false;

    (async () => {
      try {
        const yanit = await fetch("/api/my-plans");
        if (!yanit.ok) {
          // 401 beklenen bir durum: giriş yapmamış kullanıcı.
          if (yanit.status !== 401) logger.warn("Planlar getirilemedi", undefined, { status: yanit.status });
          return;
        }

        const govde = await yanit.json();
        if (!iptal) setPlanlar(Array.isArray(govde?.plans) ? govde.plans : []);
      } catch (error) {
        logger.error("Planlar getirilemedi", error);
      }
    })();

    return () => {
      iptal = true;
    };
  }, [kip, planlar.length]);

  /** Seçilen planın gün planını okur ve koordinatlı aktiviteleri hazırlar. */
  const planiYukle = useCallback(
    async (planId: string) => {
      setPlanYukleniyor(true);
      rotaCizimiTemizle();

      try {
        const yanit = await fetch(`/api/plan-detail/${planId}`);
        if (!yanit.ok) {
          toast.error("Plan yüklenemedi");
          setPlanGunleri([]);
          setSeciliGun(null);
          return;
        }

        const govde = await yanit.json();
        // `gunleriCoz` markdown biçimli eski planlarda null dönüyor.
        const gunler = gunleriCoz(govde?.plan?.gun_plani) ?? [];

        setPlanGunleri(gunler);
        setSeciliGun(gunler[0]?.day ?? null);

        if (gunler.length === 0) {
          toast.error("Bu planın gün planı haritada gösterilebilecek biçimde değil");
        }
      } catch (error) {
        logger.error("Plan detayı getirilemedi", error);
        toast.error("Plan yüklenemedi");
        setPlanGunleri([]);
        setSeciliGun(null);
      } finally {
        setPlanYukleniyor(false);
      }
    },
    [rotaCizimiTemizle]
  );

  const aktifGun = planGunleri.find((gun) => gun.day === seciliGun) ?? null;
  // Tip koruyucu (`is`) şart: düz bir `filter` sonrası TypeScript
  // `coordinates`i hâlâ opsiyonel görüyor ve Directions çağrısı derlenmiyor.
  const koordinatliAktiviteler =
    aktifGun?.activities.filter((a): a is KoordinatliAktivite => Boolean(a.coordinates)) ?? [];
  const koordinatsizSayisi = (aktifGun?.activities.length ?? 0) - koordinatliAktiviteler.length;

  /**
   * "09:00" biçimindeki saati dakikaya çevirir.
   * Ayrıştırılamayan saatler sona atılıyor (sonsuz), böylece saati
   * belirsiz aktiviteler rotanın ortasına girip sırayı bozmuyor.
   */
  const saatDegeri = (deger: string): number => {
    const eslesme = deger.trim().match(/^(\d{1,2}):(\d{2})/);
    return eslesme ? Number(eslesme[1]) * 60 + Number(eslesme[2]) : Number.POSITIVE_INFINITY;
  };

  /**
   * Seçili günün rotasını çizer.
   *
   * Keşfet kipindeki rotadan farkı: waypoint'ler OPTİMİZE EDİLMİYOR.
   * Buradaki sıra kullanıcının planı — 09:00'daki müzeyi 15:00'teki
   * restorandan sonraya almak "daha kısa" olsa bile yanlış.
   */
  const planRotasiniCiz = async () => {
    if (!map) {
      toast.error("Harita henüz yüklenmedi!");
      return;
    }

    const sirali = koordinatliAktiviteler
      .map((aktivite, index) => ({ aktivite, index }))
      .sort(
        (a, b) =>
          saatDegeri(a.aktivite.startTime) - saatDegeri(b.aktivite.startTime) ||
          a.index - b.index
      )
      .map((x) => x.aktivite);

    if (sirali.length === 0) {
      toast.error("Bu günde koordinatı çözülmüş aktivite yok");
      return;
    }

    rotaCizimiTemizle();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gmaps = (window as any).google.maps;

    // Kendi işaretçilerimizi koyuyoruz: numara + aktivite adı.
    sirali.forEach((aktivite, index) => {
      const marker = new gmaps.Marker({
        position: aktivite.coordinates,
        map,
        title: `${index + 1}. ${aktivite.name}${aktivite.startTime ? ` (${aktivite.startTime})` : ""}`,
        label: String(index + 1),
      });
      planMarkerlariRef.current.push(marker);
    });

    if (sirali.length === 1) {
      map.setCenter(sirali[0].coordinates);
      map.setZoom(15);
      toast.success("Tek koordinatlı aktivite haritada gösterildi");
      return;
    }

    // Routes API en fazla 25 ara nokta kabul ediyor; fazlası sessizce
    // kırpılmak yerine kullanıcıya bildiriliyor.
    const araNoktalar = sirali.slice(1, -1);
    const kirpilan = Math.max(0, araNoktalar.length - 25);

    setLoading(true);

    try {
      const { routes } = await gmaps.routes.Route.computeRoutes({
        origin: sirali[0].coordinates,
        destination: sirali[sirali.length - 1].coordinates,
        intermediates: araNoktalar.slice(0, 25).map((a) => ({ location: a.coordinates })),
        optimizeWaypointOrder: false, // Sıra kullanıcının planı; optimize edilmiyor.
        travelMode: "WALKING",
        fields: ["path", "distanceMeters", "durationMillis"],
      });

      const route = routes?.[0];
      if (!route) {
        toast.error("Rota hesaplanamadı; işaretçiler haritada gösteriliyor");
        return;
      }

      rotaPolylineleriRef.current = route.createPolylines({
        polylineOptions: { map, strokeColor: '#4285F4', strokeWeight: 4, strokeOpacity: 0.8 },
      });

      setRouteInfo({
        distance: `${(route.distanceMeters / 1000).toFixed(1)} km`,
        duration: `${Math.round(route.durationMillis / 60000)} dk`,
      });

      toast.success(
        kirpilan > 0
          ? `Rota çizildi (${kirpilan} durak sınır nedeniyle rotaya alınamadı)`
          : `${sirali.length} durak için rota çizildi`
      );
    } catch (error) {
      logger.warn("Plan rotası hesaplanamadı", error);
      toast.error("Rota hesaplanamadı; işaretçiler haritada gösteriliyor");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Koordinatı olmayan aktiviteleri sunucuda çözdürür.
   *
   * Koordinatlar SUNUCUDAN geliyor (Google Geocoding); istemci yalnızca
   * tetikliyor. Böylece tarayıcı anahtarının kotası harcanmıyor ve
   * kullanıcı kendi planına rastgele koordinat yazamıyor.
   */
  const konumlariCoz = async () => {
    if (!seciliPlanId) return;

    setKonumlarCozuluyor(true);

    try {
      const yanit = await fetch(`/api/plan-detail/${seciliPlanId}/coordinates`, {
        method: "POST",
      });
      const govde = await yanit.json().catch(() => null);

      if (!yanit.ok) {
        toast.error(govde?.error || "Konumlar çözülemedi");
        return;
      }

      if (govde?.cozulen > 0) {
        toast.success(`${govde.cozulen} konum çözüldü`);
        // Plan yeniden okunuyor: koordinatlar sunucuda yazıldı.
        await planiYukle(seciliPlanId);
      } else {
        toast.error("Hiçbir konum çözülemedi; adresler fazla belirsiz olabilir");
      }
    } catch (error) {
      logger.error("Konumlar çözülemedi", error);
      toast.error("Konumlar çözülemedi");
    } finally {
      setKonumlarCozuluyor(false);
    }
  };

  // Rotayı temizle
  const clearRoute = () => {
    rotaCizimiTemizle();
    setSelectedPois([]);
    toast.success('Rota ve seçimler temizlendi');
  };

  return (
    <div className="min-h-screen bg-[var(--surface-2)]">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-[family-name:var(--font-serif)] text-3xl md:text-4xl text-[var(--fg)] mb-3">
            Harita & Rota Planlayıcı
          </h1>
          <p className="text-lg text-[var(--fg-muted)] max-w-2xl mx-auto">
            İstediğiniz yerleri seçin ve size en optimal rotayı oluşturalım
          </p>
        </div>

        {/* Kip seçimi */}
        <div className="flex justify-center gap-2 mb-6">
          {([
            { deger: "kesfet", etiket: "Yakındaki Yerler" },
            { deger: "plan", etiket: "Plan Rotası" },
          ] as const).map((secenek) => (
            <button
              key={secenek.deger}
              onClick={() => {
                setKip(secenek.deger);
                rotaCizimiTemizle();
              }}
              className={`px-5 py-2 rounded-lg font-medium transition-colors ${
                kip === secenek.deger
                  ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                  : "bg-[var(--surface)] text-[var(--fg-muted)] border border-[var(--line-strong)] hover:bg-gray-50 dark:hover:bg-[var(--surface-2)]"
              }`}
            >
              {secenek.etiket}
            </button>
          ))}
        </div>

        {/* Plan rotası paneli */}
        {kip === "plan" && (
          <div className="bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--line)] p-6 mb-8 border border-[var(--line)]">
            <h2 className="font-[family-name:var(--font-serif)] text-lg text-[var(--fg)] mb-4">
              Kaydedilmiş plandan rota çiz
            </h2>

            {planlar.length === 0 ? (
              <p className="text-[var(--fg-muted)]">
                Henüz kaydedilmiş bir planınız yok ya da giriş yapmadınız.{" "}
                <a href="/ai-planner" className="text-[var(--accent)] underline">
                  Yeni bir plan oluşturun
                </a>
                .
              </p>
            ) : (
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-sm font-medium text-[var(--fg-muted)]">Plan</span>
                    <select
                      value={seciliPlanId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setSeciliPlanId(id);
                        setPlanGunleri([]);
                        setSeciliGun(null);
                        if (id) planiYukle(id);
                      }}
                      className="mt-1 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] text-[var(--fg)] px-3 py-2"
                    >
                      <option value="">Plan seçin</option>
                      {planlar.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.city}
                          {plan.country ? `, ${plan.country}` : ""}
                          {plan.startDate ? ` — ${new Date(plan.startDate).toLocaleDateString("tr-TR")}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-[var(--fg-muted)]">Gün</span>
                    <select
                      value={seciliGun ?? ""}
                      onChange={(e) => {
                        setSeciliGun(e.target.value ? Number(e.target.value) : null);
                        rotaCizimiTemizle();
                      }}
                      disabled={planGunleri.length === 0}
                      className="mt-1 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] text-[var(--fg)] px-3 py-2 disabled:opacity-50"
                    >
                      {planGunleri.length === 0 && <option value="">—</option>}
                      {planGunleri.map((gun) => (
                        <option key={gun.day} value={gun.day}>
                          {gun.day}. gün{gun.date ? ` (${gun.date})` : ""} — {gun.activities.length} aktivite
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {planYukleniyor && (
                  <p className="text-sm text-[var(--fg-muted)]">Plan yükleniyor...</p>
                )}

                {aktifGun && (
                  <>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={planRotasiniCiz}
                        disabled={loading || koordinatliAktiviteler.length === 0}
                        className="bg-[var(--accent)] text-[var(--accent-contrast)] px-5 py-2 rounded-lg hover:bg-[var(--accent-hover)] transition-colors font-medium disabled:bg-[var(--line-strong)]"
                      >
                        {loading ? "Hesaplanıyor..." : "Rotayı Çiz"}
                      </button>

                      {koordinatsizSayisi > 0 && (
                        <button
                          onClick={konumlariCoz}
                          disabled={konumlarCozuluyor}
                          className="bg-[var(--accent)] text-[var(--accent-contrast)] px-5 py-2 rounded-lg hover:bg-[var(--accent-hover)] transition-colors font-medium disabled:bg-[var(--line-strong)]"
                          title="Konumları sunucuda çözer ve plana kaydeder"
                        >
                          {konumlarCozuluyor ? "Çözülüyor..." : "Eksik konumları çöz"}
                        </button>
                      )}

                      <span className="text-sm text-[var(--fg-muted)]">
                        {koordinatliAktiviteler.length} koordinatlı
                        {koordinatsizSayisi > 0 && `, ${koordinatsizSayisi} koordinatsız`}
                      </span>
                    </div>

                    {routeInfo && (
                      <div className="flex gap-6 bg-[var(--ok-soft)] border border-transparent rounded-lg p-4">
                        <div>
                          <div className="text-xl font-bold text-[var(--accent)]">
                            {routeInfo.distance}
                          </div>
                          <div className="text-sm text-[var(--fg-muted)]">Toplam mesafe</div>
                        </div>
                        <div>
                          <div className="text-xl font-bold text-[var(--accent)]">
                            {routeInfo.duration}
                          </div>
                          <div className="text-sm text-[var(--fg-muted)]">
                            Yürüyerek tahmini süre
                          </div>
                        </div>
                      </div>
                    )}

                    {koordinatliAktiviteler.length === 0 && (
                      <p className="text-sm text-[var(--warn)] dark:text-[var(--warn)] bg-[var(--warn-soft)] border border-transparent rounded-lg p-3">
                        Bu gündeki aktivitelerin konumu henüz çözülmemiş. Bu özellikten önce
                        üretilmiş planlarda beklenen bir durum — &quot;Eksik konumları çöz&quot;
                        düğmesi konumları bir kez hesaplayıp plana kaydeder.
                      </p>
                    )}

                    <ol className="space-y-2">
                      {aktifGun.activities.map((aktivite, index) => (
                        <li
                          key={aktivite.id || index}
                          className="flex items-start gap-3 p-3 rounded-lg bg-[var(--surface-2)]/50"
                        >
                          <span
                            className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                              aktivite.coordinates
                                ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                                : "bg-[var(--surface-3)] dark:bg-[var(--surface-3)] text-[var(--fg-muted)]"
                            }`}
                          >
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-[var(--fg)]">
                              {aktivite.startTime && (
                                <span className="text-[var(--fg-subtle)] mr-2">
                                  {aktivite.startTime}
                                </span>
                              )}
                              {aktivite.name || "Aktivite"}
                            </p>
                            <p className="text-sm text-[var(--fg-muted)] truncate">
                              {aktivite.location || "Konum belirtilmemiş"}
                              {!aktivite.coordinates && " — haritada gösterilemiyor"}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Map Container */}
        <div className="bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--line)] p-6 mb-8 border border-[var(--line)]">
          {/* Map Controls */}
          <div className={`flex-wrap gap-3 mb-6 ${kip === "kesfet" ? "flex" : "hidden"}`}>
            <button
              onClick={getCurrentLocation}
              className="bg-[var(--accent)] text-[var(--accent-contrast)] px-4 py-2 rounded-lg hover:bg-[var(--accent-hover)] transition-colors flex items-center space-x-2 font-medium"
            >
              <span>Konumumu Bul</span>
            </button>
            
            <button
              onClick={fetchPOIs}
              disabled={loading || !map}
              className="bg-[var(--accent)] text-[var(--accent-contrast)] px-4 py-2 rounded-lg hover:bg-[var(--accent-hover)] transition-colors flex items-center space-x-2 font-medium disabled:bg-[var(--line-strong)]"
            >
              <span>{loading ? 'Yükleniyor...' : 'Turistik Yerler'}</span>
            </button>
            
            <button
              onClick={() => fetchPOIsByType(['restaurant', 'cafe'])}
              disabled={loading || !map}
              className="bg-[var(--accent)] text-[var(--accent-contrast)] px-4 py-2 rounded-lg hover:bg-[var(--accent-hover)] transition-colors flex items-center space-x-2 font-medium disabled:bg-[var(--line-strong)]"
            >
              <span>{loading ? 'Yükleniyor...' : 'Restoranlar'}</span>
            </button>
            
            <button
              onClick={() => fetchPOIsByType(['lodging'])}
              disabled={loading || !map}
              className="bg-[var(--accent)] text-[var(--accent-contrast)] px-4 py-2 rounded-lg hover:bg-[var(--accent-hover)] transition-colors flex items-center space-x-2 font-medium disabled:bg-[var(--line-strong)]"
            >
              <span>{loading ? 'Yükleniyor...' : 'Oteller'}</span>
            </button>
            
            {kip === "kesfet" && pois.length > 0 && (
              <button
                onClick={() => {
                  setPois([]);
                  // Seçili POI'leri KORUYORUZ - sadece haritadaki arama sonuçlarını temizliyoruz
                  // setSelectedPois([]); // Bu satırı kaldırdık
                  
                  // Sadece haritadaki marker'ları temizle
                  if (map) {
                    // Map'teki marker'ları temizlemek için marker tracking sistemi gerekli
                    // Şimdilik basit toast mesajı gösterelim
                  }
                  toast.success('POI arama sonuçları temizlendi!');
                }}
                className="bg-[var(--danger)] text-white px-4 py-2 rounded-lg hover:bg-[var(--danger-hover)] transition-colors flex items-center space-x-2 font-medium"
              >
                <span>Temizle</span>
              </button>
            )}
            
            {pois.length > 0 && (
              <div className="flex items-center">
                <span className="bg-[var(--surface-2)] text-[var(--fg-muted)] px-3 py-2 rounded-lg font-medium">
                  {pois.length} yer bulundu
                </span>
              </div>
            )}
            
          </div>
          
          <div 
            ref={mapRef}
            className="w-full h-96 rounded-lg border border-[var(--line-strong)] overflow-hidden"
            style={{ minHeight: '400px' }}
          >
            <div className="flex items-center justify-center h-full bg-[var(--surface-2)] rounded-lg">
              <div className="text-center">
                <p className="text-[var(--fg-muted)]">
                  Harita yükleniyor...
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Seçili POI'ler Paneli */}
        {kip === "kesfet" && selectedPois.length > 0 && (
          <div className="bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--line)] p-6 mb-8 border border-[var(--line)]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-[var(--fg)]">
                Seçili Yerler ({selectedPois.length})
              </h2>
              <div className="flex space-x-3">
                <button
                  onClick={calculateOptimalRoute}
                  disabled={loading}
                  className="bg-[var(--accent)] text-[var(--accent-contrast)] px-6 py-3 rounded-lg hover:bg-[var(--accent-hover)] transition-colors disabled:bg-[var(--line-strong)] flex items-center space-x-2 font-medium"
                >
                  <span>{loading ? 'Hesaplanıyor...' : 'Rota Oluştur'}</span>
                </button>
                <button
                  onClick={() => {
                    setSelectedPois([]);
                    clearRoute();
                  }}
                  className="bg-[var(--danger)] text-white px-4 py-3 rounded-lg hover:bg-[var(--danger-hover)] transition-colors"
                >
                  
                </button>
              </div>
            </div>

            {/* Rota Bilgileri */}
            {routeInfo && (
              <div className="bg-[var(--ok-soft)] p-4 rounded-lg mb-6 border border-transparent">
                <h3 className="text-lg font-semibold text-[var(--ok)] mb-3">
                  Rota Hesaplandı
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[var(--accent)]">
                      {routeInfo.distance}
                    </div>
                    <div className="text-sm text-[var(--fg-muted)]">Toplam Mesafe</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[var(--accent)]">
                      {routeInfo.duration}
                    </div>
                    <div className="text-sm text-[var(--fg-muted)]">Tahmini Süre</div>
                  </div>
                </div>
              </div>
            )}

            {/* Seçili POI'lerin Listesi */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedPois.map((poi, index) => {
                const uniqueKey = poi.id || `selected-${poi.name}-${poi.vicinity}-${index}`;
                return (
                  <div
                    key={uniqueKey}
                    className="group bg-[var(--bg)] border-2 border-[var(--line)] dark:border-[var(--line)] rounded-[var(--radius-lg)] p-5 hover:shadow-lg transition-colors duration-150"
                  >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-[var(--bg)] text-white rounded-full flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </div>
                      <h4 className="font-bold text-[var(--fg)] text-base leading-tight">
                        {poi.name}
                      </h4>
                    </div>
                    <button
                      onClick={() => togglePoiSelection(poi)}
                      className="text-[var(--danger)] hover:text-[var(--danger)] hover:bg-red-50 dark:hover:bg-[var(--danger-soft)] w-8 h-8 rounded-full flex items-center justify-center font-bold transition-colors duration-150 text-lg group-hover:scale-110"
                      title="Seçimi kaldır"
                    >
                      ×
                    </button>
                  </div>
                  <div className="flex items-center space-x-2 mb-3">
                    <p className="text-sm text-[var(--fg-muted)] font-medium">
                      {poi.vicinity}
                    </p>
                  </div>
                  {poi.rating && (
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1 bg-[var(--warn-soft)] px-2 py-1 rounded-full">
                        <span className="text-[var(--warn)] text-sm">★</span>
                        <span className="text-sm font-medium text-[var(--warn)] dark:text-[var(--warn)]">
                          {poi.rating.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* POI Listesi */}
        {pois.length > 0 && (
          <div className="bg-[var(--bg)] rounded-[var(--radius-lg)] border border-[var(--line)] p-6 mb-8 border border-[var(--line)]">
            <div className="flex items-center space-x-3 mb-8">
              <div>
                <h2 className="text-3xl font-bold bg-[var(--accent)] bg-clip-text text-transparent">
                  Yakındaki İlgi Çekici Yerler
                </h2>
                <p className="text-[var(--fg-muted)]">
                  Ziyaret etmek istediğiniz yerleri seçin
                </p>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pois.map((poi, index) => {
                const isSelected = isPoiSelected(poi);
                const uniqueKey = poi.id || `${poi.name}-${poi.vicinity}-${index}`;
                
                return (
                  <div
                    key={uniqueKey}
                    className={`group border-2 rounded-[var(--radius-lg)] p-5 hover:shadow-xl transition-colors duration-150 cursor-pointer ${
                      isSelected 
                        ? 'border-[var(--line)] bg-[var(--bg)] scale-105' 
                        : 'border-[var(--line)] hover:border-[var(--line)] dark:hover:border-[var(--accent)] bg-[var(--surface)]'
                    }`}
                    onClick={() => togglePoiSelection(poi)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors duration-150 ${
                          isSelected 
                            ? 'bg-[var(--bg)] text-white scale-110' 
                            : 'bg-[var(--surface-3)] text-[var(--fg-muted)] group-hover:bg-[var(--accent-soft)] dark:group-hover:bg-[var(--accent-soft)]'
                        }`}>
                          {isSelected ? '✓' : index + 1}
                        </div>
                        <h3 className="font-bold text-[var(--fg)] text-lg leading-tight">
                          {poi.name}
                        </h3>
                      </div>
                      {poi.rating && (
                        <div className="flex items-center space-x-1 bg-[var(--accent)] px-3 py-2 rounded-full border border-[var(--line)] dark:border-[var(--line)] shadow-sm">
                          <span className="text-[var(--warn)] text-lg">★</span>
                          <span className="text-sm font-bold text-[var(--warn)] dark:text-[var(--warn)]">
                            {poi.rating.toFixed(1)}
                          </span>
                        </div>
                      )}
                    </div>
                  
                  <div className="flex items-center space-x-2 mb-4">
                    <p className="text-[var(--fg-muted)] font-medium">
                      {poi.vicinity}
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {poi.types.slice(0, 3).map((type, idx) => (
                      <span
                        key={idx}
                        className="text-xs bg-[var(--accent)] text-[var(--accent)] dark:text-[var(--accent)] px-3 py-1 rounded-full border border-[var(--line)] dark:border-[var(--line)] font-medium"
                      >
                        {translateType(type)}
                      </span>
                    ))}
                  </div>
                  
                  {poi.price_level !== undefined && (
                    <div className="flex items-center space-x-3 mb-4">
                      <span className="text-sm text-[var(--fg-muted)] font-medium">Fiyat Seviyesi:</span>
                      <div className="flex">
                        {[...Array(5)].map((_, idx) => (
                          <span
                            key={idx}
                            className={`text-lg transition-colors duration-150 ${
                              idx < poi.price_level! 
                                ? 'text-[var(--ok)] scale-110' 
                                : 'text-[var(--fg-subtle)] dark:text-[var(--fg-muted)]'
                            }`}
                          >
                            </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="text-xs text-[var(--fg-subtle)] bg-[var(--surface-2)]/50 px-3 py-2 rounded-lg mb-4">
                    {poi.geometry.location.lat().toFixed(4)}, {poi.geometry.location.lng().toFixed(4)}
                  </div>
                  
                  {isSelected && (
                    <div className="text-center animate-pulse">
                      <span className="bg-[var(--accent)] text-white px-4 py-2 rounded-full text-sm font-bold">
                        Rotaya Dahil
                      </span>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="text-center mt-12">
          <div className="bg-[var(--bg)] rounded-[var(--radius-lg)] border border-[var(--line)] p-8 border border-[var(--line)]">
            <h3 className="text-2xl font-bold text-[var(--fg)] mb-6">
              Seyahat Planlama Araçları
            </h3>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="/daily-planner"
                className="group bg-[var(--accent)] text-white px-8 py-4 rounded-[var(--radius-lg)] hover:bg-[var(--accent-hover)] transition-colors duration-150 flex items-center space-x-3 hover:shadow-xl"
              >
                <span className="font-semibold text-lg">Günlük Planlayıcı</span>
              </a>
              <a
                href="/my-plans"
                className="group bg-[var(--accent)] text-white px-8 py-4 rounded-[var(--radius-lg)] hover:bg-[var(--accent-hover)] transition-colors duration-150 flex items-center space-x-3 hover:shadow-xl"
              >
                <span className="font-semibold text-lg">Planlarım</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


