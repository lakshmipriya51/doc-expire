const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** "2025-06-30" -> Date at UTC midnight. Returns null for invalid input. */
export function parseDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
  if (!match) return null;

  const [, year, month, day] = match.map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const check = new Date(timestamp);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return new Date(timestamp);
}

/** Formats a Date for an <input type="date"> value. */
export function toDateInputValue(date) {
  if (!date) return '';
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  return value.toISOString().slice(0, 10);
}

function pluralise(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Mirrors the server's humanised label so both sides agree. */
export function humaniseRemaining(days) {
  if (days === null || days === undefined) return 'Unknown';
  if (days < 0) return `Expired ${pluralise(Math.abs(days), 'day')} ago`;
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `${pluralise(days, 'day')} left`;
}

/** Short relative phrase for use inside a sentence. */
export function describeRemaining(days) {
  if (days === null || days === undefined) return 'on an unknown date';
  if (days < 0) return `${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} ago`;
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${pluralise(days, 'day')}`;
}

const DATE_FORMAT_OPTIONS = { day: '2-digit', month: 'short', year: 'numeric' };

/** "30 Jun 2025" - unambiguous and locale independent. */
export function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en-GB', { ...DATE_FORMAT_OPTIONS, timeZone: 'UTC' }).format(date);
}

export function formatDateTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en-GB', {
    ...DATE_FORMAT_OPTIONS,
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(date);
}

export function formatFileSize(bytes) {
  if (typeof bytes !== 'number' || Number.isNaN(bytes)) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Days between today and a date, using UTC calendar days. */
export function daysUntil(value) {
  const target = parseDateOnly(value);
  if (!target) return null;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target.getTime() - today) / MS_PER_DAY);
}

export function addDays(days) {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return toDateInputValue(new Date(today + days * MS_PER_DAY));
}
