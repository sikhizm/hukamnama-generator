import { NextRequest, NextResponse } from "next/server";
import { APP_COOKIE } from "@/lib/appSession";
import { STATE_COOKIE, YOUTUBE_COOKIE } from "@/lib/youtube";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const response = NextResponse.json({ signedIn: false }, { headers: { "Cache-Control": "no-store" } });
  for (const name of [APP_COOKIE, STATE_COOKIE, YOUTUBE_COOKIE]) response.cookies.delete(name);
  return response;
}
