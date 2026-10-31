---
name: Trip Planner
description: Seyahat planlarını bir deniz haritası belgesi gibi okutan kartografi arayüzü
colors:
  accent: "#14456b"
  accent-hover: "#0f3550"
  accent-active: "#0a2739"
  accent-soft: "#e0e9f0"
  accent-border: "#b0c4d5"
  accent-contrast: "#fbfcfd"
  route: "#9c3f6a"
  route-vivid: "#b84e80"
  route-soft: "#f6e8ef"
  route-border: "#e3bed1"
  stamp: "#b8892c"
  stamp-ink: "#7a5a12"
  stamp-soft: "#f7efdc"
  bg: "#eff3f5"
  surface: "#fbfcfd"
  surface-2: "#e3e9ed"
  surface-3: "#d6dee4"
  fg: "#131c24"
  fg-muted: "#4a5763"
  fg-subtle: "#58656f"
  line: "#dde4e9"
  line-strong: "#bcc7d0"
  ok: "#1f6b4a"
  warn: "#7a5a12"
  danger: "#a32f30"
  info: "#1f5f86"
  dark-bg: "#0a1420"
  dark-surface: "#101d2b"
  dark-surface-2: "#16283a"
  dark-fg: "#e4ebf2"
  dark-fg-muted: "#9aabbc"
  dark-fg-subtle: "#90a2b3"
  dark-accent: "#5aa9d6"
  dark-route: "#d97aa8"
  dark-line: "#223447"
typography:
  display:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "clamp(2.5rem, 5vw, 3.5rem)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  heading:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "normal"
  legend:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.14em"
  measure:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "normal"
  plan-h1:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "clamp(1.6rem, 1.2rem + 1.7vw, 1.875rem)"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  plan-h2:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "clamp(1.3rem, 1.05rem + 1.05vw, 1.5rem)"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  plan-h3:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "1.185rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "normal"
  plan-table:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.925rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  full: "9999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "20px"
  lg: "36px"
  xl: "64px"
  section: "96px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-contrast}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.accent-contrast}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-route:
    backgroundColor: "{colors.route-soft}"
    textColor: "{colors.route}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-route-hover:
    backgroundColor: "{colors.route}"
    textColor: "{colors.accent-contrast}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
    padding: "20px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg-muted}"
    rounded: "{rounded.full}"
    padding: "8px 14px"
  chip-selected:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.full}"
    padding: "8px 14px"
  stamp:
    backgroundColor: "transparent"
    textColor: "{colors.stamp-ink}"
    typography: "{typography.legend}"
    rounded: "3px"
    padding: "4px 10px"
---

# Design System: Trip Planner

## Overview

**Creative North Star: "Deniz haritası belgesi"**

Bu uygulama bir seyahat BELGESİ üretiyor — rota, günlük program, kalem kalem
bütçe. Arayüz de o belgenin dilini konuşuyor: deniz haritası kâğıdı, koordinat
ızgarası, eşyükselti çizgileri, bilet koçanı, damga, pusula. Bu öğeler dekor
değil; her biri bir içerik türünü işaretliyor ve sayfadan sayfaya aynı şeyi
söylüyor.

Reddedilen düzen: altı eşit "ikon + başlık + metin" kartından oluşan SaaS
ızgarası ve düz gri-beyaz zemin. Yerine harita LEJANTI geliyor — her satır bir
sembolün ne anlama geldiğini söylüyor.

Uygulama dili Türkçe (`lang="tr"`); tüm fontlar `latin-ext` alt kümesiyle
yükleniyor, aksi hâlde ğ/ş/İ/ı glifleri yedek fonta düşüyor.

## Colors

Strateji: **kısıtlı + rol tabanlı**. Nötr kâğıt zemin üzerinde üç adlandırılmış
rol; renk dekor değil, iş bölümü.

### Primary — Aksan (prusya mavisi)

`--accent` `#14456b`. Haritanın mürekkep rengi: birincil eylem, aktif durum,
bağlantı, öne çıkan ölçüm. Kâğıt zemininde 8.99:1, kart yüzeyinde 9.77:1.

### Secondary — Rota (macenta)

`--route` `#9c3f6a` (kâğıt 5.64 · surface-2 5.14 · route-soft 5.31).
Denizcilik haritalarında macenta özel işaretlerin rengidir; burada hareketin
ve sıranın rengi: rota hatları, durak noktaları, adım numaraları,
"buradasınız" işareti, ikincil eylem düğmesi.

`--route-vivid` `#b84e80` YALNIZCA çizgi ve dolgu içindir — metin olarak
4.24:1 verir ve eşiğin altındadır.

### Tertiary — Damga (pirinç)

`--stamp` `#b8892c`. Pusula gülünün rengi; yalnızca halka, dolgu ve vurgu.
**Metin rengi olarak kullanılmaz** (kâğıtta 2.83:1). Damga metni gerektiğinde
`--stamp-ink` `#7a5a12` kullanılır (kâğıt 5.70).

### Neutral

Soğuk mavi-gri deniz haritası kâğıdı: `--bg` `#eff3f5` → `--surface` `#fbfcfd`
→ `--surface-2` `#e3e9ed` → `--surface-3` `#d6dee4`.

Metin tonları sayfa zeminine göre DEĞİL, en koyu basıldıkları yüzeye göre
seçildi: `--fg` `#131c24` (kâğıt 15.43), `--fg-muted` `#4a5763`
(kâğıt 6.64 · surface-2 6.05 · surface-3 5.44), `--fg-subtle` `#58656f`
(kâğıt 5.36 · surface-2 4.89). Çizgiler `--line` / `--line-strong`.

Koyu tema aynı rolleri gece haritası olarak kuruyor: zemin `#0a1420`, aksan
`#5aa9d6` (7.13), rota `#d97aa8` (6.44), damga `#d9ad5c`.

### Named Rules

- **Ton, kullanıldığı en koyu yüzeye göre seçilir.** Önceki palette iki kez
  ısırdı: rota rengi sayfa zemininde 4.80 verirken kendi düğmesinde 4.29'a,
  `--fg-subtle` ise zeminde 4.66 verirken `--surface-2` üzerinde 4.26'ya
  düşüyordu. Bir renk yalnızca sayfa zemininde değil, gerçekten basıldığı
  her yüzeyde eşiği geçmeli.
- **`--surface-3` üzerinde kalıcı küçük metin varsa `--fg-muted` kullanılır.**
  `--fg-subtle` orada 4.39 veriyor.
- **Renkli zeminde ikincil metin griden değil, zeminin kendi kontrast
  renginden açılır.** Aksan panelde `--accent-contrast`/85 kullanılır; gri
  metin renkli zeminde kirli görünür.
- **Durum renkleri (ok/warn/danger/info) yalnızca ANLAM taşıdığında.**
  Kategori ayırmak için renk kullanılmaz.

## Typography

İki aile, net iş bölümü:

- **Source Serif 4** — yalnızca başlıklar ve öne çıkan rakamlar.
- **Geist Sans** — gövde, etiket, düğme, form, tablo hücresi.
- **Geist Mono** — yalnızca ÖLÇÜLEN şeyler: saat, koordinat, para, mesafe ve
  harita lejantı etiketleri.

### Hierarchy

| Rol | Boyut | Aile | Not |
|---|---|---|---|
| Hero | 2.5rem → 3.5rem, `-0.02em` | serif | `text-balance` |
| Sayfa başlığı | 1.875–2.25rem | serif | altında ölçek çubuğu |
| Bölüm | 1.5rem, `-0.015em` | serif | |
| Kart başlığı | 1.125–1.25rem | serif | |
| Gövde | 1rem / 1.7 | sans | ölçü 65–74ch |
| Lejant (`.lejant`) | 0.6875rem, `0.14em`, büyük harf | mono | |
| Ölçüm değeri | 1.5rem, tabular | serif | |

Yapay zekâ planının gövdesi (`.plan-govde`) kendi ramp'ini taşır — bu içerik
markdown'dan geliyor ve uygulama kabuğundan bağımsız bir BELGE:
`plan-h1` (akışkan 1.6→1.875rem), h2 (akışkan 1.3→1.5rem), `plan-h3` 1.185rem,
h4 = gövde, `plan-table` 0.925rem.

### Named Rules

- **Üst başlık (eyebrow/kicker) yoktur.** Başlık kendi ağırlığını taşır.
  `SayfaBasi` bileşeninde böyle bir prop bilinçli olarak bulunmuyor.
- **Mono "teknik dursun" diye kullanılmaz.** Ölçülen bir değer değilse sans.
- **Sayılar hizalanır.** Para, saat ve mesafe taşıyan her öğe `.sayisal`
  (`font-variant-numeric: tabular-nums`) alır.
- **Başlığın üstünde altından daha çok boşluk** — başlık kendinden sonrakine
  bağlıdır.

## Layout

- Kabuk `SayfaKabugu`: `max-w-6xl` (geniş) / `max-w-3xl` (dar),
  `px-4 md:px-8`, `py-10 md:py-12`. Her sayfa bunu kullanır; elle yazılan
  kabuklar sayfalar arası yatay zıplamaya yol açıyordu.
- Bölüm ritmi: `py-16 md:py-24`.
- Okuma ölçüsü paragraflarda 62–74ch ile sınırlı.
- Kırılma noktaları Tailwind varsayılanı; `sm` 640, `md` 768, `lg` 1024.
- Mobilde hiçbir sayfa yatayda kaymaz. Geniş içerik (tablo) kendi
  `overflow-x` kabında kayar.

## Elevation & Depth

Gölge gerçek bir kaynaktan düşer: ofset + yumuşak bulanıklık. Sıfır ofsetli
renkli hâle gölge değil, dekordur.

### Shadow Vocabulary

- `--shadow-kart` — `0 1px 2px rgba(23,33,31,.05)`. Duran yüzeyler.
- `--shadow-pop` — `0 12px 28px -12px rgba(23,33,31,.28), 0 2px 6px -2px rgba(23,33,31,.12)`.
  Gerçekten yüzen katmanlar: modal, açılır menü, hover'daki kart, öne çıkan belge.

### Named Rules

- **Ayrım önce kenarlıkla, sonra gölgeyle.** Yan yana on kart varken gölgeler
  birbirine karışıp zemini kirletir.
- Koyu temada gölge daha derin ve daha opaktır (`rgba(0,0,0,.7)`), çünkü koyu
  zeminde düşük opaklıkta gölge görünmez.

## Shapes

`--radius-sm` 4px · `--radius` 8px · `--radius-lg` 12px · haplar `9999px`.

Ölçek bilinçli olarak dar: eskiden aynı arayüzde `rounded-lg`, `rounded-xl`,
`rounded-2xl` ve `rounded-3xl` birlikte kullanılıyordu ve aynı işi yapan
öğeler farklı türde şeyler gibi görünüyordu.

Damga 3px köşe alır — kauçuk damganın sert kenarı.

## Components

### Buttons

Beş tür: `birincil` (aksan dolgu), `ikincil` (yüzey + kenarlık), `rota`
(terrakota yumuşak → hover'da dolu), `sessiz` (şeffaf), `tehlike` (şeffaf,
kırmızı metin, hover'da yumuşak dolgu). Üç boy: `sm` / `md` / `lg`.

- Odak halkası her zaman görünür: `ring-2` + `ring-offset-2`.
- `active:translate-y-px` — basılma geri bildirimi.
- Bekleme `bekliyor` prop'uyla: metin sabit kalır, yanına dönen gösterge
  gelir. Metni değiştirmek düğme genişliğini zıplatıyordu.
- **Yıkıcı eylem en sessiz biçimi alır** ve satırın sonuna gider.

### Chips

Seçim etiketleri gerçek `<input type="checkbox" class="peer sr-only">` üstüne
kurulur; görünen kısım `peer-checked:` ile boyanır. Klavye ve ekran okuyucu
davranışı native kalır.

### Cards / Containers

`Kart`: yüzey + 1px `--line` + `--radius-lg` + `--shadow-kart`.
`etkilesimli` hover'da kenarlığı güçlendirir, `--shadow-pop` ekler ve
`-translate-y-0.5` uygular. `kagit` varyantı kontur dokusu taşır.

**İç içe kart yoktur.** Kart bir kapsayıcıdır, hiyerarşi aracı değil.

### Inputs / Fields

`GIRDI_SINIFI` tek kaynak: yüzey zemin, `--line-strong` kenarlık, odakta
aksan kenarlık + `--accent-soft` halka. `Alan` sarmalayıcısı etiket, ipucu ve
hatayı yönetir — hata varsa ipucunun YERİNE geçer, ikisi birden gösterilmez.

### Navigation

Yapışkan üst çubuk; kaydırılınca `--bg`/88 + blur + alt hairline kazanır.
Aktif bağlantı yumuşak hap değil, altında **terrakota işaret** taşır —
"bulunduğunuz yer" bir harita fikri.

### Signature Components

- **`KonturDoku`** — iki tepe etrafında iç içe eşyükselti eğrileri. Tek
  düzensiz yol yazılıp ölçeklenerek çoğaltılıyor, radyal maskeyle sönüyor.
  Rengi `--kontur`; kapsayıcı `[--kontur:...]` ile ezebilir (aksan zeminde
  beyaz kontur).
- **`Kocan`** — iki ucu delikli kesik çizgi. Belgenin koparılabilir parçasını
  ayırır. Düz bir çizgi de ayırırdı; bu, ayırdığı şeyin NE olduğunu söylüyor.
- **`Damga`** — eğik (−6°), çift halkalı, aralıklı büyük harf. Rozetten farkı
  ağırlığı: rozet bir ETİKET, damga bir HÜKÜM.
- **`Pusula`** — uygulamanın işareti; kuzey kolu dolu. "TP" harflerinin yerini
  aldı.
- **`Olcum`** — lejant etiketi + serif tabular değer. Göz etiketleri atlayıp
  değerleri tarayabiliyor.
- **`.harita-zemin`** — 34px koordinat ızgarası, her 5. çizgide (170px) daha
  koyu. Gerçek bir graticule böyle davranır.

## Motion

Sayfada **tek koreografi anı** var: ana sayfada örnek planın rota çizgisi
çiziliyor (`.rota-ciz`, 1.6s, `cubic-bezier(0.16, 1, 0.3, 1)`) ve ardından
"HAZIR" damgası oturuyor (`.damga-bas`). Geçişler 150–200ms.

`prefers-reduced-motion: reduce` altında her animasyon durur ve rota çizgisi
**tam görünür** kalır (`stroke-dasharray: none`) — yarım çizilmiş bir rota
bilgi kaybıdır.

## Browser Surfaces

Çizilmeyen parçalar da sistemin parçası: `::selection`, `caret-color`,
`accent-color`, kaydırma çubuğu (ray `--surface-2`, tutamak `--line-strong`,
3px zemin kenarlıklı), Firefox `scrollbar-color`. Bunlar varsayılan bırakılırsa
sayfa "kurulmuş" değil "birleştirilmiş" görünür.

## Do's and Don'ts

### Do:

- Rengi token'dan al (`var(--accent)`), ham Tailwind renginden değil.
- Ölçülen her değere `.sayisal`, her küçük etikete `.lejant` ver.
- Yeni bir yüzeyde renk kullanmadan önce o yüzeydeki kontrastı ölç.
- Boş durumu bir DAVET olarak yaz: ne olduğunu ve sıradaki adımı söyle.
- Hata metninde PROBLEMİ, düğmede ÇIKIŞ YOLUNU söyle.

### Don't:

- **Üst başlık (kicker/eyebrow) ekleme.** Başlık kendi ağırlığını taşır.
- **`--stamp` veya `--route-vivid` ile metin yazma.** İkisi de metin eşiğinin
  altında; `--stamp-ink` ve `--route` var.
- **Aynı zeminin rengiyle metin yazma.** Bu projede `bg-[var(--accent)]`
  üzerine `text-[var(--accent)]` iki ayrı sayfada görünmez metin üretmişti.
- **Kart içine kart koyma.**
- **Unicode karakteri (✓ → ↗ ×) ikon yerine kullanma.** Çizilmiş ikon kullan.
- **Her bölüme ayrı giriş animasyonu dağıtma.** Tek koreografi anı var.
- **Sıralı olmayan listeye numara verme.** (01/02/03 yalnızca gerçek sıra
  bilgi taşıdığında: "Nasıl çalışır" adımları ve form bölümleri.)
- **`prose` sınıflarına güvenme.** `@tailwindcss/typography` bu projede kurulu
  değil; plan gövdesi `.plan-govde` altında elle tanımlı.
