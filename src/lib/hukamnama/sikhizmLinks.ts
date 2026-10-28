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

/** Ang alone is insufficient: require the same Gurbani passage, preserving vowel marks. */
export function matchesSikhizmArticle(html: string, source: Pick<LinkSource, "ang" | "original">): boolean {
  const lines = htmlToLines(html);
  const ang = readSikhizmAng(html);
  if (Number(ang) !== Number(source.ang)) return false;
  const passage = normalized(openingText(source.original)).slice(0, 72);
  return passage.length >= 32 && normalized(lines.join(" ")).includes(passage);
}

export function searchResultArticles(html: string): string[] {
  const headings = [...html.matchAll(/<h[1-6]\b[^>]*class=["'][^"']*\bjeg_post_title\b[^"']*["'][^>]*>([\s\S]*?)<\/h[1-6]>/gi)];
  return [...new Set(headings.flatMap(heading => [...heading[1].matchAll(/href=["']([^"']+)["']/gi)].map(match => match[1].replace(/&amp;/g, "&"))).filter(isSikhizmArticle))].slice(0, 6);
}
const noMatch = (): SikhizmLinks => ({ found: false, articleUrl: "", pdfUrl: "", message: "No verified Sikhizm article matched this Ang and Gurbani. Automatic captions will omit the links; you can add them manually." });

export async function findEvergreenLinks(source: LinkSource, fetcher: typeof fetch = fetch): Promise<SikhizmLinks> {
  const phrase = openingText(source.original).split(/[॥।]/u)[0].trim().split(/\s+/).slice(0, 4).join(" ");
  if (normalized(phrase).length < 8 || normalized(openingText(source.original)).length < 32) return noMatch();
  const read = async (url: string) => {
    const response = await fetcher(url, { headers: { "user-agent": "Sikhizm-Hukamnama-Studio/1.0", accept: "application/json, text/html" }, signal: AbortSignal.timeout(6_000), next: { revalidate: 180 } });
    if (!response.ok) throw new Error(`Sikhizm returned HTTP ${response.status}.`);
    return response;
  };
  const result = (articleUrl: string, html: string, title?: string): SikhizmLinks => ({ found: true, articleUrl, pdfUrl: findSikhizmPdfUrl(html, articleUrl) ?? "", title, message: "Matched Sikhizm article by Ang and Gurbani." });
  // Publication dates are deliberately ignored: these articles are evergreen.
  for (const search of [...new Set([phrase, source.ang])]) {
    try {
      const query = new URLSearchParams({ search, per_page: "12", _fields: "link,title,content" });
      const posts: unknown = await (await read(`https://sikhizm.com/wp-json/wp/v2/posts?${query}`)).json();
      if (!Array.isArray(posts)) continue;
      for (const post of posts) {
        const html = post?.content?.rendered;
        if (typeof post?.link !== "string" || !isSikhizmArticle(post.link) || typeof html !== "string" || !matchesSikhizmArticle(html, source)) continue;
        let resolved = result(post.link, html, htmlToLines(post.title?.rendered ?? "").join(" "));
        if (!resolved.pdfUrl) {
          try {
            const page = await (await read(post.link)).text();
            if (matchesSikhizmArticle(page, source)) resolved = result(post.link, page, resolved.title);
          } catch { /* A verified article remains useful without a PDF. */ }
        }
        return resolved;
      }
    } catch { /* Try the next public search method. */ }
  }
  try {
    const urls = searchResultArticles(await (await read(`https://sikhizm.com/?s=${encodeURIComponent(phrase)}`)).text());
    const candidates = await Promise.allSettled(urls.map(async url => {
      const html = await (await read(url)).text();
      return matchesSikhizmArticle(html, source) ? result(url, html) : null;
    }));
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
