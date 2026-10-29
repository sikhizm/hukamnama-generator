import { NextResponse } from "next/server";
import { fetchArticleResource, readLimited } from "@/lib/publisher/importArticle";
import { parseSikhizmArticleContent, type LiveHukamnama } from "@/lib/hukamnama/liveSource";
import { lookupPunjabiTranslation } from "@/lib/hukamnama/translationLookup";
import { headingAuthor } from "@/lib/hukamnama/fallbackSources";
import { publishedSgpcDate } from "@/lib/hukamnama/sgpcCalendar";
import { indiaClock } from "@/lib/morningPlan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Authenticated by /api/hukamnama/:path* in proxy.ts. Editor import only. */
export async function POST(request: Request) {
  const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
  try {
    if (Number(request.headers.get("content-length")) > 5000) return reply({ error: "Request too large." }, 413);
    const body = await request.json();
    if (!body || typeof body.url !== "string" || !body.url.trim() || body.url.length > 2048
      || (body.translation !== undefined && typeof body.translation !== "boolean")) return reply({ error: "Paste a public Sikhizm post URL." }, 400);
    // Shared importer validates the allowlisted HTTPS host before each redirect,
    // limits redirects and timeouts, and never sends WordPress credentials.
    const { response, url } = await fetchArticleResource(body.url.trim());
    if (response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "text/html") {
      await response.body?.cancel();
      throw new Error("Use a public Sikhizm article page, not an image or download.");
    }
    const content = parseSikhizmArticleContent(new TextDecoder().decode(await readLimited(response, 2_000_000)));
    const day = indiaClock().day;
    const date = new Date(`${day}T12:00:00Z`);
    const record: LiveHukamnama = {
      ...content,
      sourceDateISO: day, // Editor date, explicitly unverified below.
      dateText: publishedSgpcDate(day) ?? `${Number(day.slice(8))}-${date.toLocaleString("en-US", { month: "long", timeZone: "UTC" })}-${day.slice(0, 4)} | ${date.toLocaleString("en-US", { weekday: "long", timeZone: "UTC" })}`,
      sourceTime: "", sourceName: "Sikhizm manual URL selection",
      manualUrl: url, isToday: false, checkedAt: new Date().toISOString(),
    };
    record.matchedAuthor ??= headingAuthor(record.original);
    record.metadataMatched = !!record.matchedAuthor;
    if (!record.translation && body.translation !== false) {
      try {
        const meaning = await lookupPunjabiTranslation(record);
        if (meaning) { record.translation = meaning; record.sourceName += " + matched BaniDB Punjabi translation"; }
      } catch { /* Preserve the original and allow manual translation entry. */ }
    }
    return reply(record);
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "Could not import this Sikhizm post." }, 400);
  }
}
