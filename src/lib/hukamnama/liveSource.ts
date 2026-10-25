import { normalizeAuthor } from "./authors";

export interface LiveHukamnama {
  sourceDateISO: string;
  sourceTime: string;
  sourceName: string;
  isToday: boolean;
  checkedAt: string;
  dateText: string;
  original: string;
  translation: string;
  ang: string;
  matchedAuthor: string | null;
  metadataMatched: boolean;
}

function normalizeGurbani(value: string): string {
  return value.normalize("NFC").replace(/[^\p{L}\p{N}]/gu, "");
}

/** Accept GurbaniNow metadata only when its Gregorian date, Ang and opening Gurbani agree with SGPC. */
export function matchGurbaniNowMetadata(payload: unknown, sgpc: Pick<LiveHukamnama, "sourceDateISO" | "ang" | "original">): string | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as {
    date?: { gregorian?: { year?: number; monthno?: number; date?: number } };
    hukamnamainfo?: { pageno?: number; writer?: { unicode?: string } };
    hukamnama?: Array<{ line?: { gurmukhi?: { unicode?: string } } }>;
  };
  const gregorian = root.date?.gregorian;
  const info = root.hukamnamainfo;
  const sourceDate = gregorian?.year && gregorian.monthno && gregorian.date
    ? `${gregorian.year}-${String(gregorian.monthno).padStart(2, "0")}-${String(gregorian.date).padStart(2, "0")}`
    : "";
  if (sourceDate !== sgpc.sourceDateISO || Number(info?.pageno) !== Number(sgpc.ang)) return null;

  const mangal = sgpc.original.match(/ੴ\s*ਸਤਿਗੁਰ\s*ਪ੍ਰਸਾਦਿ\s*॥/u);
  if (!mangal || !Array.isArray(root.hukamnama)) return null;
  const sourceOpening = normalizeGurbani(sgpc.original.slice((mangal.index ?? 0) + mangal[0].length)).slice(0, 36);
  const apiText = normalizeGurbani(root.hukamnama.map((item) => item.line?.gurmukhi?.unicode ?? "").join(" "));
  if (sourceOpening.length < 24 || !apiText.includes(sourceOpening)) return null;

  const author = info?.writer?.unicode?.trim();
  return normalizeAuthor(author) || null;
}

const PUNJABI_WEEKDAYS = ["ਐਤਵਾਰ", "ਸੋਮਵਾਰ", "ਮੰਗਲਵਾਰ", "ਬੁੱਧਵਾਰ", "ਵੀਰਵਾਰ", "ਸ਼ੁੱਕਰਵਾਰ", "ਸ਼ੁੱਕਰਵਾਰ", "ਸ਼ਨਿਚਰਵਾਰ", "ਸ਼ਨਿਚਰਵਾਰ"];
const PUNJABI_MONTHS: Record<string, string> = {
  "ਚੇਤ": "Chet", "ਵੈਸਾਖ": "Vaisakh", "ਜੇਠ": "Jeth", "ਹਾੜ": "Harh",
  "ਸਾਵਣ": "Sawan", "ਭਾਦੋਂ": "Bhadon", "ਅੱਸੂ": "Assu", "ਕੱਤਕ": "Katak",
  "ਮੱਘਰ": "Maghar", "ਪੋਹ": "Poh", "ਮਾਘ": "Magh", "ਫੱਗਣ": "Phagun",
};
const GURMUKHI_DIGITS: Record<string, string> = {
  "੦": "0", "੧": "1", "੨": "2", "੩": "3", "੪": "4", "੫": "5", "੬": "6", "੭": "7", "੮": "8", "੯": "9",
};
function decodeEntities(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|rsquo|lsquo|ldquo|rdquo|ndash|mdash);/gi, (entity, code: string) => {
    const named: Record<string, string> = {
      amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘",
      ldquo: "“", rdquo: "”", ndash: "–", mdash: "—",
    };
    const lower = code.toLowerCase();
    if (lower.startsWith("#x")) return String.fromCodePoint(parseInt(lower.slice(2), 16));
    if (lower.startsWith("#")) return String.fromCodePoint(parseInt(lower.slice(1), 10));
    return named[lower] ?? entity;
  });
}

export function htmlToLines(html: string): string[] {
  return decodeEntities(html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<br\b[^>]*>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6]|tr|td|section|article|header|footer|blockquote|main)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function datePartsFromSource(lines: string[], sourceDateISO: string): string {
  const punjabiDate = lines.find((line) => PUNJABI_WEEKDAYS.some((weekday) => line.includes(weekday)) && /ਸੰਮਤ|ਨਾਨਕਸ਼ਾਹੀ|ਨਾਨਕਸ਼ਾਹੀ/.test(line));
  const englishDate = lines.find((line) => /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),?\s+\d{1,2}(?:st|nd|rd|th)?\s+/i.test(line) && /Katak|Chet|Vaisakh|Jeth|Harh|Sawan|Bhadon|Assu|Maghar|Poh|Magh|Phagun/i.test(line));
  if (!punjabiDate || !englishDate) return "";

  const monthPa = Object.keys(PUNJABI_MONTHS).find((month) => punjabiDate.includes(month));
  const englishMatch = englishDate.match(/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),?\s+(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)/i);
  const dayPa = punjabiDate.match(/[੦-੯0-9]+(?=\s*(?:ਚੇਤ|ਵੈਸਾਖ|ਜੇਠ|ਹਾੜ|ਸਾਵਣ|ਭਾਦੋਂ|ਅੱਸੂ|ਕੱਤਕ|ਮੱਘਰ|ਪੋਹ|ਮਾਘ|ਫੱਗਣ))/u)?.[0];
  const weekdayPa = PUNJABI_WEEKDAYS.find((weekday) => punjabiDate.includes(weekday));
  if (!monthPa || !englishMatch || !dayPa || !weekdayPa) return "";

  const [year, month, day] = sourceDateISO.split("-");
  const dayNumber = dayPa.replace(/[੦-੯]/g, (digit) => GURMUKHI_DIGITS[digit] ?? digit).padStart(2, "0");
  const gregorianMonth = new Date(`${sourceDateISO}T00:00:00.000Z`).toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  return `${Number(day)}-${gregorianMonth}-${year} | ${monthPa} (${PUNJABI_MONTHS[monthPa]}) ${dayNumber} | ${weekdayPa} (${englishMatch[1]})`;
}

export function parseSgpcPage(html: string, todayISO: string, checkedAt = new Date().toISOString()): LiveHukamnama {
  const lines = htmlToLines(html);
  const stampIndex = lines.findIndex((line) => /\b\d{1,2}[-/]\d{1,2}[-/]\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM)\b/i.test(line));
  if (stampIndex < 0) throw new Error("SGPC page did not contain its Hukamnama release timestamp.");
  const stamp = lines[stampIndex].match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})\s+(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
  if (!stamp) throw new Error("Could not read the SGPC release date and time.");
  const sourceDateISO = `${stamp[3]}-${stamp[2].padStart(2, "0")}-${stamp[1].padStart(2, "0")}`;

  const punjabiHeading = lines.findIndex((line) => line.includes("ਪੰਜਾਬੀ ਵਿਆਖਿਆ") || line.includes("ਪੰਜਾਬੀ ਅਨੁਵਾਦ"));
  const englishHeading = lines.findIndex((line, index) => index > punjabiHeading && /English Translation/i.test(line));
  if (punjabiHeading < 0 || englishHeading < 0) throw new Error("SGPC page did not contain both the Punjabi and English section markers.");

  const ikIndex = lines.findIndex((line, index) => index < punjabiHeading && line.includes("ੴ"));
  if (ikIndex < 0) throw new Error("Could not locate the Gurmukhi Hukamnama text on the SGPC page.");
  let start = ikIndex;
  const possibleTitle = lines[ikIndex - 1];
  if (possibleTitle && !/Hukamnama Audio|Katha Audio|\d{1,2}[-/]\d{1,2}[-/]\d{4}/i.test(possibleTitle)) start -= 1;

  const angIndex = lines.findIndex((line, index) => index > ikIndex && index < punjabiHeading && /(?:ਅੰਗ|\bAng)\s*[:：]/i.test(line));
  const calendarIndex = lines.findIndex((line, index) => index > ikIndex && index < punjabiHeading
    && PUNJABI_WEEKDAYS.some((weekday) => line.includes(weekday)) && /ਸੰਮਤ|ਨਾਨਕਸ਼ਾਹੀ|ਨਾਨਕਸ਼ਾਹੀ/.test(line));
  const originalEnd = Math.min(...[angIndex, calendarIndex, punjabiHeading].filter((index) => index >= 0));
  const original = lines.slice(start, originalEnd).filter((line) => !/Hukamnama Audio|Katha Audio/i.test(line)).join(" ").trim();
  const translation = lines.slice(punjabiHeading + 1, englishHeading)
    .filter((line) => !/(?:ਅੰਗ|\bAng)\s*[:：]/i.test(line))
    .join(" ").trim();
  const angLine = angIndex >= 0 ? lines[angIndex] : "";
  const angRaw = angLine.match(/(?:ਅੰਗ|\bAng)\s*[:：]\s*([੦-੯0-9]+)/i)?.[1] ?? "";
  const ang = angRaw.replace(/[੦-੯]/g, (digit) => GURMUKHI_DIGITS[digit] ?? digit);
  const dateText = datePartsFromSource(lines, sourceDateISO);

  if (!original || !translation || !ang) throw new Error("SGPC page is missing Gurbani, Punjabi translation, or Ang data.");
  return {
    sourceDateISO,
    sourceTime: stamp[4].replace(/\s+/g, " ").toUpperCase(),
    sourceName: "SGPC Sachkhand live page",
    isToday: sourceDateISO === todayISO,
    checkedAt,
    dateText: dateText || sourceDateISO,
    original,
    translation,
    ang,
    matchedAuthor: null,
    metadataMatched: false,
  };
}

const GREGORIAN_PUNJABI_MONTHS: Record<string, string> = {
  "ਜਨਵਰੀ": "01", "ਫਰਵਰੀ": "02", "ਮਾਰਚ": "03", "ਅਪ੍ਰੈਲ": "04", "ਮਈ": "05", "ਜੂਨ": "06",
  "ਜੁਲਾਈ": "07", "ਅਗਸਤ": "08", "ਸਤੰਬਰ": "09", "ਅਕਤੂਬਰ": "10", "ਨਵੰਬਰ": "11", "ਦਸੰਬਰ": "12",
};

/** SGPC's public Daily Mukhwak page is an official fallback when hs.sgpc.net blocks server requests. */
export function parseSgpcDailyMukhwakPage(html: string, todayISO: string, checkedAt = new Date().toISOString()): LiveHukamnama {
  const lines = htmlToLines(html);
  const headingIndex = lines.findIndex((line) => line.includes("ਮੁੱਖਵਾਕ - ਸੱਚਖੰਡ ਸ੍ਰੀ ਹਰਿਮੰਦਰ ਸਾਹਿਬ"));
  if (headingIndex < 0) throw new Error("SGPC Daily Mukhwak page did not contain its daily Hukamnama heading.");
  const dateIndex = lines.findIndex((line, index) => index > headingIndex && /ਅੰਗ\s*[:：]/u.test(line)
    && /ਸੰਮਤ|ਨਾਨਕਸ਼ਾਹੀ|ਨਾਨਕਸ਼ਾਹੀ/u.test(line));
  if (dateIndex < 0) throw new Error("SGPC Daily Mukhwak page did not contain its date and Ang.");

  const dateLine = lines[dateIndex];
  const dateDigits = (value: string) => value.replace(/[੦-੯]/g, (digit) => GURMUKHI_DIGITS[digit] ?? digit);
  const gregorian = dateLine.match(new RegExp(`([੦-੯0-9]{1,2})\\s*(${Object.keys(GREGORIAN_PUNJABI_MONTHS).join("|")})[, ]+([੦-੯0-9]{4})`, "u"));
  const angRaw = dateLine.match(/ਅੰਗ\s*[:：]\s*([੦-੯0-9]+)/u)?.[1] ?? "";
  if (!gregorian || !angRaw) throw new Error("Could not read the Gregorian date or Ang from SGPC Daily Mukhwak.");
  const day = dateDigits(gregorian[1]).padStart(2, "0");
  const sourceDateISO = `${dateDigits(gregorian[3])}-${GREGORIAN_PUNJABI_MONTHS[gregorian[2]]}-${day}`;

  const title = lines[headingIndex + 1] ?? "";
  const mangal = lines.slice(headingIndex + 1, dateIndex).findIndex((line) => line.includes("ੴ"));
  if (mangal < 0) throw new Error("Could not locate the Mool Mantar in SGPC Daily Mukhwak.");
  const original = lines.slice(headingIndex + 1, dateIndex).join(" ").trim();
  const nanakshahiMonth = Object.keys(PUNJABI_MONTHS).find((month) => dateLine.includes(month));
  const nanakshahiDay = dateLine.match(/[੦-੯0-9]+(?=\s*(?:ਚੇਤ|ਵੈਸਾਖ|ਜੇਠ|ਹਾੜ|ਸਾਵਣ|ਭਾਦੋਂ|ਅੱਸੂ|ਕੱਤਕ|ਮੱਘਰ|ਪੋਹ|ਮਾਘ|ਫੱਗਣ))/u)?.[0];
  const weekdayPa = PUNJABI_WEEKDAYS.find((weekday) => dateLine.includes(weekday));
  const weekdayEn = new Date(`${sourceDateISO}T00:00:00.000Z`).toLocaleString("en-US", { weekday: "long", timeZone: "UTC" });
  const gregorianMonth = new Date(`${sourceDateISO}T00:00:00.000Z`).toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  const dateText = nanakshahiMonth && nanakshahiDay && weekdayPa
    ? `${Number(day)}-${gregorianMonth}-${dateDigits(gregorian[3])} | ${nanakshahiMonth} (${PUNJABI_MONTHS[nanakshahiMonth]}) ${dateDigits(nanakshahiDay).padStart(2, "0")} | ${weekdayPa} (${weekdayEn})`
    : sourceDateISO;

  if (!title || !original) throw new Error("SGPC Daily Mukhwak page is missing the Hukamnama text.");
  return {
    sourceDateISO,
    sourceTime: "",
    sourceName: "SGPC Daily Mukhwak page",
    isToday: sourceDateISO === todayISO,
    checkedAt,
    dateText,
    original,
    translation: "",
    ang: dateDigits(angRaw),
    matchedAuthor: null,
    metadataMatched: false,
  };
}

export interface SikhizmFeedPost {
  title: string;
  link: string;
  publishedAt: string;
  localDateISO: string;
  content: string;
}

function xmlValue(xml: string, tag: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = xml.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}\\s*>`, "i"));
  if (!match) return "";
  return match[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1").trim();
}

export function parseSikhizmFeed(xml: string): SikhizmFeedPost[] {
  const items = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item\s*>/gi)];
  return items.map((item) => {
    const content = xmlValue(item[1], "content:encoded") || xmlValue(item[1], "description");
    const publishedAt = xmlValue(item[1], "pubDate");
    const date = new Date(publishedAt);
    const localDateISO = Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(date);
    return {
      title: decodeEntities(xmlValue(item[1], "title")),
      link: decodeEntities(xmlValue(item[1], "link")),
      publishedAt,
      localDateISO,
      content,
    };
  }).filter((post) => post.title && post.link && post.localDateISO);
}

export function findSikhizmPdfUrl(html: string, articleUrl: string): string | null {
  const anchors = [...html.matchAll(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a\s*>/gi)];
  const candidates = anchors.map((anchor) => {
    const href = decodeEntities(anchor[2]);
    const label = htmlToLines(anchor[3]).join(" ");
    try {
      const url = new URL(href, articleUrl);
      if (url.hostname !== "sikhizm.com" && url.hostname !== "www.sikhizm.com") return null;
      return { url: url.toString(), label, path: url.pathname.toLowerCase() };
    } catch {
      return null;
    }
  }).filter((candidate): candidate is { url: string; label: string; path: string } => !!candidate);

  const preferred = candidates.find((candidate) => /\/download\//.test(candidate.path)
    && /pdf|download|ਹੁਕਮਨਾਮ/i.test(candidate.label));
  const directPdf = candidates.find((candidate) => candidate.path.endsWith(".pdf"));
  const anyDownload = candidates.find((candidate) => /\/download\//.test(candidate.path));
  return preferred?.url ?? directPdf?.url ?? anyDownload?.url ?? null;
}

/** Read only explicitly marked Gurbani blocks, including nested shortcode markup. */
function sikhizmGurbaniBlocks(html: string): string[] {
  const clean = html.replace(/<!--[\s\S]*?-->|<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ");
  const blocks: string[] = [];
  const openings = /<(p|div|blockquote)\b[^>]*\bclass\s*=\s*(["'])(.*?)\2[^>]*>/gi;
  for (const opening of clean.matchAll(openings)) {
    if (!opening[3].split(/\s+/).some(name => /^(?:Bani|su-box-content|gurbani-text)$/i.test(name))) continue;
    const start = (opening.index ?? 0) + opening[0].length;
    const tags = new RegExp(`<\\/?${opening[1]}\\b[^>]*>`, "gi");
    tags.lastIndex = start;
    let depth = 1, tag: RegExpExecArray | null;
    while ((tag = tags.exec(clean))) {
      if (tag[0].startsWith("</")) depth -= 1;
      else if (!tag[0].endsWith("/>")) depth += 1;
      if (depth === 0) { blocks.push(clean.slice(start, tag.index)); break; }
    }
  }
  return blocks;
}

/** Return Sikhizm's Punjabi explanation only when Ang and Gurbani opening agree. */
export function parseSikhizmPunjabiTranslation(html: string, expectedOriginal: string, expectedAng: string): string | null {
  const lines = htmlToLines(html);
  const angMatches = lines.some((line, index) => /^ang$/i.test(line) && lines[index + 1]?.trim() === expectedAng)
    || lines.some((line) => new RegExp(`\\bAng\\s*${expectedAng}\\b`, "i").test(line));
  if (!angMatches) return null;

  const mangal = expectedOriginal.match(/ੴ\s*ਸਤਿਗੁਰ\s*ਪ੍ਰਸਾਦਿ\s*॥/u);
  if (!mangal) return null;
  const sourceOpening = normalizeGurbani(expectedOriginal.slice((mangal.index ?? 0) + mangal[0].length)).slice(0, 36);
  const articleText = normalizeGurbani(lines.join(" "));
  if (sourceOpening.length < 24 || !articleText.includes(sourceOpening)) return null;

  const headings = [...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi)];
  const heading = headings.filter(item => /^(?:\d+\.\s*)?Punjabi Translation(?: by Prof\.? Sahib Singh Ji)?$/i.test(htmlToLines(item[2]).join(" "))).at(-1);
  if (!heading) return null;
  const start = (heading.index ?? 0) + heading[0].length;
  const nextHeading = headings.find(item => (item.index ?? 0) >= start)?.index ?? html.length;
  const section = html.slice(start, nextHeading);
  const translationLines: string[] = [];
  for (const line of htmlToLines(section)) {
    if (/^(?:ਸ਼ਬਦ ਦਾ ਭਾਵ:|ਸ਼ਬਦ ਦਾ ਭਾਵ:|Tags:|Previous Post|Related Entries|\d+\. )/u.test(line)) break;
    if (/[\u0A00-\u0A7F]/u.test(line)) translationLines.push(line);
  }
  const translation = translationLines.join(" ").trim();
  return translation || null;
}

/** Use today's Sikhizm post as a last-resort source when both official SGPC pages block server requests. */
export function parseSikhizmLiveArticle(
  html: string,
  post: Pick<SikhizmFeedPost, "publishedAt" | "localDateISO">,
  todayISO: string,
  checkedAt = new Date().toISOString(),
): LiveHukamnama {
  const metaTags = [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => match[0]);
  const publishedTag = metaTags.find((tag) => /property\s*=\s*(["'])article:published_time\1/i.test(tag));
  const publishedAt = publishedTag?.match(/content\s*=\s*(["'])(.*?)\1/i)?.[2] ?? post.publishedAt;
  const publishedDate = new Date(publishedAt);
  const articleDateISO = Number.isNaN(publishedDate.getTime()) ? "" : new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(publishedDate);
  if (!articleDateISO || articleDateISO !== post.localDateISO || articleDateISO !== todayISO) {
    throw new Error("The Sikhizm Hukamnama post is not confirmed for today.");
  }

  const candidates = sikhizmGurbaniBlocks(html).map(block => htmlToLines(block).join(" ").trim());
  const original = candidates.find(text => text.includes("ੴ") && /ਸਤਿਗੁਰ\s*ਪ੍ਰਸਾਦਿ/u.test(text) && /[॥।]\s*[੦-੯0-9]+(?:\s*[॥।]\s*[੦-੯0-9]+)*\s*[॥।]\s*$/u.test(text)) ?? "";
  if (!original) {
    throw new Error("Could not locate the complete Gurmukhi Hukamnama in today's Sikhizm post.");
  }

  const lines = htmlToLines(html);
  const angIndex = lines.findIndex((line) => /^Ang$/i.test(line) || /^ਅੰਗ$/u.test(line));
  const angRaw = angIndex >= 0 ? lines[angIndex + 1]?.match(/^([੦-੯0-9]+)/u)?.[1] ?? "" : "";
  const ang = angRaw.replace(/[੦-੯]/g, (digit) => GURMUKHI_DIGITS[digit] ?? digit);
  if (!ang) throw new Error("Could not locate the Ang in today's Sikhizm post.");

  // Read only the labelled Creator cell of this already date-validated article.
  const creatorRows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)];
  const creators = creatorRows.flatMap(row => {
    const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]\s*>/gi)];
    return cells.length === 2 && /^(?:Creator|Author|ਬਾਣੀਕਾਰ)$/iu.test(htmlToLines(cells[0][1]).join(" "))
      ? [normalizeAuthor(htmlToLines(cells[1][1]).join(" "))] : [];
  }).filter(Boolean);
  const matchedAuthor = new Set(creators).size === 1 ? creators[0] : null;

  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "long" }).format(publishedDate);
  const month = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", month: "long" }).format(publishedDate);
  const day = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", day: "numeric" }).format(publishedDate);
  const year = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", year: "numeric" }).format(publishedDate);
  const translation = parseSikhizmPunjabiTranslation(html, original, ang) ?? "";

  return {
    sourceDateISO: articleDateISO,
    sourceTime: "",
    sourceName: "Sikhizm same-day Hukamnama post",
    isToday: true,
    checkedAt,
    // Sikhizm's article does not publish the Nanakshahi date in a machine-readable field.
    // Give the verified Gregorian date only; do not calculate an authoritative-looking lunar date.
    dateText: `${Number(day)}-${month}-${year} | ${weekday}`,
    original,
    translation,
    ang,
    matchedAuthor,
    metadataMatched: Boolean(matchedAuthor),
  };
}
