"use client";

import { useMemo } from "react";
import { Marked, type Tokens } from "marked";

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Plan metinleri bir dil modelinden geldiği için güvenilmez içerik sayılır:
// ham HTML atılır, görseller metne çevrilir, bağlantılar yalnızca http(s)/mailto olabilir.
const parser = new Marked({ gfm: true, breaks: false });

parser.use({
  renderer: {
    html() {
      return "";
    },
    image({ text }: Tokens.Image) {
      return escapeHtml(text ?? "");
    },
    link({ href, tokens }: Tokens.Link) {
      const label = this.parser.parseInline(tokens);
      if (!/^(https?:\/\/|mailto:)/i.test(href ?? "")) return label;
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer nofollow">${label}</a>`;
    },
  },
});

export function renderMarkdown(source: string): string {
  const html = parser.parse(source, { async: false }) as string;
  return html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, "</table></div>");
}

export default function Markdown({ children, className = "" }: { children: string | null | undefined; className?: string }) {
  const html = useMemo(() => (children ? renderMarkdown(children) : ""), [children]);
  if (!html) return null;
  return <div className={`prose-plan ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
