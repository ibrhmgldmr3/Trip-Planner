# web/ — Next.js uygulaması

Kurulum, ortam değişkenleri, komutlar ve API uçları için depo kökündeki
[`../README.md`](../README.md) dosyasına bakın. Burada yalnızca bu dizinde
çalışırken uyulması gereken, koda özgü sözleşmeler var.

---

## Loglama

Uygulamada `console.*` **doğrudan kullanılmaz**; tek log girişi
[`src/lib/logger.ts`](src/lib/logger.ts). ESLint'te `no-console` kuralı
açıktır ve tek istisnası logger'ın kendisidir.

```ts
import { logger } from "@/lib/logger";

logger.debug("Ayrıştırma başladı", { uzunluk: markdown.length });
logger.info("Plan kaydedildi", { planId });
logger.warn("Markdown dönüştürülemedi", markdownError);
logger.error("Plan silinemedi", error, { planId });
```

**Seviye seçimi**

| Seviye | Ne zaman |
|---|---|
| `debug` | Ayrıştırma/akış izleri. Üretimde kapalı. |
| `info` | Kalıcı durum değişiklikleri (kayıt oluştu, statü değişti). |
| `warn` | Beklenen ama istenmeyen durum: fallback'e düşüldü, upstream 4xx döndü. |
| `error` | İşlem tamamlanamadı. |

Modül izomorfiktir: aynı dosya route handler'larda, `"use client"`
bileşenlerinde ve middleware'de import edilebilir. Üretimde tek satır JSON,
geliştirmede okunabilir metin basar.

Varsayılan alt seviye üretimde `info`, geliştirmede `debug`. Geçici olarak
değiştirmek için `.env.local`'a `NEXT_PUBLIC_LOG_LEVEL=debug` ekleyip yeniden
build alın.

### PII kuralları

- **İstemcide `debug`/`info` kullanmayın.** Tarayıcı konsolunu son kullanıcı ve
  sayfadaki her üçüncü taraf script görür. İstemcide yalnızca `warn`/`error`
  kalır; onlar da `toast.*` ile kullanıcıya zaten bildirilen hatanın teşhis
  kaydıdır.
- Log'a **asla** ham e-posta, oturum objesi, prompt metni, model çıktısı,
  sağlayıcı yanıt gövdesi, kullanıcı konumu ya da tam API yanıtı koymayın.
  Yalnızca tanımlayıcı verin: `{ status, planId, kategori }`.
- `redact()` context objesindeki `email`, `token`, `user_id`, `detay` gibi
  alanları otomatik maskeler/kırpar. Bu **son savunma hattıdır, ilk değil** —
  çağrı yerinde de dikkat edin.
- `planId` bilinçli olarak maskelenmez; korelasyon için gerekli ve tek başına
  kullanıcıya geri götürmüyor.

---

## Kodlama ve metin

`23f723d` commit'i dosyaların bir bölümünü yanlış kodlamayla kaydederek
Türkçe karakterleri `U+FFFD`'ye, simgeleri `?`'e çevirmiş ve dosyalara BOM
eklemişti. Bu bozulma temizlendi; tekrarlamaması için:

- Kaynak dosyalar **UTF-8, BOM'suz** kaydedilir.
- Kullanıcıya görünen metinlerde **emoji kullanılmaz** (tasarım kararı).
  Anlam taşıyan işaretler istisnadır ve gerçek karakterle yazılır:
  `₺` (U+20BA), `★` (U+2605), `✓` (U+2713).
- Para regex'i gibi yerlerde `₺` karakterini karakter sınıfına doğrudan
  yazarken kodlamanın korunduğundan emin olun; bu daha önce
  `extractBudgetInfo()`'da sessiz bir hataya yol açmıştı.

---

## Doğrulama

```bash
npm run lint       # ESLint (no-console dahil)
npm run typecheck  # tsc --noEmit
```
