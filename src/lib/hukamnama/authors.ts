export const AUTHOR_OPTIONS = [
  "Guru Nanak Dev Ji",
  "Guru Angad Dev Ji",
  "Guru Amardas Ji",
  "Guru Ramdas Ji",
  "Guru Arjan Dev Ji",
  "Guru Tegh Bahadur Ji",
  "Bhagat Kabir Ji",
  "Bhagat Namdev Ji",
  "Bhagat Ravidas Ji",
] as const;

const aliases = [
  ["ਗੁਰੂ ਨਾਨਕ ਦੇਵ ਜੀ", "Guru Nanak Ji"],
  ["ਗੁਰੂ ਅੰਗਦ ਦੇਵ ਜੀ", "Guru Angad Ji"],
  ["ਗੁਰੂ ਅਮਰਦਾਸ ਜੀ", "ਗੁਰੂ ਅਮਰ ਦਾਸ ਜੀ", "Guru Amar Das Ji"],
  ["ਗੁਰੂ ਰਾਮਦਾਸ ਜੀ", "ਗੁਰੂ ਰਾਮ ਦਾਸ ਜੀ", "Guru Ram Das Ji"],
  ["ਗੁਰੂ ਅਰਜਨ ਦੇਵ ਜੀ", "ਗੁਰੂ ਅਰਜਨ ਜੀ", "Guru Arjan Ji"],
  ["ਗੁਰੂ ਤੇਗ਼ ਬਹਾਦੁਰ ਜੀ", "ਗੁਰੂ ਤੇਗ ਬਹਾਦਰ ਜੀ", "ਗੁਰੂ ਤੇਗ ਬਹਾਦੁਰ ਜੀ", "Guru Teg Bahadur Ji"],
  ["ਭਗਤ ਕਬੀਰ ਜੀ", "ਕਬੀਰ ਜੀ"],
  ["ਭਗਤ ਨਾਮਦੇਵ ਜੀ", "ਨਾਮਦੇਵ ਜੀ", "Bhagat Naamdev Ji"],
  ["ਭਗਤ ਰਵਿਦਾਸ ਜੀ", "ਰਵਿਦਾਸ ਜੀ", "Bhagat Ravi Das Ji"],
];
const key = (name: string) => name.normalize("NFC").toLowerCase().replace(/^bani\s+/i, "").replace(/[^\p{L}\p{N}]/gu, "");

/** Canonical dropdown name for known authors; preserve unknown names for Custom. */
export function normalizeAuthor(name: string | null | undefined): string {
  const value = name?.trim() ?? "";
  const index = AUTHOR_OPTIONS.findIndex((author, i) => [author, ...aliases[i]].some(alias => key(alias) === key(value)));
  return index >= 0 ? AUTHOR_OPTIONS[index] : value;
}

/** A new live record must never inherit an author from the previous Hukamnama. */
export function liveAuthor(name: string | null): string {
  return normalizeAuthor(name);
}
