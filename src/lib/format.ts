const TZ = 'Europe/Sofia';

const dayMonth = new Intl.DateTimeFormat('bg-BG', {
  day: 'numeric', month: 'long', timeZone: TZ,
});
const dayMonthYear = new Intl.DateTimeFormat('bg-BG', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ,
});
const weekday = new Intl.DateTimeFormat('bg-BG', { weekday: 'long', timeZone: TZ });
const time = new Intl.DateTimeFormat('bg-BG', {
  hour: '2-digit', minute: '2-digit', timeZone: TZ,
});
const dayNum = new Intl.DateTimeFormat('bg-BG', { day: 'numeric', timeZone: TZ });
/* Node/ICU renders bg-BG `month:'short'` numerically, so the abbreviations
   are spelled out here to keep the date plaque readable. */
const MONTHS_SHORT = ['яну', 'фев', 'мар', 'апр', 'май', 'юни',
                      'юли', 'авг', 'сеп', 'окт', 'ное', 'дек'];
const monthIndex = new Intl.DateTimeFormat('en-US', { month: 'numeric', timeZone: TZ });

export const fmtDate = (iso: string) => dayMonth.format(new Date(iso));
export const fmtDateFull = (iso: string) => dayMonthYear.format(new Date(iso));
export const fmtWeekday = (iso: string) => weekday.format(new Date(iso));
export const fmtTime = (iso: string) => time.format(new Date(iso));
export const fmtDay = (iso: string) => dayNum.format(new Date(iso));
export const fmtMonth = (iso: string) =>
  MONTHS_SHORT[Number(monthIndex.format(new Date(iso))) - 1];

/** "16 октомври, четвъртък от 19:00 ч." */
export const fmtWhen = (iso: string) =>
  `${fmtDate(iso)}, ${fmtWeekday(iso)} от ${fmtTime(iso)} ч.`;

/** "2 часа" / "2 часа и 30 мин." / "45 мин." */
export function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hoursWord = h === 1 ? '1 час' : `${h} часа`;
  if (h === 0) return `${m} мин.`;
  if (m === 0) return hoursWord;
  return `${hoursWord} и ${m} мин.`;
}

/** Bulgaria is on the euro; prices display as "31 €". */
export const fmtPrice = (cents: number) => {
  const value = cents / 100;
  const shown = Number.isInteger(value) ? value.toString() : value.toFixed(2);
  return `${shown} €`;
};

export const isoDuration = (minutes: number) => `PT${minutes}M`;

export const endsAt = (iso: string, minutes: number) =>
  new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();

export interface Availability {
  left: number;
  full: boolean;
  scarce: boolean;
  label: string;
}

export function availability(capacity: number, taken: number, open: boolean): Availability {
  const left = Math.max(0, capacity - taken);
  const full = left === 0;
  if (!open) return { left, full, scarce: false, label: 'Записването е затворено' };
  if (full) return { left, full, scarce: false, label: 'Местата свършиха' };
  if (left === 1) return { left, full, scarce: true, label: 'Остава последно място' };
  if (left <= 3) return { left, full, scarce: true, label: `Остават само ${left} места` };
  return { left, full, scarce: false, label: `Свободни ${left} места` };
}

/**
 * How far a workshop is from the smallest group she will run it for.
 *
 * Her rule is three people; below that she moves the date. The site used to
 * say nothing about it, which left the first person to book believing a date
 * was certain when it was not - and left her making the awkward phone call.
 *
 * This never stops anybody booking. It only names the state.
 */
export interface Minimum {
  /** How many more people are needed; 0 once the group is together. */
  needed: number;
  reached: boolean;
  /** The whole thing, in her voice - for the workshop page and the booking. */
  note: string;
  /** The same fact in four words, for tight places. */
  short: string;
}

export function minimum(taken: number, min: number): Minimum {
  const needed = Math.max(0, min - taken);
  if (needed === 0) {
    return {
      needed: 0,
      reached: true,
      note: 'Групата е събрана - работилницата се провежда.',
      short: 'Групата е събрана.',
    };
  }
  // With nobody booked yet, „тръгва при 3 записани - остават още 3“ says the
  // same number twice. The first person to look does not need the arithmetic.
  const missing = needed === min ? ''
    : needed === 1 ? ' - остава още един човек'
    : ` - остават още ${needed}`;
  return {
    needed,
    reached: false,
    note: `Работилницата тръгва при ${min} записани${missing}. `
      + 'Ако не се съберем, ще ти се обадя и ще преместим датата.',
    short: `Тръгваме при ${min} записани.`,
  };
}

/* ---------------------------------------------------------------------------
 * Admin form <-> database time conversion.
 *
 * <input type="datetime-local"> has no timezone: it is wall-clock time. She
 * types the hour the workshop starts in Гоце Делчев, so it is interpreted in
 * Europe/Sofia and stored as a proper instant. Getting this wrong would shift
 * every workshop by an hour for half the year.
 * ------------------------------------------------------------------------ */

function zoneOffsetMs(instant: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(instant).map((p) => [p.type, p.value])
  ) as Record<string, string>;

  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour) % 24, Number(parts.minute), Number(parts.second)
  );
  return asUtc - instant.getTime();
}

/** "2026-10-16T19:00" (Sofia wall clock) -> ISO instant. */
export function localInputToIso(value: string): string {
  const [date, time = '00:00'] = value.split('T');
  const [Y, M, D] = date.split('-').map(Number);
  const [h, m] = time.split(':').map(Number);

  const naive = Date.UTC(Y, M - 1, D, h, m);
  // Two passes: the first offset may be the wrong side of a DST switch.
  let utc = naive - zoneOffsetMs(new Date(naive));
  utc = naive - zoneOffsetMs(new Date(utc));
  return new Date(utc).toISOString();
}

/** ISO instant -> "2026-10-16T19:00" for the form field. */
export function isoToLocalInput(iso: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date(iso)).map((p) => [p.type, p.value])
  ) as Record<string, string>;
  return `${parts.year}-${parts.month}-${parts.day}T${String(Number(parts.hour) % 24).padStart(2, '0')}:${parts.minute}`;
}

/** Turns a title into a URL-safe Latin slug. */
export function slugify(input: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i',
    й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's',
    т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sht',
    ъ: 'a', ь: 'y', ю: 'yu', я: 'ya',
  };
  return input
    .toLowerCase()
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
