import Link from "next/link";
import ImagePostComposer from "@/components/studio/ImagePostComposer";
import LogoutButton from "@/components/LogoutButton";

export default function PostsPage() {
  return <main className="min-h-screen bg-[#0a0b10] px-4 py-8 text-zinc-200 sm:px-8">
    <div className="mx-auto max-w-6xl">
      <nav className="mb-8 flex items-center justify-between text-sm"><Link href="/" className="text-amber-300">← Hukamnama Studio</Link><LogoutButton /></nav>
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">Share the wisdom</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">Gurbani Posts</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">Upload your artwork, write a caption, and publish to your connected Sikhizm accounts whenever you choose.</p>
      <ImagePostComposer />
    </div>
  </main>;
}
