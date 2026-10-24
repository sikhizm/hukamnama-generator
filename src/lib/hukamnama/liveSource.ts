export interface LiveHukamnama {
  sourceDateISO: string;
  sourceTime: string;
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
  return author || null;
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

