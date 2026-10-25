import { identity, type Connection } from "./connections";

export function hasThreadsServerToken(): boolean { return !!process.env.THREADS_ACCESS_TOKEN?.trim(); }

// Personal-account alternative to OAuth. The token never enters a browser cookie
// or API response. Verify its account before each use; fail closed if invalid.
export async function serverThreadsConnection(request: typeof fetch = fetch): Promise<Connection | null> {
  const token = process.env.THREADS_ACCESS_TOKEN?.trim();
  if (!token) return null;
  if (token.length > 20000 || /\s/.test(token)) throw new Error("Check THREADS_ACCESS_TOKEN in Vercel Production. Paste only the generated token, then redeploy.");
  let user: Awaited<ReturnType<typeof identity>>;
  try { user = await identity("threads", token, request); }
  catch { throw new Error("The saved Threads token could not be verified. It may have expired or been revoked. Replace THREADS_ACCESS_TOKEN in Vercel Production and redeploy."); }
  if (user.name.toLowerCase().replace(/^@/, "") !== "sikhizmcom") throw new Error("The saved Threads token belongs to another account. Generate a token for @sikhizmcom, save it in Vercel Production and redeploy.");
  // This is a request-local verification snapshot, not the provider token's expiry.
  return { platform: "threads", accessToken: token, id: user.id, name: user.name, expires: Date.now() + 30000 };
}
