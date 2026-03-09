import { format } from 'date-fns';

const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/**
 * Format a Date in the specified timezone.
 *
 * Uses Intl.DateTimeFormat to convert the UTC date into the target timezone,
 * then passes the result to date-fns `format()` so all existing format strings
 * (e.g. 'MMMM d, yyyy', 'h:mm a') continue to work identically.
 */
export function formatInTimezone(
  date: Date,
  formatStr: string,
  timezone?: string | null,
): string {
  const tz = timezone || DEFAULT_TIMEZONE;
  // Convert the UTC instant into the wall-clock time for the target timezone.
  // `toLocaleString` with a timeZone option returns the localized string;
  // re-parsing it gives us a Date whose UTC fields match the wall-clock time.
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: tz }));
  return format(tzDate, formatStr);
}

/** Get just the time string, e.g. "6:00 AM" */
export function formatTime(date: Date, timezone?: string | null): string {
  return formatInTimezone(date, 'h:mm a', timezone);
}

/** Get date + time, e.g. "March 9, 2024 at 6:00 AM" */
export function formatDateTime(date: Date, timezone?: string | null): string {
  return formatInTimezone(date, "MMMM d, yyyy 'at' h:mm a", timezone);
}

/** Get short date, e.g. "Mar 9" */
export function formatShortDate(date: Date, timezone?: string | null): string {
  return formatInTimezone(date, 'MMM d', timezone);
}
