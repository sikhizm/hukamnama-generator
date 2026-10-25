import Link from "next/link";
import SocialPublisher from "@/components/publisher/SocialPublisher";

import { LABELS, isPlatform, CONNECTION_ISSUES, type ConnectionIssue } from "@/lib/publisher/model";
import LogoutButton from "@/components/LogoutButton";

export const metadata = { title: "Social Publisher — Sikhizm" };

export default async function PostsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const connected = typeof params.connected === "string" && isPlatform(params.connected) ? LABELS[params.connected] : "";
  const failed = typeof params.connectionFailed === "string" && isPlatform(params.connectionFailed) ? LABELS[params.connectionFailed] : "";
  const issue = typeof params.connectionIssue === "string" && Object.hasOwn(CONNECTION_ISSUES, params.connectionIssue) ? params.connectionIssue as ConnectionIssue : null;
  const providerDetails: Partial<Record<ConnectionIssue, string>> = {
    "permission-denied": "Authorization was declined or blocked. Approve the requested permissions for this provider.",
    "redirect-mismatch": "The callback URL must exactly match the redirect URL registered with this provider.",
    "credentials-rejected": "The provider rejected the app credentials. Check its matching Client ID and Client Secret in Vercel Production, then redeploy.",
    "token-rejected": "The provider rejected the code exchange. Check its credentials and exact callback URL, then start Connect again.",
    "identity-rejected": "The account or configured destination blog could not be verified. Check access to that destination and reconnect.",
  };
  const detail = issue ? (params.connectionFailed !== "threads" ? providerDetails[issue] ?? CONNECTION_ISSUES[issue] : CONNECTION_ISSUES[issue]) : "Check the callback URL, requested permissions and app approval, then try again.";
  const numbers = ["providerStatus", "providerCode", "providerSubcode"].map(key => typeof params[key] === "string" && /^\d{1,9}$/.test(params[key] as string) ? `${key}=${params[key]}` : "").filter(Boolean);
  const diagnostic = issue ? ` Diagnostic: ${issue}${numbers.length ? ` (${numbers.join(", ")})` : ""}.` : "";
  const notice = connected ? `${connected} connected. Use Restore draft to recover your saved text, then choose your media again.` : failed ? `${failed} could not connect. ${detail}${diagnostic} Your previous connection has been kept.` : "";
  return <main className="min-h-screen bg-[#0a0b10] px-4 py-8 text-zinc-200 sm:px-8">
    <div className="mx-auto max-w-[1600px]">
      <nav className="mb-8 flex items-center justify-between text-sm"><Link href="/" className="text-amber-300">← Hukamnama Studio</Link><LogoutButton /></nav>
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">Create once · Share widely</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">Social Publisher</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">Create a post or import a Sikhizm article, tailor it for each platform, and publish to your connected accounts.</p>
      <SocialPublisher initialNotice={notice} />
    </div>
  </main>;
}
