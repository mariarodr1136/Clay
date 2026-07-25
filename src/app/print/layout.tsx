// Print pages carry no app chrome — no nav, no theme toggle, no panels.
// They exist to be captured by the PDF renderer (and are perfectly readable
// if you open one directly), so the only wrapper is a page-width container.
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-6xl px-8 py-8">{children}</main>;
}
