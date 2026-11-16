/**
 * Keşfet ve ana sayfada gösterilen, elle seçilmiş Türkiye rotaları.
 * Bir destinasyon veritabanı yok; bu liste yalnızca ilham ve hızlı başlangıç içindir.
 * `name` aynı zamanda kapak fotoğrafı için Wikipedia madde başlığıdır.
 */

export type TravelType = "kültür" | "doğa" | "deniz" | "gastronomi" | "şehir";

export type Region =
  | "Marmara"
  | "Ege"
  | "Akdeniz"
  | "İç Anadolu"
  | "Karadeniz"
  | "Doğu Anadolu"
  | "Güneydoğu Anadolu";

export interface Destination {
  name: string;
  region: Region;
  /** Önerilen gezi süresi (gün): [en az, en çok]. */
  days: [number, number];
  types: TravelType[];
  blurb: string;
  /** Yalın ad belirsizse kapak için bakılacak Wikipedia madde başlığı. */
  wikiTitle?: string;
}

export const TRAVEL_TYPES: { value: TravelType; label: string }[] = [
  { value: "kültür", label: "Kültür" },
  { value: "doğa", label: "Doğa" },
  { value: "deniz", label: "Deniz" },
  { value: "gastronomi", label: "Gastronomi" },
  { value: "şehir", label: "Şehir" },
];

export const TYPE_LABEL: Record<TravelType, string> = Object.fromEntries(
  TRAVEL_TYPES.map((type) => [type.value, type.label])
) as Record<TravelType, string>;

export const DESTINATIONS: Destination[] = [
  {
    name: "İstanbul",
    region: "Marmara",
    days: [3, 5],
    types: ["kültür", "şehir", "gastronomi"],
    blurb: "İki kıtaya yayılan şehirde tarihi yarımada, Boğaz kıyıları ve kapalı çarşılar bir arada.",
  },
  {
    name: "Kapadokya",
    region: "İç Anadolu",
    days: [2, 3],
    types: ["doğa", "kültür"],
    blurb: "Peri bacaları, kayalara oyulmuş kiliseler ve yeraltı şehirleriyle bilinen volkanik bir bölge.",
  },
  {
    name: "İzmir",
    region: "Ege",
    days: [2, 4],
    types: ["şehir", "gastronomi", "deniz", "kültür"],
    blurb: "Kordon boyunda yürüyüş, Kemeraltı Çarşısı ve günübirlik gidilebilen antik kentler.",
  },
  {
    name: "Antalya",
    region: "Akdeniz",
    days: [3, 5],
    types: ["deniz", "kültür", "doğa"],
    blurb: "Kaleiçi’nin dar sokakları, uzun sahiller ve çevresindeki antik kentler.",
  },
  {
    name: "Mardin",
    region: "Güneydoğu Anadolu",
    days: [2, 3],
    types: ["kültür", "gastronomi"],
    blurb: "Mezopotamya ovasına bakan taş evler, eski çarşılar ve manastırlar.",
  },
  {
    name: "Trabzon",
    region: "Karadeniz",
    days: [3, 4],
    types: ["doğa", "kültür"],
    blurb: "Sümela Manastırı, Uzungöl ve yeşil yaylalarla çevrili bir Karadeniz kıyı şehri.",
  },
  {
    name: "Bursa",
    region: "Marmara",
    days: [2, 3],
    types: ["kültür", "gastronomi", "şehir"],
    blurb: "Osmanlı’nın ilk başkenti; tarihi hanlar, camiler ve Uludağ’a kısa bir yol.",
  },
  {
    name: "Eskişehir",
    region: "İç Anadolu",
    days: [1, 2],
    types: ["şehir", "kültür"],
    blurb: "Porsuk Çayı kıyısı, Odunpazarı’nın renkli evleri ve müzeleriyle canlı bir öğrenci şehri.",
  },
  {
    name: "Gaziantep",
    region: "Güneydoğu Anadolu",
    days: [2, 3],
    types: ["gastronomi", "kültür"],
    blurb: "Mutfağıyla tanınan şehir; Zeugma Mozaik Müzesi ve tarihi çarşıları da burada.",
  },
  {
    name: "Bodrum",
    region: "Ege",
    days: [3, 5],
    types: ["deniz"],
    blurb: "Bodrum Kalesi, sakin koylar ve beyaz badanalı evlerle bilinen bir yarımada.",
  },
  {
    name: "Fethiye",
    region: "Akdeniz",
    days: [3, 5],
    types: ["deniz", "doğa"],
    blurb: "Ölüdeniz, Kelebekler Vadisi ve Likya Yolu’nun başladığı kıyı.",
  },
  {
    name: "Safranbolu",
    region: "Karadeniz",
    days: [1, 2],
    types: ["kültür"],
    blurb: "UNESCO Dünya Mirası listesindeki ahşap Osmanlı konaklarıyla korunmuş bir çarşı kenti.",
  },
  {
    name: "Pamukkale",
    region: "Ege",
    days: [1, 2],
    types: ["doğa", "kültür"],
    blurb: "Beyaz traverten terasları ve hemen üstündeki Hierapolis antik kenti.",
  },
  {
    name: "Amasya",
    region: "Karadeniz",
    days: [1, 2],
    types: ["kültür"],
    blurb: "Yeşilırmak boyundaki tarihi evler ve kayalara oyulmuş Pontus kral mezarları.",
  },
  {
    name: "Şanlıurfa",
    region: "Güneydoğu Anadolu",
    days: [2, 3],
    types: ["kültür", "gastronomi"],
    blurb: "Göbeklitepe, Balıklıgöl ve tarihi çarşılarıyla çok katmanlı bir şehir.",
  },
  {
    name: "Kaş",
    wikiTitle: "Kaş, Antalya",
    region: "Akdeniz",
    days: [3, 4],
    types: ["deniz", "doğa"],
    blurb: "Dalış noktaları, Kekova ve Likya kalıntılarına yakın küçük bir liman kasabası.",
  },
];

/** Listede geçen bölgeler, listedeki ilk görünme sırasıyla. */
export const REGIONS: Region[] = [...new Set(DESTINATIONS.map((destination) => destination.region))];

/** "2–3 gün" ya da "2 gün". */
export function formatDays([min, max]: [number, number]): string {
  return min === max ? `${min} gün` : `${min}–${max} gün`;
}

/** `getCityCovers` için kapak sorgusu. */
export function coverRef(destination: Destination): { city: string; title?: string } {
  return destination.wikiTitle ? { city: destination.name, title: destination.wikiTitle } : { city: destination.name };
}

export function findDestination(name: string): Destination | undefined {
  return DESTINATIONS.find((destination) => destination.name === name);
}
