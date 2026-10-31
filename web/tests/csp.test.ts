import { describe, expect, it } from "vitest";
import { cspZorlanacakMi } from "@/middleware";

/**
 * CSP MODU (B5).
 *
 * Politika uzun süre YALNIZCA RAPOR modundaydı, yani hiçbir koruma
 * sağlamıyordu: LLM'in ürettiği HTML `dangerouslySetInnerHTML` ile
 * basılıyor ve CSP orada ikinci savunma hattı olmalıydı.
 *
 * Zorlamaya geçmeden önce ölçüldü (4 Eylül 2026): gezilen sayfalarda tek
 * ihlal SINIFI `unsafe-eval`di ve o da UYGULAMADAN değil, Next.js dev
 * sunucusunun webpack kaynak haritalarından geliyordu — üretim
 * derlemesinde `eval(` sayısı sıfır. Bu yüzden karar ortama bağlı.
 *
 * Bu testler o kararı koruyor: geliştirmede zorlamak, webpack'in `eval`ini
 * bloklayıp uygulamayı yerelde çalışmaz hale getirir.
 */

describe("cspZorlanacakMi", () => {
  it("üretimde varsayılan olarak ZORLAR", () => {
    expect(cspZorlanacakMi("production", undefined)).toBe(true);
  });

  it("geliştirmede varsayılan olarak RAPOR EDER", () => {
    // Zorlanırsa webpack'in eval tabanlı kaynak haritaları bloklanır ve
    // uygulama yerelde hiç çalışmaz.
    expect(cspZorlanacakMi("development", undefined)).toBe(false);
    expect(cspZorlanacakMi("test", undefined)).toBe(false);
    expect(cspZorlanacakMi(undefined, undefined)).toBe(false);
  });

  it("CSP_MODE=enforce her ortamda zorlar", () => {
    // Yerelde politikayı denemek için kaçış kapısı.
    expect(cspZorlanacakMi("development", "enforce")).toBe(true);
    expect(cspZorlanacakMi("production", "enforce")).toBe(true);
  });

  it("CSP_MODE=report üretimde bile rapora düşürür", () => {
    // ÜRETİMDE GERİ DÖNÜŞ YOLU: politika bir şeyi kırarsa kod değişikliği
    // ve yeniden dağıtım olmadan rapor moduna inilebilmeli.
    expect(cspZorlanacakMi("production", "report")).toBe(false);
    expect(cspZorlanacakMi("production", "report-only")).toBe(false);
  });

  it("büyük/küçük harf ve boşluk toleranslı", () => {
    // Ortam değişkeni elle yazılıyor; "Enforce" yazan biri sessizce rapor
    // modunda kalmasın.
    expect(cspZorlanacakMi("development", " Enforce ")).toBe(true);
    expect(cspZorlanacakMi("production", "REPORT")).toBe(false);
  });

  it("tanınmayan değer varsayılana düşer", () => {
    expect(cspZorlanacakMi("production", "sacma")).toBe(true);
    expect(cspZorlanacakMi("development", "sacma")).toBe(false);
  });
});
