const MONTHS = [
  ["ਚੇਤ", "Chet"], ["ਵੈਸਾਖ", "Vaisakh"], ["ਜੇਠ", "Jeth"], ["ਹਾੜ", "Harh"],
  ["ਸਾਵਣ", "Sawan"], ["ਭਾਦੋਂ", "Bhadon"], ["ਅੱਸੂ", "Assu"], ["ਕੱਤਕ", "Katak"],
  ["ਮੱਘਰ", "Maghar"], ["ਪੋਹ", "Poh"], ["ਮਾਘ", "Magh"], ["ਫੱਗਣ", "Phagun"],
];
const WEEKDAYS = ["ਐਤਵਾਰ", "ਸੋਮਵਾਰ", "ਮੰਗਲਵਾਰ", "ਬੁੱਧਵਾਰ", "ਵੀਰਵਾਰ", "ਸ਼ੁੱਕਰਵਾਰ", "ਸ਼ਨਿਚਰਵਾਰ"];
const numberText = (text: string) => text.replace(/[੦-੯]/gu, digit => String("੦੧੨੩੪੫੬੭੮੯".indexOf(digit)));
const normalize = (text: string) => text.normalize("NFC").replace(/ਸ਼/gu, "ਸ਼");

/** Format only a published SGPC calendar line; never calculate a Nanakshahi day. */
export function formatSgpcCalendarDate(text: string, sourceDateISO: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sourceDateISO)) return null;
  const date = new Date(`${sourceDateISO}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== sourceDateISO) return null;
  const value = numberText(normalize(text));
  const stamp = value.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/);
  if (stamp && `${stamp[3]}-${stamp[2].padStart(2, "0")}-${stamp[1].padStart(2, "0")}` !== sourceDateISO) return null;
  const pa = value.match(new RegExp(`(${WEEKDAYS.join("|")}|ਸ਼ਨੀਵਾਰ)[,،]?\\s+(\\d{1,2})\\s+(${MONTHS.map(month => month[0]).join("|")})\\s*\\(\\s*ਸੰਮਤ\\s+(\\d{3,4})\\s+ਨਾਨਕਸ਼ਾਹੀ\\s*\\)`, "u"));
  const en = value.match(/\b(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),?\s+(\d{1,2})(?:st|nd|rd|th)?\s+(Chet|Vaisakh|Jeth|Harh|Sawan|Bhadon|Assu|Katak|Maghar|Poh|Magh|Phagun)\s*\(\s*Samvat\s+(\d{3,4})\s+Nanakshahi\s*\)/i);
  if (!pa && !en) return null;
  const month = pa ? MONTHS.find(item => item[0] === pa[3]) : MONTHS.find(item => item[1].toLowerCase() === en![3].toLowerCase());
  const day = Number(pa?.[2] ?? en?.[2]);
  const year = Number(pa?.[4] ?? en?.[4]);
  if (!month || day < 1 || day > 32 || year < 1) return null;
  const weekdayEn = date.toLocaleString("en-US", { weekday: "long", timeZone: "UTC" });
  const weekdayPa = WEEKDAYS[date.getUTCDay()];
  if (pa && pa[1] !== weekdayPa && !(date.getUTCDay() === 6 && pa[1] === "ਸ਼ਨੀਵਾਰ")) return null;
  if (en && (en[1].toLowerCase() !== weekdayEn.toLowerCase() || Number(en[2]) !== day || en[3].toLowerCase() !== month[1].toLowerCase() || Number(en[4]) !== year)) return null;
  const gregorianMonth = date.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  return `${date.getUTCDate()}-${gregorianMonth}-${date.getUTCFullYear()} | ${month[0]} ${String(day).padStart(2, "0")}, ${year} | ${weekdayPa} (${weekdayEn})`;
}
