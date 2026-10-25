import { NextRequest, NextResponse } from "next/server";
import { APP_COOKIE, readAppSession } from "@/lib/appSession";

export async function proxy(request: NextRequest) {
  const session = await readAppSession(request.cookies.get(APP_COOKIE)?.value);
  if (session) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "Your session expired. Sign in again." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return NextResponse.redirect(new URL("/login", request.url));
}
export const config = { matcher: ["/", "/posts/:path*", "/api/social/:path*", "/api/hukamnama/:path*"] };
