import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookieOptions, googleConfig, googleToken, seal, unseal, STATE_COOKIE, YOUTUBE_COOKIE, youtubeChannel } from "@/lib/youtube";

export async function GET(request: NextRequest) {
  const destination = new URL("/", request.url);
  try {
    const saved = unseal<{ state: string; expires: number }>(request.cookies.get(STATE_COOKIE)?.value ?? "");
    const state = request.nextUrl.searchParams.get("state") ?? "";
    const a = Buffer.from(saved.state), b = Buffer.from(state);
    const code = request.nextUrl.searchParams.get("code");
    if (a.length !== b.length || !timingSafeEqual(a, b) || !code) throw new Error("OAuth failed");
    const config = googleConfig();
    const tokens = await googleToken({ grant_type: "authorization_code", code, redirect_uri: config.redirectUri });
    if (!tokens.refresh_token) throw new Error("Refresh token missing");
    const channel = await youtubeChannel(tokens.access_token);
    destination.searchParams.set("youtube", "connected");
    const response = NextResponse.redirect(destination);
    response.cookies.set(YOUTUBE_COOKIE, seal({ ...channel, refreshToken: tokens.refresh_token, expires: Date.now() + 365 * 86400000 }), { ...cookieOptions, maxAge: 365 * 86400 });
    response.cookies.delete(STATE_COOKIE);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    destination.searchParams.set("youtube", "failed");
    const response = NextResponse.redirect(destination); response.cookies.delete(STATE_COOKIE); return response;
  }
}
