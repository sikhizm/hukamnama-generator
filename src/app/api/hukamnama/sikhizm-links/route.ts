import { NextResponse } from "next/server";
import { findEvergreenLinks } from "@/lib/hukamnama/sikhizmLinks";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length")) > 80_000) return NextResponse.json({ error: "Hukamnama lookup request is too large." }, { status: 400 });
    const body = await request.json();
    if (typeof body.date !== "string" || !/^20\d{2}-\d{2}-\d{2}$/.test(body.date) || typeof body.ang !== "string" || !/^\d{1,4}$/.test(body.ang) || Number(body.ang) < 1 || Number(body.ang) > 1430 || typeof body.original !== "string" || body.original.length > 20000 || body.original.trim().length < 32) {
      return NextResponse.json({ error: "Load the Hukamnama date, Ang and original Gurbani before searching for links." }, { status: 400 });
    }
    return NextResponse.json(await findEvergreenLinks(body), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not read the Hukamnama lookup request." }, { status: 400 });
  }
}
export async function GET() {
  return NextResponse.json({ error: "A date alone cannot identify an evergreen article. Reload the app and search with its Ang and Gurbani." }, { status: 400 });
}
