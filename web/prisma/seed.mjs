// Geliştirme için örnek veri: bir demo kullanıcı ve her durumdan birer plan.
// Çalıştırmak için:  npm run db:seed
// Tekrar çalıştırılabilir; demo kullanıcının eski planlarını silip yeniden oluşturur.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

if (process.env.NODE_ENV === "production") {
  console.error("Örnek veri üretim ortamında yüklenmez.");
  process.exit(1);
}

const prisma = new PrismaClient();

// Yalnızca yerel geliştirme içindir.
const DEMO_USER = {
  name: "Deniz Gezgin",
  email: "demo@tripplanner.test",
  password: "demo-gezgin-2026",
};

/** Bugünden `offset` gün sonrası (UTC gece yarısı; DATE sütunlarıyla aynı biçim). */
function day(offset) {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + offset));
}

/** [slot, saat, ad, açıklama, kategori, maliyet, enlem, boylam] satırlarını durak kaydına çevirir. */
const stops = (rows) =>
  rows.map(([slot, startTime, name, description, category, cost, latitude, longitude], position) => ({
    position,
    slot,
    startTime,
    name,
    description,
    category,
    cost: cost || null,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
  }));

const estimates = (rows) =>
  rows.map(([category, description, amount]) => ({ kind: "ESTIMATE", category, description, amount }));

const izmir = {
  cityGuide: `İzmir, Ege kıyısında körfezin çevresine yayılmış, Türkiye'nin üçüncü büyük şehridir. Rahat temposu, uzun kordonu ve sokak lezzetleriyle bilinir.

- **İklim:** Akdeniz iklimi; yazlar sıcak ve kuru, kışlar ılık
- **En iyi ziyaret zamanı:** Nisan–Haziran ve Eylül–Ekim
- **Para birimi:** Türk lirası (₺)

> Öğle sıcağında kapalı çarşıları, akşamüstü kordonu tercih edin.`,
  foodGuide: `### Yerel lezzetler
- **Boyoz:** Fırından sıcak, yanında haşlanmış yumurtayla
- **Kumru:** Susamlı ekmekte sucuk, kaşar ve domates
- **Söğüş:** Kemeraltı'nın klasik öğle yemeği
- **Lokma ve şambali:** Tatlı molaları için

### Bütçe dostu seçenekler
1. Kemeraltı esnaf lokantaları
2. Alsancak'ta kumrucular
3. Karşıyaka Çarşısı'ndaki sokak lezzetleri`,
  practicalInfo: `### Ulaşım
- İzmirim Kart ile metro, tramvay, otobüs ve vapur tek kartla kullanılır.
- Havalimanından merkeze İZBAN ile ulaşılır.

### İpuçları
- Efes için sabah erken saatleri seçin; öğle saatlerinde gölge azdır.
- Kemeraltı pazar günleri büyük ölçüde kapalıdır.`,
  days: [
    {
      dayNumber: 1,
      title: "Kemeraltı ve Kordon",
      stops: stops([
        ["MORNING", "09:30", "Konak Meydanı ve Saat Kulesi", "Şehrin simgesi; güne buradan başlanır.", "tarihi yer", 0, 38.4189, 27.1287],
        ["MORNING", "10:30", "Kemeraltı Çarşısı", "Kızlarağası Hanı'nda Türk kahvesi molası.", "alışveriş", 150, 38.4197, 27.1312],
        ["NOON", "13:00", "Kordon", "Deniz kenarında boyoz ve kumru.", "yeme-içme", 300, 38.4352, 27.1418],
        ["NOON", "14:30", "Atatürk Müzesi", "Yaklaşık 45 dakikalık ziyaret.", "müze", 0, 38.4338, 27.1401],
        ["EVENING", "19:15", "Tarihi Asansör", "Körfez manzarasında gün batımı.", "manzara", 0, 38.4078, 27.1182],
      ]),
    },
    {
      dayNumber: 2,
      title: "Efes ve Şirince",
      stops: stops([
        ["MORNING", "09:30", "Efes Antik Kenti", "Celsus Kütüphanesi ve Büyük Tiyatro; en az 2,5 saat ayırın.", "tarihi yer", 700, 37.9395, 27.3417],
        ["NOON", "13:30", "Efes Müzesi", "Selçuk merkezde; kazı buluntuları.", "müze", 250, 37.9488, 27.3676],
        ["EVENING", "17:00", "Şirince", "Köy sokaklarında yürüyüş ve akşam yemeği.", "manzara", 400, 37.9443, 27.433],
      ]),
    },
    {
      dayNumber: 3,
      title: "Alsancak ve Karşıyaka",
      stops: stops([
        ["MORNING", "10:00", "Kültürpark", "Sabah yürüyüşü.", "doğa", 0, 38.4283, 27.1447],
        ["NOON", "13:00", "Karşıyaka Çarşısı", "Vapurla karşıya geçiş, lokma tatlısı.", "yeme-içme", 250, 38.456, 27.119],
        ["EVENING", "18:30", "Bostanlı Sahili", "Gün batımı ve veda yemeği.", "manzara", 500, 38.4575, 27.096],
      ]),
    },
  ],
  budget: estimates([
    ["ACCOMMODATION", "2 gece otel", 3600],
    ["FOOD", "3 gün yeme-içme", 2100],
    ["TRANSPORT", "Şehir içi ulaşım ve Selçuk treni", 900],
    ["ACTIVITIES", "Efes ve müze girişleri", 1300],
    ["SHOPPING", "Hediyelik", 500],
  ]),
};

async function main() {
  const password = await bcrypt.hash(DEMO_USER.password, 12);
  const user = await prisma.user.upsert({
    where: { email: DEMO_USER.email },
    update: { name: DEMO_USER.name, password },
    create: { name: DEMO_USER.name, email: DEMO_USER.email, password },
  });

  await prisma.plan.deleteMany({ where: { userId: user.id } });

  const create = (data) => prisma.plan.create({ data: { userId: user.id, ...data } });

  // 1) Yaklaşan AI planı: yapılandırılmış duraklar ve harita
  await create({
    source: "AI",
    city: "İzmir",
    country: "Türkiye",
    latitude: 38.4237,
    longitude: 27.1428,
    startDate: day(20),
    endDate: day(22),
    travelers: 2,
    travelStyle: "Standart",
    budgetLevel: "Orta",
    interests: ["Tarihi Yerler", "Gastronomi", "Plajlar"],
    transportPrefs: ["Uçak", "Toplu Taşıma"],
    stayPreference: "Otel",
    specialRequests: "Deniz gören yerler ve tatlıcılar",
    cityGuide: izmir.cityGuide,
    foodGuide: izmir.foodGuide,
    practicalInfo: izmir.practicalInfo,
    totalCost: 8400,
    targetBudget: 10000,
    aiModel: "seed/ornek-veri",
    days: { create: izmir.days.map((d) => ({ ...d, stops: { create: d.stops } })) },
    budgetLines: { create: izmir.budget },
  });

  // 2) Yaklaşan manuel plan
  await create({
    source: "MANUAL",
    city: "Kapadokya",
    country: "Türkiye",
    latitude: 38.6431,
    longitude: 34.8289,
    startDate: day(45),
    endDate: day(48),
    travelers: 2,
    travelStyle: "standard",
    transport: {
      type: "Uçak",
      provider: "Örnek Havayolu",
      price: 5200,
      duration: "1 sa 20 dk",
      departure: "07:40",
      arrival: "09:00",
    },
    accommodation: { type: "Butik otel", name: "Örnek Kaya Otel", location: "Göreme", price: 3200 },
    totalCost: 31950,
    targetBudget: 35000,
    days: {
      create: [
        {
          dayNumber: 1,
          notes: "Akşam erken yatılacak; ertesi sabah balon için 05:00'te kalkış.",
          stops: {
            create: [
              { position: 0, name: "Göreme Açık Hava Müzesi", startTime: "10:30", endTime: "12:30", cost: 600, description: "Müze kart geçerli." },
              { position: 1, name: "Uçhisar Kalesi", startTime: "15:00", endTime: "16:30", cost: 250 },
              { position: 2, name: "Kızılçukur'da gün batımı", startTime: "18:00", endTime: "19:30", description: "Yürüyüş parkuru; yanına su al." },
            ],
          },
        },
        {
          dayNumber: 2,
          stops: {
            create: [
              { position: 0, name: "Sıcak hava balonu", startTime: "05:30", endTime: "08:00", cost: 9000, description: "İki kişi; hava koşuluna bağlı." },
              { position: 1, name: "Derinkuyu Yeraltı Şehri", startTime: "11:00", endTime: "13:00", cost: 500 },
              { position: 2, name: "Avanos'ta çömlek atölyesi", startTime: "15:30", endTime: "17:00", cost: 700 },
            ],
          },
        },
        { dayNumber: 3, isFree: true },
        {
          dayNumber: 4,
          notes: "Dönüş uçuşu akşam.",
          stops: { create: [{ position: 0, name: "Paşabağ Peribacaları", startTime: "09:30", endTime: "11:00", cost: 300 }] },
        },
      ],
    },
    budgetLines: {
      create: estimates([
        ["TRANSPORT", "Ulaşım", 5200],
        ["ACCOMMODATION", "Konaklama (3 gece)", 9600],
        ["ACTIVITIES", "Aktiviteler", 11350],
        ["FOOD", "Yeme-içme (4 gün)", 4800],
        ["OTHER", "Diğer giderler", 1000],
      ]),
    },
  });

  // 3) Devam eden AI planı (birkaç kayıtlı harcamayla)
  await create({
    source: "AI",
    city: "İstanbul",
    country: "Türkiye",
    latitude: 41.0082,
    longitude: 28.9784,
    startDate: day(-1),
    endDate: day(2),
    travelStyle: "Kültürel",
    budgetLevel: "Orta",
    interests: ["Tarihi Yerler", "Müzeler", "Yerel Kültür"],
    transportPrefs: ["Toplu Taşıma"],
    stayPreference: "Otel",
    cityGuide:
      "İki kıtaya yayılan İstanbul; tarihi yarımadası, Boğaz'ı ve mahalle kültürüyle birkaç güne sığmayacak kadar katmanlıdır.",
    totalCost: 15500,
    aiModel: "seed/ornek-veri",
    days: {
      create: [
        {
          dayNumber: 1,
          title: "Tarihi Yarımada",
          stops: {
            create: stops([
              ["MORNING", "09:00", "Ayasofya", "Sıra uzamadan erken gidin.", "tarihi yer", 0, 41.0086, 28.9802],
              ["MORNING", "11:00", "Yerebatan Sarnıcı", "Yaklaşık 45 dakika.", "tarihi yer", 900, 41.0084, 28.9779],
              ["NOON", "13:30", "Topkapı Sarayı", "Harem bölümü ayrı bilet ister.", "müze", 1500, 41.0115, 28.9834],
              ["EVENING", "19:00", "Galata Köprüsü", "Eminönü'nde balık ekmek ve köprü yürüyüşü.", "yeme-içme", 300, 41.0201, 28.9731],
            ]),
          },
        },
        {
          dayNumber: 2,
          title: "Boğaz ve Karaköy",
          stops: {
            create: stops([
              ["MORNING", "10:00", "Boğaz vapuru", "Eminönü'nden kısa Boğaz turu.", "manzara", 250, 41.0178, 28.9733],
              ["NOON", "13:30", "İstanbul Modern", "Karaköy'de çağdaş sanat.", "müze", 500, 41.0264, 28.9833],
              ["EVENING", "18:30", "Galata Kulesi", "Gün batımı için.", "manzara", 650, 41.0256, 28.9741],
            ]),
          },
        },
        {
          dayNumber: 3,
          title: "Kadıköy ve Moda",
          stops: {
            create: stops([
              ["MORNING", "10:00", "Kadıköy Çarşısı", "Kahvaltı ve çarşı turu.", "yeme-içme", 400, 40.9903, 29.0253],
              ["EVENING", "18:00", "Moda Sahili", "Yürüyüş ve gün batımı.", "manzara", 0, 40.9793, 29.0258],
            ]),
          },
        },
        {
          dayNumber: 4,
          title: "Balat ve Fener",
          stops: {
            create: stops([
              ["MORNING", "10:30", "Balat sokakları", "Renkli evler ve kafeler.", "tarihi yer", 0, 41.0297, 28.9486],
              ["NOON", "13:00", "Fener Rum Patrikhanesi", "Kısa bir ziyaret.", "tarihi yer", 0, 41.0291, 28.9518],
            ]),
          },
        },
      ],
    },
    budgetLines: {
      create: [
        ...estimates([
          ["ACCOMMODATION", "3 gece otel", 7500],
          ["FOOD", "4 gün yeme-içme", 4000],
          ["TRANSPORT", "İstanbulkart ve vapur", 800],
          ["ACTIVITIES", "Müze girişleri", 3200],
        ]),
        { kind: "EXPENSE", category: "ACCOMMODATION", description: "Otel ön ödemesi", amount: 2500, isPaid: true },
        { kind: "EXPENSE", category: "ACTIVITIES", description: "Yerebatan Sarnıcı bileti", amount: 900, isPaid: true },
        { kind: "EXPENSE", category: "FOOD", description: "Akşam yemeği", amount: 650, isPaid: false },
      ],
    },
  });

  // 4) Tarihi geçmiş, yapılandırılmış veriden önce üretilmiş (metin tabanlı) plan
  await create({
    source: "AI",
    city: "Mardin",
    country: "Türkiye",
    startDate: day(-62),
    endDate: day(-60),
    travelStyle: "Kültürel",
    budgetLevel: "Ekonomik",
    interests: ["Tarihi Yerler", "Fotoğrafçılık"],
    stayPreference: "Otel",
    cityGuide: "Taş evleri ve Mezopotamya ovasına bakan teraslarıyla Mardin.",
    totalCost: 9200,
    aiModel: "seed/ornek-veri",
    legacyDayPlan:
      "### 1. Gün: Eski Mardin\n\n- Ulu Cami\n- Kasımiye Medresesi\n\n---\n\n### 2. Gün: Midyat\n\n- Midyat konukevi\n- Mor Gabriel Manastırı\n\n---\n\n### 3. Gün: Dara\n\n- Dara Antik Kenti",
    legacyBudget:
      "## Bütçe Tahmini\n\n- **Konaklama:** 2 gece, 4.200 TL\n- **Yeme-içme:** 2.600 TL\n- **Ulaşım:** 1.400 TL\n- **Müze girişleri:** 1.000 TL\n\n**Toplam:** 9.200 TL",
    legacyRaw: "# Mardin Seyahat Planı\n\nBu plan, yapılandırılmış veriye geçmeden önce üretilmiş bir örnektir.",
  });

  // 5) Gerçekleşmiş gezi
  await create({
    source: "AI",
    status: "DONE",
    completedAt: day(-120),
    city: "Antalya",
    country: "Türkiye",
    latitude: 36.8969,
    longitude: 30.7133,
    startDate: day(-125),
    endDate: day(-122),
    travelers: 2,
    travelStyle: "Standart",
    budgetLevel: "Orta",
    interests: ["Plajlar", "Doğa"],
    stayPreference: "Otel",
    cityGuide: "Kaleiçi'nin dar sokakları, Düden Şelalesi ve Konyaaltı sahili arasında geçen dört gün.",
    totalCost: 18400,
    aiModel: "seed/ornek-veri",
    days: {
      create: [
        {
          dayNumber: 1,
          title: "Kaleiçi",
          stops: {
            create: stops([
              ["MORNING", "10:00", "Hadrian Kapısı", "Kaleiçi'ne giriş.", "tarihi yer", 0, 36.8853, 30.7086],
              ["EVENING", "18:00", "Yat Limanı", "Gün batımı ve akşam yemeği.", "manzara", 800, 36.8842, 30.7036],
            ]),
          },
        },
        {
          dayNumber: 2,
          title: "Şelaleler",
          stops: {
            create: stops([["MORNING", "10:00", "Düden Şelalesi", "Yukarı Düden parkı.", "doğa", 100, 36.9637, 30.7279]]),
          },
        },
      ],
    },
    budgetLines: {
      create: estimates([
        ["ACCOMMODATION", "3 gece otel", 9000],
        ["FOOD", "Yeme-içme", 5400],
        ["TRANSPORT", "Uçak ve transfer", 4000],
      ]),
    },
  });

  // 6) İptal edilmiş plan
  await create({
    source: "AI",
    status: "CANCELLED",
    city: "Trabzon",
    country: "Türkiye",
    startDate: day(70),
    endDate: day(73),
    travelStyle: "Macera",
    budgetLevel: "Orta",
    interests: ["Doğa"],
    stayPreference: "Apart",
    cityGuide: "Uzungöl, Sümela ve yayla rotaları.",
    totalCost: 12800,
    aiModel: "seed/ornek-veri",
  });

  console.log(`Örnek veri yüklendi: ${DEMO_USER.email} (şifre bu dosyada, DEMO_USER içinde).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
