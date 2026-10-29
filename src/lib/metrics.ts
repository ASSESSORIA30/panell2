import type { Contract, DateBasis, EstadoKey, Filters, ISODate, Settings } from "./types";
import { addDays, addMonths, daysBetween, endOfMonth, monthKey, startOfMonth, startOfWeek, todayISO } from "./dates";
import { keyText } from "./normalize";

export const DATE_BASIS_LABEL: Record<DateBasis, string> = {
  fTramitacion: "Fecha de tramitación",
  fActivacion: "Fecha de activación",
  fTraspaso: "Fecha de traspaso",
  fBaja: "Fecha de baja",
};

export const getDate = (c: Contract, basis: DateBasis): ISODate | null => c[basis];

export const clientKeyOf = (c: Contract) => c.cifNorm ?? `N:${keyText(c.nombre)}`;

export function referenceDate(contracts: Contract[], settings: Settings): ISODate {
  if (settings.referenceDate === "hoy" || !contracts.length) return todayISO();
  let max = "";
  for (const c of contracts) {
    for (const d of [c.fTramitacion, c.fActivacion, c.fTraspaso, c.fBaja]) if (d && d > max) max = d;
  }
  return max || todayISO();
}

export function hasDateFilter(f: Filters) {
  return !!(f.dateFrom || f.dateTo || f.years.length || f.months.length);
}

/** Aplica filtros globales. `skip` permite calcular facetas sin el propio filtro. */
export function applyFilters(contracts: Contract[], f: Filters, basis: DateBasis, skip?: keyof Filters | "date"): Contract[] {
  const dateOn = skip !== "date" && hasDateFilter(f);
  const set = <T,>(a: T[]) => (a.length ? new Set(a) : null);
  const com = skip === "comercializadoras" ? null : set(f.comercializadoras);
  const tip = skip === "tipos" ? null : set(f.tipos);
  const tar = skip === "tarifas" ? null : set(f.tarifas);
  const est = skip === "estados" ? null : set(f.estados);
  const own = skip === "owners" ? null : set(f.owners);
  const pro = skip === "provincias" ? null : set(f.provincias);
  const mun = skip === "municipios" ? null : set(f.municipios);
  const yrs = skip === "years" ? null : set(f.years);
  const mos = skip === "months" ? null : set(f.months);
  return contracts.filter((c) => {
    if (com && !com.has(c.comercializadora)) return false;
    if (tip && !tip.has(c.tipo)) return false;
    if (tar && !tar.has(c.tarifa)) return false;
    if (est && !est.has(c.estado)) return false;
    if (own && !c.owners.some((o) => own.has(o))) return false;
    if (pro && !pro.has(c.provincia ?? "Sin provincia")) return false;
    if (mun && !mun.has(c.poblacion ?? "Sin población")) return false;
    if (dateOn) {
      const d = c[basis];
      if (!d) return false;
      if (f.dateFrom && d < f.dateFrom) return false;
      if (f.dateTo && d > f.dateTo) return false;
      if (yrs && !yrs.has(+d.slice(0, 4))) return false;
      if (mos && !mos.has(+d.slice(5, 7))) return false;
    }
    return true;
  });
}

export function commissionOf(c: Contract, mode: Settings["commissionMode"]): number | null {
  const v = c.comisionVenta, s = c.comisionSubdominio;
  if (mode === "venta") return v;
  if (mode === "subdominio") return s;
  if (mode === "none") return null;
  if (v === null && s === null) return null;
  return (v ?? 0) + (s ?? 0);
}

export const hasCommission = (c: Contract) => c.comisionVenta !== null || c.comisionSubdominio !== null;

export function sum<T>(arr: T[], fn: (x: T) => number | null | undefined): number {
  let s = 0;
  for (const x of arr) {
    const v = fn(x);
    if (v !== null && v !== undefined && isFinite(v)) s += v;
  }
  return s;
}

export function countBy<T>(arr: T[], fn: (x: T) => string | string[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of arr) {
    const ks = fn(x);
    for (const k of Array.isArray(ks) ? ks : [ks]) {
      const a = m.get(k);
      if (a) a.push(x);
      else m.set(k, [x]);
    }
  }
  return m;
}

export function ranked<T>(m: Map<string, T[]>): { key: string; items: T[]; n: number }[] {
  return [...m.entries()].map(([key, items]) => ({ key, items, n: items.length })).sort((a, b) => b.n - a.n);
}

/** Ventana actual de comparación según filtros; por defecto, el mes en curso hasta hoy. */
export function currentWindow(f: Filters, ref: ISODate): { from: ISODate; to: ISODate; label: string; explicit: boolean } {
  if (f.dateFrom || f.dateTo) {
    const from = f.dateFrom ?? "1990-01-01";
    const to = f.dateTo ?? ref;
    return { from, to, label: "período seleccionado", explicit: true };
  }
  if (f.years.length === 1 && !f.months.length) {
    const y = f.years[0];
    return { from: `${y}-01-01`, to: `${y}-12-31` < ref ? `${y}-12-31` : ref, label: `año ${y}`, explicit: true };
  }
  if (f.years.length === 1 && f.months.length === 1) {
    const s = `${f.years[0]}-${String(f.months[0]).padStart(2, "0")}-01`;
    const e = endOfMonth(s);
    return { from: s, to: e < ref ? e : ref, label: "mes seleccionado", explicit: true };
  }
  return { from: startOfMonth(ref), to: ref, label: "mes en curso", explicit: false };
}

export function previousWindow(w: { from: ISODate; to: ISODate }) {
  const len = daysBetween(w.from, w.to);
  // si la ventana es un mes natural (o parte), comparar con el mismo tramo del mes anterior
  if (w.from.slice(8) === "01" && len < 31) {
    const from = addMonths(w.from, -1);
    return { from, to: addMonths(w.to, -1) };
  }
  return { from: addDays(w.from, -len - 1), to: addDays(w.from, -1) };
}
export const yearAgoWindow = (w: { from: ISODate; to: ISODate }) => ({ from: addMonths(w.from, -12), to: addMonths(w.to, -12) });

export const inWindow = (d: ISODate | null, w: { from: ISODate; to: ISODate }) => !!d && d >= w.from && d <= w.to;

export function growth(cur: number, prev: number): number | null {
  if (!prev) return cur ? null : 0;
  return ((cur - prev) / prev) * 100;
}

export const PENDING_STATES: EstadoKey[] = ["pendiente", "pendiente_activacion"];
export const CLOSED_STATES: EstadoKey[] = ["baja", "anulado"];

export interface Kpis {
  total: number;
  nuevosMes: number;
  hoy: number;
  semana: number;
  activados: number;
  conFechaActivacion: number;
  pendientes: number;
  firmados: number;
  tramitados: number;
  comisionados: number;
  anulados: number;
  bajas: number;
  conFechaBaja: number;
  clientes: number;
  cups: number;
  consumoLuz: number;
  consumoGas: number;
  consumoLuzN: number;
  consumoGasN: number;
  comVenta: number;
  comSub: number;
  comTotal: number | null;
  sinComision: number;
  sinFecha: number;
}

export function computeKpis(rows: Contract[], ref: ISODate, settings: Settings): Kpis {
  const basis = settings.dateBasis;
  const mStart = startOfMonth(ref);
  const wStart = startOfWeek(ref);
  const by = (e: EstadoKey | EstadoKey[]) => {
    const s = Array.isArray(e) ? e : [e];
    return rows.filter((c) => s.includes(c.estado)).length;
  };
  const luz = rows.filter((c) => c.tipo === "luz" && c.consumo !== null);
  const gas = rows.filter((c) => c.tipo === "gas" && c.consumo !== null);
  const factor = settings.consumoUnit === "kWh" ? 1 / 1000 : 1; // a MWh
  return {
    total: rows.length,
    nuevosMes: rows.filter((c) => { const d = c[basis]; return !!d && d >= mStart && d <= ref; }).length,
    hoy: rows.filter((c) => c[basis] === ref).length,
    semana: rows.filter((c) => { const d = c[basis]; return !!d && d >= wStart && d <= ref; }).length,
    activados: by("activado"),
    conFechaActivacion: rows.filter((c) => c.fActivacion).length,
    pendientes: by(PENDING_STATES),
    firmados: by("firmado"),
    tramitados: by("tramitado"),
    comisionados: by("comisionado"),
    anulados: by("anulado"),
    bajas: by("baja"),
    conFechaBaja: rows.filter((c) => c.fBaja).length,
    clientes: new Set(rows.map(clientKeyOf)).size,
    cups: new Set(rows.map((c) => c.cups).filter(Boolean)).size,
    consumoLuz: sum(luz, (c) => c.consumo) * factor,
    consumoGas: sum(gas, (c) => c.consumo) * factor,
    consumoLuzN: luz.length,
    consumoGasN: gas.length,
    comVenta: sum(rows, (c) => c.comisionVenta),
    comSub: sum(rows, (c) => c.comisionSubdominio),
    comTotal: settings.commissionMode === "none" ? null : sum(rows, (c) => commissionOf(c, settings.commissionMode)),
    sinComision: rows.filter((c) => !hasCommission(c)).length,
    sinFecha: rows.filter((c) => !c[basis]).length,
  };
}

/** Serie mensual de un campo fecha */
export function monthlySeries(rows: Contract[], field: DateBasis, months: string[]): number[] {
  const m = new Map<string, number>();
  for (const c of rows) {
    const d = c[field];
    if (d) m.set(monthKey(d), (m.get(monthKey(d)) ?? 0) + 1);
  }
  return months.map((k) => m.get(k) ?? 0);
}

export function dateExtent(rows: Contract[], field: DateBasis): { min: ISODate; max: ISODate } | null {
  let min = "", max = "";
  for (const c of rows) {
    const d = c[field];
    if (!d) continue;
    if (!min || d < min) min = d;
    if (!max || d > max) max = d;
  }
  return min ? { min, max } : null;
}

export function ownerLabel(email: string, settings: Settings) {
  return settings.owners[email]?.name || email;
}
export function ownerCategory(email: string, settings: Settings) {
  if (settings.owners[email]?.category) return settings.owners[email].category;
  return "sin_clasificar" as const;
}
export const OWNER_CATEGORY_LABEL = {
  interno: "Comercial interno",
  colaborador: "Colaborador externo",
  administrativa: "Cuenta administrativa",
  sin_clasificar: "Sin clasificar",
} as const;

/** Edad (días) de un contrato desde su tramitación, o desde el traspaso si no tiene tramitación */
export function ageDays(c: Contract, ref: ISODate): { days: number; from: "tramitación" | "traspaso" } | null {
  if (c.fTramitacion) return { days: daysBetween(c.fTramitacion, ref), from: "tramitación" };
  if (c.fTraspaso) return { days: daysBetween(c.fTraspaso, ref), from: "traspaso" };
  return null;
}
