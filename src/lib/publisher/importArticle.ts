const HOSTS = new Set(["sikhizm.com", "www.sikhizm.com"]);
export function articleUrl(value: string, base?: string): URL {
  const url = new URL(value, base);
  if (url.protocol !== "https:" || !HOSTS.has(url.hostname) || url.port || url.username || url.password || /\/(?:wp-admin|wp-login\.php|wp-json)(?:\/|$)/i.test(url.pathname)) throw new Error("Use a public HTTPS article URL from sikhizm.com.");
  url.hash = "";
  return url;
}
export function plainText(value: string): string {
  return value.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]*>/g, " ").replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp|rsquo|lsquo|ndash|mdash|hellip);/gi, (whole, code: string) => {
    if (code[0] === "#") { const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1)); return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ""; }
    return ({ amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", rsquo: "’", lsquo: "‘", ndash: "–", mdash: "—", hellip: "…" } as Record<string, string>)[code.toLowerCase()] ?? whole;
  }).replace(/\s+/g, " ").trim();
}
export function parseArticle(html: string, source: string) {
  const metadata = new Map<string, string>();
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = new Map<string, string>();
    for (const attr of tag[0].matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)) attrs.set(attr[1].toLowerCase(), attr[3]);
    const key = attrs.get("property") ?? attrs.get("name");
    if (key && attrs.get("content")) metadata.set(key.toLowerCase(), plainText(attrs.get("content")!));
  }
  const title = metadata.get("og:title") ?? plainText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  if (!title) throw new Error("This page did not return a readable article title. Enter the post manually.");
  let imageUrl = "";
  try { const raw = metadata.get("og:image") ?? metadata.get("twitter:image"); if (raw) imageUrl = articleUrl(raw, source).toString(); } catch { /* External images are not proxied. */ }
  return { title: title.slice(0, 500), caption: (metadata.get("og:description") ?? metadata.get("description") ?? "").slice(0, 5000), url: source, imageUrl };
}
export async function readLimited(response: Response, limit: number): Promise<Uint8Array> {
  if (Number(response.headers.get("content-length")) > limit) throw new Error("The source file is too large to import.");
  const reader = response.body?.getReader(); if (!reader) throw new Error("The source returned an empty response.");
  const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) throw new Error("The source file is too large to import."); chunks.push(value); } }
  finally { await reader.cancel(); }
  const result = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; } return result;
}
export async function fetchArticleResource(value: string, request: typeof fetch = fetch): Promise<{ response: Response; url: string }> {
  let url = articleUrl(value);
  for (let i = 0; i < 4; i++) {
    const response = await request(url, { redirect: "manual", headers: { "User-Agent": "Sikhizm-Social-Publisher/2.0", Accept: "text/html,image/jpeg,image/png,image/webp" }, signal: AbortSignal.timeout(12000), cache: "no-store" });
    if ([301, 302, 303, 307, 308].includes(response.status)) { await response.body?.cancel(); url = articleUrl(response.headers.get("location") ?? "", url.toString()); continue; }
    if (!response.ok) { await response.body?.cancel(); throw new Error("Sikhizm could not return this public page. You can still create the draft manually."); }
    return { response, url: url.toString() };
  }
  throw new Error("This article redirected too many times.");
}
