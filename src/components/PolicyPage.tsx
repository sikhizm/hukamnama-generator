import Link from "next/link";
import type { ReactNode } from "react";

export default function PolicyPage({ title, children }: { title: string; children: ReactNode }) {
  return <main className="mx-auto max-w-3xl px-6 py-12 text-zinc-200">
    <Link href="/" className="text-amber-300 underline">Sikhizm Publisher</Link>
    <h1 className="mt-6 text-3xl font-bold">{title}</h1>
    <p className="mt-2 text-sm text-zinc-400">Updated 27 October 2026</p>
    <article className="mt-8 space-y-6 leading-7 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_a]:text-amber-300 [&_a]:underline">{children}</article>
    <nav aria-label="Policies" className="mt-12 flex flex-wrap gap-5 border-t border-white/10 pt-6 text-sm">
      <Link href="/privacy">Privacy policy</Link><Link href="/terms">Terms of service</Link><Link href="/data-deletion">Data deletion</Link>
    </nav>
  </main>;
}
