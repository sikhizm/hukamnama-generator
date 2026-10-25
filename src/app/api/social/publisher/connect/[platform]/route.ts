import { NextRequest, NextResponse } from "next/server";
import { authorizeSocial } from "@/lib/socialAuth";
import { oauthPlatforms, oauthConfig, startOAuth, stateName, publisherCookie, cookieName, type OAuthPlatform } from "@/lib/publisher/connections";
import { randomBytes } from "node:crypto";
import { googleConfig, seal } from "@/lib/youtube";

export async function POST(request: NextRequest, context: { params: Promise<{ platform: string }> }) {
  const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
  const auth = await authorizeSocial(request); if (auth) return reply({ error: auth }, 401);
  const { platform } = await context.params;
  if (platform === "youtube") {
    try {
      const config = googleConfig(), base = new URL(process.env.PUBLISHER_REDIRECT_BASE ?? "");
      if (base.protocol !== "https:") throw new Error("Set PUBLISHER_REDIRECT_BASE to this app's HTTPS origin.");
      const state = randomBytes(32).toString("base64url");
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: `${base.origin}/api/social/publisher/callback/youtube`, response_type: "code", access_type: "offline", prompt: "consent", scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly", state }).toString();
      const response = reply({ url: url.toString() });
      response.cookies.set(stateName(platform), seal({ state, platform, expires: Date.now() + 600000 }), { ...publisherCookie, maxAge: 600 }); return response;
    } catch { return reply({ error: "Configure the existing YouTube credentials, PUBLISHER_REDIRECT_BASE, and register the Social Publisher callback URL with Google." }, 503); }
  }
  if (!oauthPlatforms.includes(platform as OAuthPlatform)) return reply({ error: "Choose a supported OAuth connection." }, 400);
  try {
    if (request.nextUrl.searchParams.get("disconnect") === "1") { const response = reply({ disconnected: true }); response.cookies.set(cookieName(platform as OAuthPlatform), "", { ...publisherCookie, maxAge: 0 }); return response; }
    const config = oauthConfig(platform as OAuthPlatform);
    if (new URL(config.redirect).origin !== request.nextUrl.origin) return reply({ error: `Open Social Publisher at ${new URL(config.redirect).origin}/posts before connecting. The callback must use the same app hostname so the browser can return its connection cookie.` }, 400);
    const result = startOAuth(platform as OAuthPlatform);
    const response = reply({ url: result.url });
    response.cookies.set(stateName(platform), result.cookie, { ...publisherCookie, maxAge: 600 }); return response;
  } catch (error) { return reply({ error: (error as Error).message }, 503); }
}
