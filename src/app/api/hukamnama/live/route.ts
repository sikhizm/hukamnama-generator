import { NextResponse } from "next/server";
import { matchGurbaniNowMetadata, parseSgpcPage } from "@/lib/hukamnama/liveSource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function indiaDateISO(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export async function GET(request: Request) {
  const refresh = new URL(request.url).searchParams.get("refresh") === "1";
  try {
    const response = await fetch("https://hs.sgpc.net/index.php", {
      headers: { "user-agent": "Sikhizm-Hukamnama-Studio/1.0", accept: "text/html" },
      signal: AbortSignal.timeout(12_000),
      ...(refresh ? { cache: "no-store" as const } : { next: { revalidate: 180 } }),
    });
    if (!response.ok) throw new Error(`SGPC returned HTTP ${response.status}.`);
    const html = await response.text();
    const checkedAt = new Date().toISOString();
    const record = parseSgpcPage(html, indiaDateISO(new Date()), checkedAt);
    if (record.isToday) {
      try {
        const metadataResponse = await fetch("https://api.gurbaninow.com/v2/hukamnama/today", {
          headers: { "user-agent": "Sikhizm-Hukamnama-Studio/1.0", accept: "application/json" },
          signal: AbortSignal.timeout(8_000),
          cache: "no-store",
        });
        if (metadataResponse.ok) {
          record.matchedAuthor = matchGurbaniNowMetadata(await metadataResponse.json(), record);
          record.metadataMatched = Boolean(record.matchedAuthor);
        }
      } catch {
        // SGPC remains authoritative; a temporarily unavailable matcher should not hide the live Hukamnama.
      }
    }
    return NextResponse.json(record, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Could not reach the SGPC live page.",
      checkedAt: new Date().toISOString(),
    }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
