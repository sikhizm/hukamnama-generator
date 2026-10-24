import { loginConfigured } from "@/lib/appSession";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";
export default function LoginPage() {
  return <main className="grid min-h-screen place-items-center bg-[#0a0b10] p-5 text-zinc-200"><section className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#10121b] p-7">
    <p className="text-xs uppercase tracking-widest text-amber-300">Sikhizm</p><h1 className="mt-2 text-2xl font-semibold">Hukamnama Studio</h1><p className="mt-3 text-sm leading-6 text-zinc-400">Sign in to create and publish. Your browser stays signed in for up to 30 days.</p>
    {loginConfigured() ? <LoginForm /> : <p className="mt-5 text-sm leading-6 text-amber-200">Set APP_USERNAME and APP_PASSWORD in Vercel. The password needs at least 12 characters. Set APP_SESSION_SECRET to a random value of at least 32 characters, or retain the existing SOCIAL_ADMIN_KEY as the session secret, then redeploy.</p>}
  </section></main>;
}
