import { NextResponse } from "next/server";
import { matchGurbaniNowMetadata, parseSgpcDailyMukhwakPage, parseSgpcPage, parseSikhizmFeed, parseSikhizmPunjabiTranslation, type LiveHukamnama } from "@/lib/hukamnama/liveSource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function indiaDateISO(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function isSikhizmUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["sikhizm.com", "www.sikhizm.com"].includes(url.hostname);
  } catch {
    return false;
  }
}

async function loadSikhizmTranslation(record: LiveHukamnama): Promise<void> {
  try {
    const feedResponse = await fetch("https://sikhizm.com/category/hukamnama/feed/", {
      headers: { "user-agent": "Sikhizm-Hukamnama-Studio/1.0", accept: "application/rss+xml, application/xml, text/xml" },
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 180 },
    });
    if (!feedResponse.ok) return;
    const post = parseSikhizmFeed(await feedResponse.text()).find((candidate) => candidate.localDateISO === record.sourceDateISO);
    if (!post || !isSikhizmUrl(post.link)) return;

    const articleResponse = await fetch(post.link, {
      headers: { "user-agent": "Sikhizm-Hukamnama-Studio/1.0", accept: "text/html" },
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 180 },
    });
    if (!articleResponse.ok) return;
    const translation = parseSikhizmPunjabiTranslation(await articleResponse.text(), record.original, record.ang);
    if (translation) {
      record.translation = translation;
      record.sourceName = "SGPC Daily Mukhwak + matched Sikhizm Punjabi translation";
    }
  } catch {
    // Leave the translation blank when no same-day, same-shabad Sikhizm match is available.
  }
}

export async function GET(request: Request) {
  const refresh = new URL(request.url).searchParams.get("refresh") === "1";
  try {
    const checkedAt = new Date().toISOString();
    const todayISO = indiaDateISO(new Date());
    const fetchOptions = (referer: string) => ({
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-IN,en;q=0.9,pa;q=0.8",
        referer,
      },
      signal: AbortSignal.timeout(10_000),
      ...(refresh ? { cache: "no-store" as const } : { next: { revalidate: 60 } }),
    });
    let record: LiveHukamnama | null = null;
    let primaryError = "SGPC live page could not be fetched.";
    try {
      const response = await fetch("https://hs.sgpc.net/index.php", fetchOptions("https://hs.sgpc.net/"));
      if (!response.ok) throw new Error(`SGPC live page returned HTTP ${response.status}.`);
      record = parseSgpcPage(await response.text(), todayISO, checkedAt);
    } catch (error) {
      primaryError = error instanceof Error ? error.message : primaryError;
    }
    if (!record) {
      const fallbackResponse = await fetch("https://sgpc.net/daily-mukhwak-pdf/", fetchOptions("https://sgpc.net/"));
      if (!fallbackResponse.ok) throw new Error(`${primaryError} The official SGPC Daily Mukhwak fallback returned HTTP ${fallbackResponse.status}.`);
      record = parseSgpcDailyMukhwakPage(await fallbackResponse.text(), todayISO, checkedAt);
      if (record.isToday) await loadSikhizmTranslation(record);
    }
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
