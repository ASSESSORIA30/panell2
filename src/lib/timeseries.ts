import type { Contract, DateBasis, ISODate } from "./types";
import { addDays, addMonths, dayRange, fmtDate, fmtMonth, monthKey, monthRange, startOfWeek, MONTHS_ES } from "./dates";

export type Gran = "day" | "week" | "month" | "year";

export function bucketOf(d: ISODate, g: Gran): string {
  if (g === "day") return d;
  if (g === "week") return startOfWeek(d);
  if (g === "month") return monthKey(d);
  return d.slice(0, 4);
}

export function bucketKeys(from: ISODate, to: ISODate, g: Gran): string[] {
  if (g === "day") return dayRange(from, to);
  if (g === "week") {
    const out: string[] = [];
    for (let w = startOfWeek(from); w <= to; w = addDays(w, 7)) out.push(w);
    return out;
  }
  if (g === "month") return monthRange(from, to);
  const out: string[] = [];
  for (let y = +from.slice(0, 4); y <= +to.slice(0, 4); y++) out.push(String(y));
  return out;
}

export function bucketLabel(k: string, g: Gran): string {
  if (g === "day") return `${+k.slice(8, 10)} ${MONTHS_ES[+k.slice(5, 7) - 1]}`;
  if (g === "week") return `sem. ${fmtDate(k).slice(0, 5)}`;
  if (g === "month") return fmtMonth(k);
  return k;
}

export interface Buckets {
  keys: string[];
  labels: string[];
  counts: number[];
  ids: string[][];
}

export function buildBuckets(rows: Contract[], field: DateBasis, g: Gran, from: ISODate, to: ISODate, value?: (c: Contract) => number | null): Buckets {
  const keys = bucketKeys(from, to, g);
  const idx = new Map(keys.map((k, i) => [k, i]));
  const counts = keys.map(() => 0);
  const ids: string[][] = keys.map(() => []);
  for (const c of rows) {
    const d = c[field];
    if (!d || d < from || d > to) continue;
    const i = idx.get(bucketOf(d, g));
    if (i === undefined) continue;
    const v = value ? value(c) : 1;
    if (v === null) continue;
    counts[i] += v;
    ids[i].push(c.id);
  }
  return { keys, labels: keys.map((k) => bucketLabel(k, g)), counts, ids };
}

/** Desplaza un rango N meses (para comparación interanual) */
export const shiftRange = (from: ISODate, to: ISODate, months: number) => ({ from: addMonths(from, months), to: addMonths(to, months) });

export function autoGran(from: ISODate, to: ISODate): Gran {
  const days = (new Date(to).getTime() - new Date(from).getTime()) / 86400000;
  if (days <= 45) return "day";
  if (days <= 200) return "week";
  return "month";
}

export const bucketRange = (k: string, g: Gran): { from: ISODate; to: ISODate } => {
  if (g === "day") return { from: k, to: k };
  if (g === "week") return { from: k, to: addDays(k, 6) };
  if (g === "month") {
    const from = `${k}-01`;
    return { from, to: addDays(addMonths(from, 1), -1) };
  }
  return { from: `${k}-01-01`, to: `${k}-12-31` };
};
