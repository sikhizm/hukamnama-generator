import { htmlToLines, type LiveHukamnama } from "./liveSource";
import { normalizeAuthor } from "./authors";
import { publishedSgpcDate } from "./sgpcCalendar";

const digits = (value: string) => value.replace(/[੦-੯]/g, char => String("੦੧੨੩੪੫੬੭੮੯".indexOf(char)));
const completeVerse = (value: string) => /ੴ/u.test(value) && /[॥।]\s*[੦-੯0-9]+(?:\s*[॥।]\s*[੦-੯0-9]+)*\s*[॥।]\s*$/u.test(value);
export const normalizedVerse = (value: string) => value.normalize("NFC").replace(/[^\p{L}\p{M}\p{N}]/gu, "");

/** An explicit single Mehl heading identifies its Guru; a mixed-author passage stays unresolved. */
export function headingAuthor(original: string): string | null {
  if (/ਕਬੀਰ|ਨਾਮਦੇਵ|ਰਵਿਦਾਸ|ਫਰੀਦ|ਜੈਦੇਵ|ਤ੍ਰਿਲੋਚਨ|ਬੇਣੀ|ਧੰਨਾ|ਪੀਪਾ|ਸੈਣ/u.test(original)) return null;
  const mehls = [...original.matchAll(/(?:ਮਹਲਾ|ਮਃ)\s*([੦-੯0-9]+)/gu)].map(match => digits(match[1]));
  if (!mehls.length || new Set(mehls).size !== 1) return null;
  const names: Record<string, string> = { "1": "Guru Nanak Dev Ji", "2": "Guru Angad Dev Ji", "3": "Guru Amardas Ji", "4": "Guru Ramdas Ji", "5": "Guru Arjan Dev Ji", "9": "Guru Tegh Bahadur Ji" };
  return names[mehls[0]] ?? null;
}

function classBlock(html: string, className: string): string {
  const opening = [...html.matchAll(/<div\b[^>]*class\s*=\s*(["'])(.*?)\1[^>]*>/gi)].find(match => match[2].split(/\s+/).includes(className));
  if (!opening) throw new Error(`Source is missing its ${className} content section.`);
  const start = opening.index! + opening[0].length;
  const tags = /<\/?div\b[^>]*>/gi; tags.lastIndex = start;
  let depth = 1, tag: RegExpExecArray | null;
  while ((tag = tags.exec(html))) {
    depth += tag[0].startsWith("</") ? -1 : 1;
    if (!depth) return html.slice(start, tag.index);
  }
  throw new Error("Source content section is incomplete.");
}
function sourceRecord(sourceName: string, date: string, today: string, original: string, translation: string, ang: string, checkedAt: string, author: string | null): LiveHukamnama {
  if (date !== today || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`${sourceName} is not dated today.`);
  if (!completeVerse(original) || !/^\d{1,4}$/.test(ang) || Number(ang) < 1 || Number(ang) > 1430) throw new Error(`${sourceName} is missing complete Gurbani or a valid Ang.`);
  return { sourceName, sourceDateISO: date, sourceTime: "", isToday: true, checkedAt, original, translation, ang,
    dateText: publishedSgpcDate(date) ?? date, matchedAuthor: author, metadataMatched: !!author };
}

/** Parse only today's dated morning article, never homepage snippets or the evening post. */
export function parseHukamnamaSahib(html: string, today: string, checkedAt = new Date().toISOString()): LiveHukamnama {
  const expected = `https://hukamnamasahib.com/hukamnama/${today}-morning`;
  const articles = [...html.matchAll(/<script\b[^>]*type\s*=\s*(["'])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi)].flatMap(match => {
    try { const data = JSON.parse(match[2]); return Array.isArray(data) ? data : data["@graph"] ?? [data]; } catch { return []; }
  });
  const article = articles.find(item => item["@type"] === "Article" && item.url === expected);
  if (!article || article.datePublished !== today || !new RegExp(`Amrit.*Date ${today.slice(8)}-${today.slice(5, 7)}-${today.slice(0, 4)} Ang (\\d+)`, "i").test(article.headline ?? "")) throw new Error("HukamnamaSahib article is not confirmed as today's morning Hukamnama.");
  const ang = String(article.headline.match(/\bAng\s+(\d+)\b/i)?.[1] ?? "");
  const content = classBlock(html, "hukamnama-html-content");
  const lines = htmlToLines(content);
  const originals = lines.filter(line => completeVerse(line));
  if (originals.length !== 1) throw new Error("HukamnamaSahib did not contain one unambiguous complete Gurmukhi passage.");
  const original = originals[0];
  // Ignore the truncated schema description, related-post cards and other scripts.
  const paragraphs = [...content.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(match => htmlToLines(match[1]).join(" "));
  const translations = paragraphs.filter(line => line !== original && /[\u0A00-\u0A7F]/u.test(line)
    && !/\p{Script=Devanagari}/u.test(line) && !/(?:https?:|www\.)/i.test(line) && line.length > 80
    && (/^(?:ਅਰਥ|ਅਰਥਾਂ)\s*[:：-]/u.test(line) || /^ਰਾਗ\s/u.test(line) || line.includes("॥੧॥")));
  const translation = translations.join(" ").replace(/^(?:ਅਰਥ|ਅਰਥਾਂ)\s*[:：-]+\s*/u, "").trim();
  return sourceRecord("HukamnamaSahib.com morning Hukamnama", today, today, original, translation, ang, checkedAt, headingAuthor(original));
}

/** Dekho Ji separates each language into l1 (Gurbani), m1 (Punjabi meanings), i1 (metadata). */
export function parseDekhoJi(html: string, today: string, checkedAt = new Date().toISOString()): LiveHukamnama {
  const meta = html.match(/<div\b[^>]*id\s*=\s*(["'])meta1\1[^>]*>([\s\S]*?)<br\s*\/?\s*>\s*<div\b/i)?.[2];
  if (!meta) throw new Error("Dekho Ji is missing its Hukamnama date section.");
  const metaText = htmlToLines(meta).join(" ");
  const stamp = metaText.match(/\b(\d{1,2})-([A-Za-z]{3})-(\d{4})\b/);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = stamp ? months.findIndex(value => value.toLowerCase() === stamp[2].toLowerCase()) + 1 : 0;
  const date = stamp && month ? `${stamp[3]}-${String(month).padStart(2, "0")}-${stamp[1].padStart(2, "0")}` : "";
  const ang = metaText.match(/\bAng\s+(\d+)\b/i)?.[1] ?? "";
  const paragraphs = [...html.matchAll(/<p\b[^>]*class\s*=\s*(["'])(l1|m1|i1)\1[^>]*>([\s\S]*?)<\/p>/gi)];
  const original = paragraphs.filter(match => match[2] === "l1").map(match => htmlToLines(match[3]).join(" ")).join(" ").trim();
  const translation = paragraphs.filter(match => match[2] === "m1").map(match => htmlToLines(match[3]).join(" ")).join(" ").trim();
  const metadata = paragraphs.filter(match => match[2] === "i1").map(match => htmlToLines(match[3]).join(" "));
  if (!metadata.length || metadata.some(line => line.match(/\bAng\s+(\d+)/i)?.[1] !== ang)) throw new Error("Dekho Ji line metadata does not match its stated Ang.");
  const authors = [...new Set(metadata.map(line => normalizeAuthor(line.split(" / ")[0])).filter(Boolean))];
  const author = authors.length === 1 ? authors[0] : null;
  return sourceRecord("Dekho Ji daily Hukamnama", date, today, original, translation, ang, checkedAt, author);
}
