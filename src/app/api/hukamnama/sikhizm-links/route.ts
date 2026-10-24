import { NextResponse } from "next/server";
import { findSikhizmPdfUrl, parseSikhizmFeed } from "@/lib/hukamnama/liveSource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FEED_URL = "https://sikhizm.com/category/hukamnama/feed/";

function isSikhizmUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["sikhizm.com", "www.sikhizm.com"].includes(url.hostname);
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const expectedDate = new URL(request.url).searchParams.get("date") ?? "";
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(expectedDate)) {
    return NextResponse.json({ error: "A verified Hukamnama date is required." }, { status: 400 });
  }

  try {
    const feedResponse = await fetch(FEED_URL, {
      headers: { "user-agent": "Sikhizm-Hukamnama-Studio/1.0", accept: "application/rss+xml, application/xml, text/xml" },
      signal: AbortSignal.timeout(12_000),
      next: { revalidate: 180 },
    });
    if (!feedResponse.ok) throw new Error(`Sikhizm RSS returned HTTP ${feedResponse.status}.`);
    const feed = parseSikhizmFeed(await feedResponse.text());
    const latestPost = feed[0] ?? null;
    const todayPost = feed.find((post) => post.localDateISO === expectedDate);
    if (!todayPost || !isSikhizmUrl(todayPost.link)) {
      return NextResponse.json({
        found: false,
        expectedDate,
        latestDateISO: latestPost?.localDateISO ?? null,
        latestTitle: latestPost?.title ?? null,
        message: "No Hukamnama post dated today was found in Sikhizm's public RSS feed. Existing links were left unchanged.",
      }, { headers: { "Cache-Control": "no-store" } });
    }

    let pdfUrl = findSikhizmPdfUrl(todayPost.content, todayPost.link);
    if (!pdfUrl) {
      const postResponse = await fetch(todayPost.link, {
        headers: { "user-agent": "Sikhizm-Hukamnama-Studio/1.0", accept: "text/html" },
        signal: AbortSignal.timeout(12_000),
        next: { revalidate: 180 },
      });
      if (postResponse.ok) pdfUrl = findSikhizmPdfUrl(await postResponse.text(), todayPost.link);
    }

    return NextResponse.json({
      found: true,
      expectedDate,
      articleUrl: todayPost.link,
      pdfUrl,
      title: todayPost.title,
      message: pdfUrl
        ? "Today's article and PDF link were found."
        : "Today's article was found, but its PDF button link was not. The existing PDF URL was left unchanged.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Could not read Sikhizm's public Hukamnama feed.",
    }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
