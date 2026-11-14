export const TIME_ZONE = "America/Bogota";
export function dayKey(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
export function formatDate(value: string | Date, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" }) {
  return new Intl.DateTimeFormat("es-CO", { ...options, timeZone: TIME_ZONE }).format(new Date(value));
}
export function formatTime(value: string) {
  return formatDate(value, { hour: "2-digit", minute: "2-digit", hour12: false });
}
export function dayRange(now = new Date()) {
  const key = dayKey(now);
  const start = new Date(`${key}T00:00:00-05:00`);
  return { start: start.toISOString(), end: new Date(start.getTime() + 86400000).toISOString() };
}
export function monthRange(input?: string) {
  const fallback = dayKey(new Date()).slice(0, 7);
  const month = typeof input === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(input) && input >= "2020-01" && input <= "2100-12" ? input : fallback;
  const first = new Date(`${month}-01T00:00:00-05:00`);
  const next = new Date(first); next.setUTCMonth(next.getUTCMonth() + 1);
  const previous = new Date(first); previous.setUTCMonth(previous.getUTCMonth() - 1);
  return { month, start: first.toISOString(), end: next.toISOString(), previous: dayKey(previous).slice(0, 7), next: dayKey(next).slice(0, 7) };
}
