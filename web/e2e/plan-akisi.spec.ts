import { expect, test } from "@playwright/test";
import { girisYap, ileriTarih, kayitOl, yeniKullanici } from "./yardimcilar";

/**
 * Plan akışı: oluştur → listede gör → bütçesini düzenle → durumunu değiştir.
 *
 * AI plan üretimi bilinçli olarak KAPSANMIYOR: dış bir sağlayıcıya (OpenRouter)
 * bağlı, ücretli ve yavaş. Aynı veri yolları manuel planlayıcı üzerinden de
 * geçtiği için akış oradan doğrulanıyor.
 *
 * Bu dosya API sözleşmesini de doğruluyor; arayüz seçicileri değişse bile
 * veri katmanındaki regresyonlar yakalanıyor.
 */

test.describe("plan yaşam döngüsü", () => {
  test("manuel plan oluşturulup listede görünür", async ({ page, request }) => {
    const kullanici = yeniKullanici();
    await kayitOl(page, kullanici);
    await girisYap(page, kullanici);

    // Planı API üzerinden oluşturuyoruz: çok adımlı sihirbazı tıklamak
    // arayüz değişikliklerine kırılgan, oysa doğrulamak istediğimiz şey
    // planın kaydedilip listede görünmesi.
    const olustur = await page.request.post("/api/manual-travel-plan", {
      data: {
        basicInfo: {
          destination: "Roma",
          country: "İtalya",
          startDate: ileriTarih(30),
          endDate: ileriTarih(34),
          travelers: 2,
          travelStyle: "kültür",
        },
        transport: null,
        accommodation: null,
        dailyPlans: [
          { day: 1, activities: [], notes: "Varış", isEmpty: true },
          { day: 2, activities: [], notes: "", isEmpty: true },
        ],
        budget: {
          currentBudget: 20000,
          estimatedTotal: 18000,
          breakdown: {
            transport: 6000,
            accommodation: 8000,
            activities: 2000,
            food: 1500,
            other: 500,
          },
        },
      },
    });

    expect(olustur.ok()).toBe(true);
    const { planId } = await olustur.json();
    expect(planId).toBeTruthy();

    // Gün sayısı KAPSAYICI olmalı: 30. günden 34. güne = 5 gün.
    const detay = await page.request.get(`/api/plan-detail/${planId}`);
    const { plan } = await detay.json();
    expect(plan.duration).toBe("5 gün");

    // Listede görünüyor.
    await page.goto("/my-plans");
    await expect(page.getByText("Roma").first()).toBeVisible({ timeout: 15_000 });

    void request;
  });

  test("bütçe düzenlemesi toplamı sunucuda yeniden hesaplar", async ({ page }) => {
    const kullanici = yeniKullanici();
    await kayitOl(page, kullanici);
    await girisYap(page, kullanici);

    const olustur = await page.request.post("/api/manual-travel-plan", {
      data: {
        basicInfo: {
          destination: "Lizbon",
          country: "Portekiz",
          startDate: ileriTarih(20),
          endDate: ileriTarih(23),
          travelers: 1,
          travelStyle: "standart",
        },
        transport: null,
        accommodation: null,
        dailyPlans: [],
        budget: {
          currentBudget: 10000,
          estimatedTotal: 9000,
          breakdown: {
            transport: 4000,
            accommodation: 3000,
            activities: 1000,
            food: 800,
            other: 200,
          },
        },
      },
    });

    const { planId } = await olustur.json();

    // İstemci yalnızca kalemleri gönderiyor; toplam SUNUCUDA türetiliyor.
    const guncelle = await page.request.patch(`/api/plan-detail/${planId}`, {
      data: {
        butce_tahmini: JSON.stringify({
          categories: {
            "ulaşım": { items: [{ description: "Uçak", amount: 5000, isPaid: true }], total: 5000 },
            yemek: { items: [{ description: "Yemek", amount: 1000, isPaid: false }], total: 1000 },
          },
          currency: "TRY",
        }),
      },
    });

    expect(guncelle.ok()).toBe(true);
    const { plan } = await guncelle.json();

    // 5000 + 1000; istemcinin gönderdiği bir toplam yok.
    expect(plan.total_cost).toBe(6000);
    // 4 gün (20→23 kapsayıcı): 6000 / 4 = 1500
    expect(plan.daily_cost).toBe(1500);

    // Ödeme durumu tur atışında korunuyor.
    const detay = await page.request.get(`/api/plan-detail/${planId}`);
    const { plan: okunan } = await detay.json();
    const butce = JSON.parse(okunan.butce_tahmini);
    expect(butce.categories["ulaşım"].items[0].isPaid).toBe(true);
  });

  test("günlük plan kaydı bütçedeki aktivite kalemini günceller", async ({ page }) => {
    const kullanici = yeniKullanici();
    await kayitOl(page, kullanici);
    await girisYap(page, kullanici);

    const olustur = await page.request.post("/api/manual-travel-plan", {
      data: {
        basicInfo: {
          destination: "Atina",
          country: "Yunanistan",
          startDate: ileriTarih(15),
          endDate: ileriTarih(17),
          travelers: 1,
          travelStyle: "standart",
        },
        transport: null,
        accommodation: null,
        dailyPlans: [],
        budget: {
          currentBudget: 5000,
          estimatedTotal: 4000,
          breakdown: {
            transport: 2000,
            accommodation: 1500,
            activities: 0,
            food: 400,
            other: 100,
          },
        },
      },
    });

    const { planId } = await olustur.json();

    const oncekiDetay = await page.request.get(`/api/plan-detail/${planId}`);
    const oncekiToplam = (await oncekiDetay.json()).plan.total_cost;

    // 800 TL'lik bir aktivite ekleniyor.
    const kaydet = await page.request.put(`/api/plan-detail/${planId}`, {
      data: {
        daily_plans: JSON.stringify([
          {
            day: 1,
            date: ileriTarih(15),
            notes: "",
            isEmpty: false,
            activities: [
              {
                id: "a1",
                name: "Akropolis",
                startTime: "10:00",
                endTime: "13:00",
                cost: 800,
                description: "",
                category: "kültür",
                location: "Atina",
              },
            ],
          },
        ]),
      },
    });

    expect(kaydet.ok()).toBe(true);
    const { plan } = await kaydet.json();

    // Eskiden bu uç yalnızca {id, gun_plani} dönüyordu ve aktivite maliyeti
    // hiçbir yere yansımıyordu.
    expect(plan.total_cost).toBe(oncekiToplam + 800);

    const butce = JSON.parse(plan.butce_tahmini);
    expect(butce.categories.aktiviteler.total).toBe(800);
  });

  test("geçersiz durum geçişi reddedilir", async ({ page }) => {
    const kullanici = yeniKullanici();
    await kayitOl(page, kullanici);
    await girisYap(page, kullanici);

    const olustur = await page.request.post("/api/manual-travel-plan", {
      data: {
        basicInfo: {
          destination: "Viyana",
          country: "Avusturya",
          startDate: ileriTarih(40),
          endDate: ileriTarih(43),
          travelers: 1,
          travelStyle: "standart",
        },
        transport: null,
        accommodation: null,
        dailyPlans: [],
        budget: {
          currentBudget: 0,
          estimatedTotal: 5000,
          breakdown: { transport: 3000, accommodation: 2000, activities: 0, food: 0, other: 0 },
        },
      },
    });

    const { planId } = await olustur.json();

    // PLANNED → CANCELLED serbest.
    const iptal = await page.request.patch(`/api/trip-plans/${planId}/status`, {
      data: { status: "CANCELLED" },
    });
    expect(iptal.ok()).toBe(true);

    // CANCELLED uç durum: geri dönüş yok. Arayüz butonu gizliyor ama asıl
    // koruma sunucuda.
    const geriAl = await page.request.patch(`/api/trip-plans/${planId}/status`, {
      data: { status: "PLANNED" },
    });
    expect(geriAl.status()).toBe(409);
  });

  test("başka kullanıcının planı görülemez", async ({ page }) => {
    const ahmet = yeniKullanici();
    await kayitOl(page, ahmet);
    await girisYap(page, ahmet);

    const olustur = await page.request.post("/api/manual-travel-plan", {
      data: {
        basicInfo: {
          destination: "Gizli Şehir",
          country: "",
          startDate: ileriTarih(50),
          endDate: ileriTarih(52),
          travelers: 1,
          travelStyle: "standart",
        },
        transport: null,
        accommodation: null,
        dailyPlans: [],
        budget: {
          currentBudget: 0,
          estimatedTotal: 1000,
          breakdown: { transport: 1000, accommodation: 0, activities: 0, food: 0, other: 0 },
        },
      },
    });
    const { planId } = await olustur.json();

    // İkinci kullanıcı aynı tarayıcı bağlamında oturum açıyor.
    const burcu = yeniKullanici();
    await page.goto("/api/auth/signout");
    const cikisButonu = page.getByRole("button", { name: /sign out|çıkış/i });
    if (await cikisButonu.count()) await cikisButonu.first().click();

    await kayitOl(page, burcu);
    await girisYap(page, burcu);

    const yetkisiz = await page.request.get(`/api/plan-detail/${planId}`);
    expect(yetkisiz.ok()).toBe(false);
    expect([403, 404]).toContain(yetkisiz.status());
  });
});
