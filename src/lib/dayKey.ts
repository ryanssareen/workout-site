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
