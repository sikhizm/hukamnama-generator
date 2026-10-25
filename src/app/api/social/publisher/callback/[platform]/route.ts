import { NextRequest, NextResponse } from "next/server";
import { seal, unseal, googleToken, youtubeChannel, YOUTUBE_COOKIE, cookieOptions } from "@/lib/youtube";
import { timingSafeEqual } from "node:crypto";
import { finishOAuth, verifyState, oauthPlatforms, stateName, cookieName, publisherCookie, OAuthConnectionError, connectionFailure, type OAuthPlatform } from "@/lib/publisher/connections";

export async function GET(request: NextRequest, context: { params: Promise<{ platform: string }> }) {
  const { platform } = await context.params;
  const destination = new URL("/posts", request.url);
  const response = NextResponse.redirect(destination);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  if (platform === "youtube") {
    try {
      const saved = unseal<{ state: string; platform: string; expires: number }>(request.cookies.get(stateName(platform))?.value ?? "");
      const a = Buffer.from(saved.state), b = Buffer.from(request.nextUrl.searchParams.get("state") ?? "");
      const code = request.nextUrl.searchParams.get("code");
      if (saved.platform !== platform || a.length !== b.length || !timingSafeEqual(a, b) || !code || request.nextUrl.searchParams.has("error")) throw new Error("Authorization failed");
      const base = new URL(process.env.PUBLISHER_REDIRECT_BASE ?? "");
      const tokens = await googleToken({ grant_type: "authorization_code", code, redirect_uri: `${base.origin}/api/social/publisher/callback/youtube` });
      if (!tokens.refresh_token) throw new Error("Refresh token missing");
      const channel = await youtubeChannel(tokens.access_token);
      response.cookies.set(YOUTUBE_COOKIE, seal({ ...channel, refreshToken: tokens.refresh_token, expires: Date.now() + 365 * 86400000 }), { ...cookieOptions, maxAge: 365 * 86400 });
      destination.searchParams.set("connected", platform);
    } catch { destination.searchParams.set("connectionFailed", platform); }
    response.cookies.set(stateName(platform), "", { ...publisherCookie, maxAge: 0 }); response.headers.set("Location", destination.toString()); return response;
  }
  if (!oauthPlatforms.includes(platform as OAuthPlatform)) return response;
  try {
    const saved = verifyState(request.cookies.get(stateName(platform))?.value ?? "", platform as OAuthPlatform, request.nextUrl.searchParams.get("state") ?? "");
    if (request.nextUrl.searchParams.has("error")) throw new OAuthConnectionError("permission-denied");
    const code = request.nextUrl.searchParams.get("code"); if (!code) throw new OAuthConnectionError("no-code");
    const session = await finishOAuth(platform as OAuthPlatform, code, saved);
    const value = seal(session); if (value.length > 3600) throw new OAuthConnectionError("cookie-capacity");
    response.cookies.set(cookieName(session.platform), value, { ...publisherCookie, maxAge: Math.max(1, Math.floor((session.expires - Date.now()) / 1000)) });
    destination.searchParams.set("connected", platform);
  } catch (error) {
    const failure = connectionFailure(error);
    destination.searchParams.set("connectionFailed", platform);
    destination.searchParams.set("connectionIssue", failure.issue);
    if (failure.httpStatus !== undefined) destination.searchParams.set("providerStatus", String(failure.httpStatus));
    if (failure.providerCode !== undefined) destination.searchParams.set("providerCode", String(failure.providerCode));
    if (failure.providerSubcode !== undefined) destination.searchParams.set("providerSubcode", String(failure.providerSubcode));
    console.warn("Publisher OAuth callback failed", { platform, issue: failure.issue, httpStatus: failure.httpStatus, providerCode: failure.providerCode, providerSubcode: failure.providerSubcode });
  }
  response.cookies.set(stateName(platform), "", { ...publisherCookie, maxAge: 0 });
  response.headers.set("Location", destination.toString()); return response;
}
