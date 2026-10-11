export function localDateParameters(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return {
    today: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    timezoneOffsetMinutes: date.getTimezoneOffset(),
  };
}
