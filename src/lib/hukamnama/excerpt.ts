export interface HukamnamaExcerpt {
  original: string;
  translation: string;
  shortened: boolean;
  error: string | null;
}

const digits: Record<string, string> = Object.fromEntries([..."੦੧੨੩੪੫੬੭੮੯"].map((digit, i) => [digit, String(i)]));
const count = (text: string) => [...text].length;

/** Keep complete marker groups (including ॥੨॥੧॥), never split a verse or a grapheme. */
function endings(text: string) {
  // A numbered pause (॥੧॥ ਰਹਾਉ ॥) is one semantic unit, not stanza 1
  // followed by a second, unnumbered pause. Preserve compound final counts.
  return [...text.matchAll(/(?:[॥।]\s*[੦-੯0-9]+\s*[॥।]\s*)?ਰਹਾਉ\s*[॥।]+|[॥।]\s*[੦-੯0-9]+(?:\s*[॥।]\s*[੦-੯0-9]+)*\s*[॥।]+/gu)].map(match => {
    const end = match.index + match[0].length;
    const key = match[0].includes("ਰਹਾਉ") ? "rahau" : (match[0].match(/[੦-੯0-9]+/gu) ?? []).map(number => number.replace(/[੦-੯]/gu, digit => digits[digit])).join("/");
    return { end, length: count(text.slice(0, end)), key };
  });
}

/** Derive media-only excerpts; source text and captions remain complete. */
export function hukamnamaExcerpt(original: string, translation: string): HukamnamaExcerpt {
  const full = { original, translation, shortened: false, error: null };
  if (count(original.trim()) <= 250) return full;
  const source = original.trim();
  const markers = endings(source);
  const safe = markers.filter(marker => marker.length <= 250);
  const firstOne = markers.findIndex(marker => marker.key === "1");
  const rahau = safe.find(marker => marker.key === "rahau" && (marker.length > 200
    || (firstOne >= 0 && firstOne < markers.indexOf(marker))));
  const numbered = safe.filter(marker => marker.key !== "rahau");
  const preferred = numbered.filter(marker => marker.length >= 220 && marker.length <= 230);
  const nearest = (items: typeof markers) => [...items].sort((a, b) => Math.abs(a.length - 225) - Math.abs(b.length - 225) || b.length - a.length)[0];
  const chosen = rahau ?? nearest(preferred) ?? nearest(numbered) ?? nearest(safe);
  if (!chosen) return { ...full, error: "No complete verse or ਰਹਾਉ ending within 250 characters. Prepare a shorter complete excerpt before exporting." };

  // Match the complete marker sequence, so a repeated ੧ or a final ੩।੧।੨੯। cannot pick the wrong stanza.
  const prefix = markers.slice(0, markers.indexOf(chosen) + 1);
  const translated = endings(translation);
  const selectedTranslation = translated.slice(0, prefix.length);
  const sameOrder = prefix.every((marker, i) => selectedTranslation[i]?.key === marker.key);
  // Explanations may put rahau first. Only move that one unit: all numbered
  // stanzas must retain their exact order and the selected units must be equal.
  const keys = (items: typeof markers) => items.filter(marker => marker.key !== "rahau").map(marker => marker.key).join(",");
  const rahauFirst = prefix.filter(marker => marker.key === "rahau").length === 1
    && selectedTranslation.filter(marker => marker.key === "rahau").length === 1
    && selectedTranslation[0]?.key === "rahau"
    && selectedTranslation.length === prefix.length && keys(prefix) === keys(selectedTranslation);
  if (!sameOrder && !rahauFirst) {
    return { ...full, error: "The Punjabi translation has no matching stanza markers for this excerpt. Add the corresponding marked translation before exporting." };
  }
  const translationEnd = translated[prefix.length - 1].end;
  return { original: source.slice(0, chosen.end), translation: translation.slice(0, translationEnd).trim(), shortened: true, error: null };
}
