/** Sayfa geçişi: her gezinmede içerik kısa bir fade + slide ile gelir (bkz. globals.css `.page-in`). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in flex flex-1 flex-col">{children}</div>;
}
