/** Keep the canonical source intact; split only for editing and artwork hierarchy. */
export function splitIntroduction(original: string, explicit?: string): { introduction: string; body: string } {
  const source = original.trim();
  if (explicit !== undefined && (!explicit.trim() || source.startsWith(explicit.trim()))) {
    const introduction = explicit.trim();
    return { introduction, body: source.slice(introduction.length).trim() };
  }
  // Recognize the opening heading plus Mool Mantar through its first complete danda.
  // Never consume a numbered stanza or guess a heading boundary when none is clear.
  const opening = source.match(/^([\s\S]*?ੴ\s*[\s\S]*?[॥।]+)\s*/u)?.[1];
  if (!opening) {
    // SGPC also publishes headings such as “ਤਿਲੰਗ ਮਃ ੧ ॥” without a mangal.
    // Only an explicitly labelled, short opening ending at its own danda qualifies.
    const heading = source.match(/^([^॥।]{1,110}[॥।]+)\s*/u)?.[1];
    if (heading && /(?:ਮਹਲਾ|ਮਃ)\s*[੦-੯0-9]+/u.test(heading)
      && !/[(),!?]/u.test(heading) && !/[A-Za-z]/u.test(heading)) {
      return { introduction: heading, body: source.slice(heading.length).trim() };
    }
  }
  if (!opening || !/(?:ਸਤਿਗੁਰ|ਗੁਰ)\s*ਪ੍ਰਸਾਦਿ/u.test(opening) || /[॥।]\s*[੦-੯0-9]+\s*[॥।]/u.test(opening) || !/[\u0A00-\u0A7F]/u.test(opening)) return { introduction: "", body: source };
  return { introduction: opening, body: source.slice(opening.length).trim() };
}

export function joinIntroduction(introduction: string, body: string): string {
  return [introduction.trim(), body.trim()].filter(Boolean).join(" ");
}
