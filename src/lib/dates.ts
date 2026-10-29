export const pad = (n: number) => String(n).padStart(2, "0");
export const toISO = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export const fromISO = (s: string) => new Date(s + "T00:00:00Z");
export const addDays = (s: string, n: number) => {
  const d = fromISO(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
};
export const addMonths = (s: string, n: number) => {
  const d = fromISO(s);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return toISO(d);
};
export const daysBetween = (a: string, b: string) => Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86400000);
export const monthKey = (s: string) => s.slice(0, 7);
export const startOfMonth = (s: string) => s.slice(0, 8) + "01";
export const endOfMonth = (s: string) => {
  const d = fromISO(startOfMonth(s));
  return toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
};
/** Lunes de la semana ISO */
export const startOfWeek = (s: string) => {
  const d = fromISO(s);
  const wd = (d.getUTCDay() + 6) % 7;
  return addDays(s, -wd);
};
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const MONTHS_LONG_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export const fmtDate = (s: string | null) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "—");
export const fmtMonth = (k: string) => `${MONTHS_ES[+k.slice(5, 7) - 1]} ${k.slice(2, 4)}`;
export const fmtMonthLong = (k: string) => `${MONTHS_LONG_ES[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}`;

export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = startOfMonth(from);
  while (cur <= to) {
    out.push(monthKey(cur));
    cur = addMonths(cur, 1);
  }
  return out;
}
export function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let cur = from; cur <= to; cur = addDays(cur, 1)) out.push(cur);
  return out;
}
