export interface HukamnamaExcerpt {
  original: string;
  translation: string;
  shortened: boolean;
  error: string | null;
}

const digits: Record<string, string> = Object.fromEntries([..."੦੧੨੩੪੫੬੭੮੯"].map((digit, i) => [digit, String(i)]));
const count = (text: string) => [...text].length;

/** Keep complete marker groups (including ॥੨॥੧॥), never split a verse or a grapheme. */
function endings(text: string, isTranslation = false) {
  // A numbered pause (॥੧॥ ਰਹਾਉ ॥) is one semantic unit, not stanza 1
  // followed by a second, unnumbered pause. Preserve compound final counts.
  const pattern = isTranslation
    ? /(?:[॥।]\s*[੦-੯0-9]+\s*[॥।]\s*)?(?:ਰਹਾਉ|ਠਹਿਰਾਉ)\s*[॥।]+|[॥।]\s*[੦-੯0-9]+(?:\s*[॥।]\s*[੦-੯0-9]+)*\s*[॥।]+/gu
    : /(?:[॥।]\s*[੦-੯0-9]+\s*[॥।]\s*)?ਰਹਾਉ\s*[॥।]+|[॥।]\s*[੦-੯0-9]+(?:\s*[॥।]\s*[੦-੯0-9]+)*\s*[॥।]+/gu;
  return [...text.matchAll(pattern)].map(match => {
    const end = match.index + match[0].length;
    const key = /ਰਹਾਉ|ਠਹਿਰਾਉ/u.test(match[0]) ? "rahau" : (match[0].match(/[੦-੯0-9]+/gu) ?? []).map(number => number.replace(/[੦-੯]/gu, digit => digits[digit])).join("/");
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
  // A complete rahau takes priority even beyond the usual 250-character budget.
  const rahau = markers.find(marker => marker.key === "rahau" && (marker.length > 200
    || (firstOne >= 0 && firstOne < markers.indexOf(marker))));
  const numbered = safe.filter(marker => marker.key !== "rahau");
  const preferred = numbered.filter(marker => marker.length >= 220 && marker.length <= 230);
  const nearest = (items: typeof markers) => [...items].sort((a, b) => Math.abs(a.length - 225) - Math.abs(b.length - 225) || b.length - a.length)[0];
  const chosen = rahau ?? nearest(preferred) ?? nearest(numbered) ?? markers.find(marker => marker.key === "rahau") ?? markers[0];
  if (!chosen) return { ...full, error: "No complete numbered verse or ਰਹਾਉ ending was found. The full text remains editable; prepare a complete excerpt before exporting." };

  // Match the complete marker sequence, so a repeated ੧ or a final ੩।੧।੨੯। cannot pick the wrong stanza.
  const prefix = markers.slice(0, markers.indexOf(chosen) + 1);
  const translated = endings(translation, true);
  const selectedTranslation = translated.slice(0, prefix.length);
  const sameOrder = prefix.every((marker, i) => selectedTranslation[i]?.key === marker.key);
  // Explanations may put rahau first. Only move that one unit: all numbered
  // stanzas must retain their exact order and the selected units must be equal.
  const keys = (items: typeof markers) => items.filter(marker => marker.key !== "rahau").map(marker => marker.key).join(",");
  const rahauFirst = prefix.filter(marker => marker.key === "rahau").length === 1
    && selectedTranslation.filter(marker => marker.key === "rahau").length === 1
    && selectedTranslation[0]?.key === "rahau"
    && selectedTranslation.length === prefix.length && keys(prefix) === keys(selectedTranslation);
  // Some Punjabi explanations omit all stanza numbers but clearly mark the
  // pause. When the original ends at that pause, retain its complete leading
  // explanation. Never use this fallback over conflicting numbered markers.
  if (!sameOrder && !rahauFirst && chosen.key === "rahau" && translated[0]?.key === "rahau"
    && translated.length === 1) {
    return { original: source.slice(0, chosen.end), translation: translation.slice(0, translated[0].end).trim(), shortened: true, error: null };
  }
  if (!sameOrder && !rahauFirst) {
    return { ...full, error: "The Punjabi translation has no matching stanza markers for this excerpt. Add the corresponding marked translation before exporting." };
  }
  const translationEnd = translated[prefix.length - 1].end;
  let excerptTranslation = translation.slice(0, translationEnd).trim();
  if (!sameOrder && rahauFirst) {
    // Move whole, verified sections into Gurbani order; retain their wording
    // and original pause spelling. Numbered explanations remain in order.
    const sections = selectedTranslation.map((marker, i) => ({
      text: translation.slice(i ? selectedTranslation[i - 1].end : 0, marker.end).trim(),
    }));
    const pause = sections[0];
    const numberedSections = sections.slice(1);
    excerptTranslation = prefix.map(marker => marker.key === "rahau" ? pause.text : numberedSections.shift()!.text).join(" ");
  }
  return { original: source.slice(0, chosen.end), translation: excerptTranslation, shortened: true, error: null };
}
