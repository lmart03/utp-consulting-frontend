/** Formato de fechas en la zona de negocio (America/Lima), independiente de la zona del navegador. */
const TIME_ZONE = 'America/Lima';
const LOCALE = 'es-PE';

const timeFormat = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false });
const timeSecondsFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});
const dayFormat = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, day: '2-digit', month: 'short', year: 'numeric' });
const shortDayFormat = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, day: '2-digit', month: 'short' });
const dateKeyFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

function toDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatTime(value?: string | null, withSeconds = false): string {
  const date = toDate(value);
  if (!date) {
    return '';
  }
  return (withSeconds ? timeSecondsFormat : timeFormat).format(date);
}

/** "26 sept 2026" */
export function formatDay(value?: string | null): string {
  const date = toDate(value);
  return date ? dayFormat.format(date).replace('.', '') : '';
}

/** "26 sept 15:00" (tabla de historial). */
export function formatShortDateTime(value?: string | null): string {
  const date = toDate(value);
  if (!date) {
    return '';
  }
  const parts = shortDayFormat.formatToParts(date);
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const month = (parts.find((p) => p.type === 'month')?.value ?? '').replace('.', '');
  return `${day} ${month} ${timeFormat.format(date)}`;
}

/** "15:00 – 16:00" */
export function formatTimeRange(start?: string | null, end?: string | null): string {
  const from = formatTime(start);
  const to = formatTime(end);
  return from && to ? `${from} – ${to}` : from;
}

/** "6.2 s", "850 ms", "1 min 12 s" */
export function formatDuration(ms?: number | null): string {
  if (ms == null || ms < 0) {
    return '';
  }
  if (ms < 1000) {
    return `${ms} ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)} s`;
  }
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ${Math.round(seconds % 60)} s`;
}

/** "hace 3 s", "hace 2 min", "hace 1 h" */
export function formatRelative(from: number | null, now: number): string {
  if (from == null) {
    return '';
  }
  const seconds = Math.max(0, Math.round((now - from) / 1000));
  if (seconds < 60) {
    return `hace ${seconds} s`;
  }
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `hace ${minutes} min` : `hace ${Math.round(minutes / 60)} h`;
}

/** true si la fecha cae en el día de hoy (zona America/Lima). */
export function isToday(value?: string | null, now = Date.now()): boolean {
  const date = toDate(value);
  return !!date && dateKeyFormat.format(date) === dateKeyFormat.format(new Date(now));
}
