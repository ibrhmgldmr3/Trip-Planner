import DOMPurify from "isomorphic-dompurify";

/**
 * LLM çıktısından üretilen HTML'i tarayıcıya basmadan önce temizler.
 *
 * `marked` varsayılan olarak HTML'i escape etmez; modelin ürettiği metne
 * `<img onerror=...>` gibi bir yük enjekte edilirse (prompt injection ya da
 * kullanıcının kendi girdisi üzerinden) doğrudan XSS'e dönüşür. Bu yüzden
 * hem kaydetmeden önce hem de render ederken buradan geçirin.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    // Seyahat planı metni için gereken etiketler; script/iframe/style yok.
    ALLOWED_TAGS: [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "p", "br", "hr", "blockquote", "pre", "code",
      "strong", "em", "b", "i", "u", "s", "del", "mark", "small", "sub", "sup",
      "ul", "ol", "li", "dl", "dt", "dd",
      "table", "thead", "tbody", "tfoot", "tr", "th", "td",
      "a", "span", "div",
    ],
    // `class`: plan-detail sayfası Tailwind sınıflarıyla HTML üretiyor.
    ALLOWED_ATTR: ["href", "title", "target", "rel", "colspan", "rowspan", "align", "class"],
    // javascript:, data: gibi şemaları engelle.
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|#)/i,
  });
}
