export function formatUtcDateOnly(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export function formatGoogleExceptionDate(
  date: Date,
  isAllDay: boolean,
): string {
  const datePart = formatUtcDateOnly(date).replaceAll('-', '');
  if (isAllDay) return `EXDATE;VALUE=DATE:${datePart}`;

  const timePart = [
    String(date.getUTCHours()).padStart(2, '0'),
    String(date.getUTCMinutes()).padStart(2, '0'),
    String(date.getUTCSeconds()).padStart(2, '0'),
  ].join('');
  return `EXDATE:${datePart}T${timePart}Z`;
}
