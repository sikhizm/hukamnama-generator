import { findSikhizmPdfUrl, htmlToLines, readSikhizmAng } from "./liveSource";

export interface LinkSource { date: string; ang: string; original: string }
export interface SikhizmLinks { found: boolean; articleUrl: string; pdfUrl: string; title?: string; message: string }
const normalized = (value: string) => value.normalize("NFC").replace(/[^\p{L}\p{M}\p{N}]/gu, "");

export function openingText(original: string): string {
  const mangal = original.match(/ੴ\s*ਸਤਿਗੁਰ\s*ਪ੍ਰਸਾਦਿ\s*[॥।]+/u);
  return (mangal ? original.slice((mangal.index ?? 0) + mangal[0].length) : original).trim();
}
export function linkContext(source: Pick<LinkSource, "ang" | "original"> & { dateISO: string }): string {
  return JSON.stringify([source.dateISO, source.ang, normalized(openingText(source.original)).slice(0, 96)]);
}
export function isSikhizmArticle(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["sikhizm.com", "www.sikhizm.com"].includes(url.hostname) && !url.username && !url.password && !url.port && !url.search && url.pathname !== "/" && !/^\/(?:wp-|category\/|tag\/|author\/|page\/|feed\/|download\/)/i.test(url.pathname) && !/\.(?:pdf|png|jpe?g|webp|mp3)$/i.test(url.pathname);
  } catch { return false; }
}

/** Match the passage with its Ang, allowing harmless layout/markup differences. */
export function matchesSikhizmArticle(html: string, source: Pick<LinkSource, "ang" | "original">): boolean {
  const lines = htmlToLines(html);
  const ang = readSikhizmAng(html);
  if (Number(ang) !== Number(source.ang)) return false;
  const passage = normalized(openingText(source.original)).slice(0, 48);
  return passage.length >= 32 && normalized(lines.join(" ")).includes(passage);
}

export function searchResultArticles(html: string): string[] {
  const headings = [...html.matchAll(/<h[1-6]\b[^>]*class=["'][^"']*\bjeg_post_title\b[^"']*["'][^>]*>([\s\S]*?)<\/h[1-6]>/gi)];
  return [...new Set(headings.flatMap(heading => [...heading[1].matchAll(/href=["']([^"']+)["']/gi)].map(match => match[1].replace(/&amp;/g, "&"))).filter(isSikhizmArticle))].slice(0, 20);
}
const noMatch = (): SikhizmLinks => ({ found: false, articleUrl: "", pdfUrl: "", message: "No verified Sikhizm article matched this Ang and Gurbani. Automatic captions will omit the links; you can add them manually." });

export async function findEvergreenLinks(source: LinkSource, fetcher: typeof fetch = fetch): Promise<SikhizmLinks> {
  const words = openingText(source.original).split(/[॥।]/u)[0].trim().split(/\s+/).filter(Boolean);
  const queries = [...new Set([
    words.slice(0, 4).join(" "),
    words.slice(0, 3).join(" "),
    words.slice(0, 2).join(" "),
    openingText(source.original).split(/[॥।]/u)[0].trim(),
    source.ang,
  ].filter(value => normalized(value).length >= 4))];
  if (normalized(openingText(source.original)).length < 32 || !queries.length) return noMatch();

  const read = async (url: string) => {
    const response = await fetcher(url, { headers: { "user-agent": "Sikhizm-Hukamnama-Studio/1.0", accept: "application/json, text/html" }, signal: AbortSignal.timeout(8_000), next: { revalidate: 180 } });
    if (!response.ok) throw new Error(`Sikhizm returned HTTP ${response.status}.`);
    return response;
  };
  const result = (articleUrl: string, html: string, title?: string): SikhizmLinks => ({
    found: true, articleUrl, pdfUrl: findSikhizmPdfUrl(html, articleUrl) ?? "", title,
    message: "Matched Sikhizm article by Ang and Gurbani.",
  });
  const checked = new Set<string>();
  const verifyPage = async (url: string, title?: string): Promise<SikhizmLinks | null> => {
    if (!isSikhizmArticle(url) || checked.has(url)) return null;
    checked.add(url);
    try {
      const html = await (await read(url)).text();
      return matchesSikhizmArticle(html, source) ? result(url, html, title) : null;
    } catch { return null; }
  };

  // Search several progressively broader Gurbani phrases. Search results are
  // candidates only: every final URL is verified against Ang + the passage.
  for (const search of queries) {
    try {
      const query = new URLSearchParams({ search, per_page: "50", page: "1", _fields: "link,title,content" });
      const posts: unknown = await (await read(`https://sikhizm.com/wp-json/wp/v2/posts?${query}`)).json();
      if (!Array.isArray(posts)) continue;
      for (const post of posts) {
        if (typeof post?.link !== "string" || !isSikhizmArticle(post.link)) continue;
        const title = htmlToLines(post.title?.rendered ?? "").join(" ");
        const rendered = typeof post.content?.rendered === "string" ? post.content.rendered : "";
        if (rendered && matchesSikhizmArticle(rendered, source)) {
          const found = result(post.link, rendered, title);
          // The REST content can omit download controls; inspect the page when
          // it has no PDF, without sacrificing a verified article URL.
          if (!found.pdfUrl) {
            const fullPage = await verifyPage(post.link, title);
            if (fullPage) return fullPage;
          }
          return found;
        }
        // Some WP responses expose trimmed/filtered content. Verify the
        // actual article page before rejecting an otherwise relevant result.
        const fullPage = await verifyPage(post.link, title);
        if (fullPage) return fullPage;
      }
    } catch { /* Continue with broader query and public HTML search. */ }
  }

  // Public theme search is independent of the REST API and remains a fallback.
  try {
    const urls = searchResultArticles(await (await read(`https://sikhizm.com/?s=${encodeURIComponent(queries[0])}`)).text());
    const candidates = await Promise.allSettled(urls.map(url => verifyPage(url)));
    for (const candidate of candidates) if (candidate.status === "fulfilled" && candidate.value) return candidate.value;
  } catch { /* Missing links must never reuse the previous Hukamnama's URLs. */ }
  return noMatch();
}

export async function requestEvergreenLinks(source: LinkSource, signal?: AbortSignal): Promise<SikhizmLinks> {
  const response = await fetch("/api/hukamnama/sikhizm-links", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(source), cache: "no-store", signal });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Could not search Sikhizm articles.");
  return result;
}
