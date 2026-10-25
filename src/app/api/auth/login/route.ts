import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { correctCredentials, credentialsVersion, loginConfigured, sessionOptions, SESSION_TTL, type AppSession } from "@/lib/appSession";

// Supplemental per-instance throttling. Strong credentials and the deployment's
// platform request controls remain necessary across serverless instances.
const attempts = new Map<string, { count: number; until: number }>();
export async function POST(request: NextRequest) {
  const reply = (data: unknown, status: number) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
  if (request.headers.get("origin") !== request.nextUrl.origin) return reply({ error: "Open the login form from this app." }, 403);
  if (!loginConfigured()) return reply({ error: "Login setup is incomplete. Configure the login settings in Vercel and redeploy." }, 503);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const now = Date.now();
  if (attempts.size > 1000) for (const [key, entry] of attempts) if (entry.until < now) attempts.delete(key);
  const limit = attempts.get(ip);
  if (limit && limit.until > now && limit.count >= 10) return reply({ error: "Too many attempts. Try again in 15 minutes." }, 429);
  try {
    if (Number(request.headers.get("content-length")) > 8192) return reply({ error: "Invalid login request." }, 400);
    const data = await request.json();
    const username = typeof data.username === "string" ? data.username : "";
    const password = typeof data.password === "string" ? data.password : "";
    if (username.length > 200 || password.length > 512 || !correctCredentials(username, password)) {
      attempts.set(ip, { count: limit && limit.until > now ? limit.count + 1 : 1, until: limit && limit.until > now ? limit.until : now + 900000 });
      return reply({ error: "Incorrect username or password." }, 401);
    }
    attempts.delete(ip);
    const session = await getIronSession<AppSession>(await cookies(), sessionOptions());
    session.username = username; session.version = credentialsVersion(); session.expires = now + SESSION_TTL * 1000;
    await session.save();
    return reply({ signedIn: true }, 200);
  } catch { return reply({ error: "Could not sign in. Try again." }, 400); }
}
