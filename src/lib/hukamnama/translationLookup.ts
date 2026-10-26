import { normalizedVerse } from "./fallbackSources";
import type { LiveHukamnama } from "./liveSource";

// These published spellings of the same word encode the subjoined h differently.
// Keep every other consonant and vowel mark significant, and never rewrite source text.
const translationMatchKey = (value: string) => normalizedVerse(value.replace(/ਤੁਮ੍ਹ(?:੍ਹ)?ਾਰੇ/gu, "ਤੁਮੑਾਰੇ"));

type Verse = { verse?: { unicode?: string }; translation?: { pu?: { ss?: { unicode?: string | null } } }; shabadId?: number };
type Shabad = { shabadInfo?: { pageNo?: number; source?: { sourceId?: string } }; verses?: Verse[] };

/** BaniDB (iGurbani's alliance) supplies meanings only, never the daily date or original. */
export function matchedPunjabiTranslation(data: Shabad, record: LiveHukamnama): string | null {
  if (data.shabadInfo?.source?.sourceId !== "G" || String(data.shabadInfo.pageNo) !== record.ang || !data.verses?.length) return null;
  if (translationMatchKey(data.verses.map(line => line.verse?.unicode ?? "").join(" ")) !== translationMatchKey(record.original)) return null;
  const translated: string[] = [];
  for (const line of data.verses) {
    const original = line.verse?.unicode ?? "";
    let meaning = line.translation?.pu?.ss?.unicode?.trim() ?? "";
    // BaniDB's raag and Mool Mantar rows do not carry Sahib Singh meanings.
    if (!meaning && /ਮਹਲਾ|ਮਃ|ੴ|^(?:ਰਾਗ|ਧਨਾਸਰੀ|ਸੋਰਠਿ|ਸੂਹੀ|ਬਿਲਾਵਲੁ|ਗਉੜੀ|ਆਸਾ|ਸਲੋਕੁ|ਪਉੜੀ)/u.test(original)) continue;
    if (!meaning || !/[\u0A00-\u0A7F]/u.test(meaning)) return null;
    const marker = original.match(/ਰਹਾਉ\s*[॥।]+\s*$|[॥।]\s*[੦-੯0-9]+(?:\s*[॥।]\s*[੦-੯0-9]+)*\s*[॥।]\s*$/u)?.[0];
    if (marker) {
      meaning = meaning.replace(/ਰਹਾਉ\s*[॥।]+\s*$|[॥।]\s*[੦-੯0-9]+(?:\s*[॥।]\s*[੦-੯0-9]+)*\s*[॥।]\s*$/u, "").trim();
      meaning += ` ${marker}`;
    }
    translated.push(meaning);
  }
  return translated.length ? translated.join(" ") : null;
}

export async function lookupPunjabiTranslation(record: LiveHukamnama, request: typeof fetch = fetch): Promise<string | null> {
  if (!/^\d{1,4}$/.test(record.ang) || Number(record.ang) < 1 || Number(record.ang) > 1430) return null;
  const get = async (path: string) => {
    const response = await request(`https://api.banidb.com/v2/${path}`, { signal: AbortSignal.timeout(5_000), next: { revalidate: 86400 } });
    if (!response.ok) throw new Error("Punjabi translation lookup is unavailable.");
    return response.json();
  };
  const page = await get(`angs/${record.ang}/G`);
  if (page.source?.sourceId !== "G" || String(page.source.pageNo) !== record.ang || !Array.isArray(page.page)) return null;
  const source = translationMatchKey(record.original);
  const ids = [...new Set<number>((page.page as Verse[]).filter(line => {
    const text = translationMatchKey(line.verse?.unicode ?? "");
    return text.length > 20 && source.includes(text) && Number.isInteger(line.shabadId);
  }).map(line => line.shabadId!))].slice(0, 3);
  for (const id of ids) {
    const translation = matchedPunjabiTranslation(await get(`shabads/${id}`), record);
    if (translation) return translation;
  }
  return null;
}
