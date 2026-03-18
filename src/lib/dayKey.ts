const UTC_FALLBACK = 'UTC';

export function normalizeTimezone(timezone?: string | null): string {
  if (!timezone) return UTC_FALLBACK;
  try {
    // Throws on invalid IANA timezone names.
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return UTC_FALLBACK;
  }
}

/**
 * Parse a local-time ISO string (no timezone suffix) into a proper UTC Date.
 * Strava's `start_date_local` is local time but has no offset — on a UTC
 * server `new Date(str)` misinterprets it as UTC, shifting the date.
 */
export function parseLocalDate(localDateStr: string, timezone: string): Date {
  const match = localDateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return new Date(localDateStr);

  const [, y, mo, d, h, mi, s] = match.map(Number);
  const naiveUtc = new Date(Date.UTC(y, mo - 1, d, h, mi, s));

  const utcStr = naiveUtc.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = naiveUtc.toLocaleString('en-US', { timeZone: timezone });
  const offsetMs = new Date(tzStr).getTime() - new Date(utcStr).getTime();

  return new Date(naiveUtc.getTime() - offsetMs);
}

export function getDayKey(input: Date | string | number, timezone?: string | null): string {
  const date = input instanceof Date ? input : new Date(input);
  const tz = normalizeTimezone(timezone);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}
