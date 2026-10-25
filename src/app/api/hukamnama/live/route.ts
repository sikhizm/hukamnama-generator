import { NextResponse } from "next/server";
import { parseHukamnamaSahib, parseDekhoJi, normalizedVerse, headingAuthor } from "@/lib/hukamnama/fallbackSources";
import { parseSgpcDailyMukhwakPage, parseSgpcPage, parseSikhizmFeed, parseSikhizmLiveArticle, type LiveHukamnama } from "@/lib/hukamnama/liveSource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

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

async function loadSikhizmToday(todayISO: string, checkedAt: string, refresh: boolean): Promise<LiveHukamnama> {
  const feedResponse = await fetch("https://sikhizm.com/category/hukamnama/feed/", {
    headers: { "user-agent": "Sikhizm-Hukamnama-Studio/1.0", accept: "application/rss+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(8_000),
    ...(refresh ? { cache: "no-store" as const } : { next: { revalidate: 60 } }),
  });
  if (!feedResponse.ok) throw new Error(`Sikhizm Hukamnama feed returned HTTP ${feedResponse.status}.`);
  const post = parseSikhizmFeed(await feedResponse.text()).find((candidate) => candidate.localDateISO === todayISO);
  if (!post || !isSikhizmUrl(post.link)) throw new Error("No same-day Hukamnama post was found in the Sikhizm feed.");

  const articleResponse = await fetch(post.link, {
    headers: { "user-agent": "Sikhizm-Hukamnama-Studio/1.0", accept: "text/html" },
    signal: AbortSignal.timeout(8_000),
    ...(refresh ? { cache: "no-store" as const } : { next: { revalidate: 60 } }),
  });
  if (!articleResponse.ok) throw new Error(`Today's Sikhizm Hukamnama post returned HTTP ${articleResponse.status}.`);
  return parseSikhizmLiveArticle(await articleResponse.text(), post, todayISO, checkedAt);
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
    const fromPage = async (url: string, parse: (html: string, day: string, checked: string) => LiveHukamnama) => {
      const response = await fetch(url, { ...fetchOptions(new URL(url).origin + "/"), redirect: "error" });
      if (!response.ok) throw new Error(`${new URL(url).hostname} returned HTTP ${response.status}.`);
      const html = await response.text();
      if (html.length > 2_000_000) throw new Error("Hukamnama source response was too large.");
      return parse(html, todayISO, checkedAt);
    };
    // The two official pages form the SGPC step. No other providers are queried.
    const sources = [
      () => fromPage("https://hs.sgpc.net/index.php", parseSgpcPage),
      () => fromPage("https://sgpc.net/daily-mukhwak-pdf/", parseSgpcDailyMukhwakPage),
      () => loadSikhizmToday(todayISO, checkedAt, refresh),
      () => fromPage(`https://hukamnamasahib.com/hukamnama/${todayISO}-morning`, parseHukamnamaSahib),
      () => fromPage("https://www.dekho-ji.com/hukamnama?t=today", parseDekhoJi),
    ];
    const cache = new Map<number, LiveHukamnama | null>();
    const errors: string[] = [];
    let stale: LiveHukamnama | null = null;
    const read = async (index: number): Promise<LiveHukamnama | null> => {
      if (cache.has(index)) return cache.get(index)!;
      let candidate: LiveHukamnama | null = null;
      try {
        candidate = await sources[index]();
        if (candidate.sourceDateISO !== todayISO) {
          candidate.isToday = false;
          if (candidate.sourceDateISO < todayISO && (!stale || candidate.sourceDateISO > stale.sourceDateISO)) stale = candidate;
        }
        if (!candidate.matchedAuthor) candidate.matchedAuthor = headingAuthor(candidate.original);
        candidate.metadataMatched = !!candidate.matchedAuthor;
      } catch (error) { errors.push(error instanceof Error ? error.message : "Hukamnama source was unavailable."); }
      cache.set(index, candidate);
      return candidate;
    };
    let record: LiveHukamnama | null = null;
    for (let index = 0; index < sources.length; index++) {
      const candidate = await read(index);
      if (!candidate?.isToday || candidate.sourceDateISO !== todayISO) continue;
      record = { ...candidate };
      // Preserve the selected source's verse and calendar. Only supplement missing
      // explanation/author from an exact same-day, same-Ang, full-passage match.
      for (let extra = index + 1; extra < sources.length && (!record.translation || !record.matchedAuthor); extra++) {
        const supplement = await read(extra);
        if (!supplement?.isToday || supplement.sourceDateISO !== todayISO || supplement.ang !== record.ang
          || normalizedVerse(supplement.original) !== normalizedVerse(record.original)) continue;
        let used = false;
        if (!record.translation && supplement.translation) { record.translation = supplement.translation; used = true; }
        if (!record.matchedAuthor && supplement.matchedAuthor) { record.matchedAuthor = supplement.matchedAuthor; used = true; }
        if (used) record.sourceName += ` + matched ${supplement.sourceName}`;
        record.metadataMatched = !!record.matchedAuthor;
      }
      break;
    }
    record ??= stale;
    if (!record) throw new Error(errors.join(" ") || "No current-day Hukamnama is available from the configured sources yet.");
    return NextResponse.json(record, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Could not reach the SGPC live page.",
      checkedAt: new Date().toISOString(),
    }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
