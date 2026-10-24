import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authorizeSocial } from "@/lib/socialAuth";
import { googleConfig, seal, STATE_COOKIE, cookieOptions } from "@/lib/youtube";

export async function POST(request: NextRequest) {
  const auth = authorizeSocial(request);
  if (auth) return NextResponse.json({ error: auth }, { status: 401 });
  try {
    const config = googleConfig();
    const state = randomBytes(32).toString("base64url");
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code", access_type: "offline", prompt: "consent", scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly", state }).toString();
    const response = NextResponse.json({ url: url.toString() }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(STATE_COOKIE, seal({ state, expires: Date.now() + 600000 }), { ...cookieOptions, maxAge: 600 });
    return response;
  } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 503 }); }
}
