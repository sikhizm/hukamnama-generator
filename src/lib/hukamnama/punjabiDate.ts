/**
 * Punjabi (desi / Nanakshahi-style) date helpers.
 *
 * Converts a Gregorian date into the traditional Punjabi month name +
 * day and the Punjabi weekday name, producing lines like:
 *
 *   🗓️ 10-September-2026 | ਭਾਦੋਂ (Bhadon) 25 | ਵੀਰਵਾਰ (Thursday)
 */

interface DesiMonth {
  pa: string;
  en: string;
  /** [monthIndex0Based, dayOfMonth] the desi month starts on. */
  start: [number, number];
}

const DESI_MONTHS: DesiMonth[] = [
  { pa: "ਚੇਤ", en: "Chet", start: [2, 14] },
  { pa: "ਵੈਸਾਖ", en: "Vaisakh", start: [3, 14] },
  { pa: "ਜੇਠ", en: "Jeth", start: [4, 15] },
  { pa: "ਹਾੜ੍ਹ", en: "Harh", start: [5, 15] },
  { pa: "ਸਾਵਣ", en: "Sawan", start: [6, 16] },
  { pa: "ਭਾਦੋਂ", en: "Bhadon", start: [7, 17] },
  { pa: "ਅੱਸੂ", en: "Assu", start: [8, 15] },
  { pa: "ਕੱਤਕ", en: "Katak", start: [9, 15] },
  { pa: "ਮੱਘਰ", en: "Maghar", start: [10, 14] },
  { pa: "ਪੋਖ", en: "Poh", start: [11, 14] },
  { pa: "ਮਾਘ", en: "Magh", start: [0, 13] },
  { pa: "ਫੱਗਣ", en: "Phagun", start: [1, 12] },
];

const WEEKDAYS_PA = ["ਐਤਵਾਰ", "ਸੋਮਵਾਰ", "ਮੰਗਲਵਾਰ", "ਬੁੱਧਵਾਰ", "ਵੀਰਵਾਰ", "ਸ਼ੁੱਕਰਵਾਰ", "ਸ਼ਨੀਚਰਵਾਰ"];
const WEEKDAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function startDate(m: DesiMonth, year: number): Date {
  return new Date(year, m.start[0], m.start[1]);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Returns the desi month + day-of-month for a Gregorian date. */
export function punjabiMonthDay(date: Date): { pa: string; en: string; day: number } {
  const y = date.getFullYear();
  const dayStart = new Date(y, date.getMonth(), date.getDate());

  // Build the ordered list of desi-month boundaries that cover this date.
  // Chet..Poh start within year y; Magh/Phagun also start in y, but dates
  // before Magh 1 (Jan 13) still belong to Poh of the previous year.
  const inYear = DESI_MONTHS.map((m) => ({ m, start: startDate(m, y) })).sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  );

  let current = inYear[0];
  for (const entry of inYear) {
    if (entry.start.getTime() <= dayStart.getTime()) current = entry;
  }
  if (current.start.getTime() > dayStart.getTime()) {
    // Before the first boundary of this Gregorian year → previous year's Poh.
    const poh = DESI_MONTHS.find((m) => m.pa === "ਪੋਖ")!;
    current = { m: poh, start: startDate(poh, y - 1) };
  }

  const day = Math.floor((dayStart.getTime() - current.start.getTime()) / DAY_MS) + 1;
  return { pa: current.m.pa, en: current.m.en, day };
}

/** Full formatted date line (with the calendar emoji), e.g. for the date row. */
export function formatHukamDate(date: Date): string {
  const p = punjabiMonthDay(date);
  const wd = date.getDay();
  const dd = String(date.getDate()).padStart(2, "0");
  const enMonth = MONTHS_EN[date.getMonth()];
  const yyyy = date.getFullYear();
  return `🗓️ ${dd}-${enMonth}-${yyyy} | ${p.pa} (${p.en}) ${p.day} | ${WEEKDAYS_PA[wd]} (${WEEKDAYS_EN[wd]})`;
}

export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}
