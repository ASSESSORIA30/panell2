/**
 * Motor de consultas deterministas sobre los datos ya procesados.
 * Traduce preguntas en español a una consulta estructurada (Query) y la ejecuta.
 * Nunca inventa: si algo no puede calcularse, lo dice.
 */
import type { Contract, DateBasis, EstadoKey, ISODate, ProductType, Settings } from "../types";
import { addDays, addMonths, endOfMonth, fmtDate, fmtMonth, monthRange, MONTHS_LONG_ES, startOfMonth, startOfWeek } from "../dates";
import { ageDays, clientKeyOf, commissionOf, countBy, ownerLabel, sum } from "../metrics";
import { ESTADO_LABEL, keyText, TIPO_LABEL } from "../normalize";
import { fmtDec, fmtEur, fmtInt, fmtShare } from "../format";

export type Metric = "contratos" | "clientes" | "consumo" | "comision" | "conversion" | "antiguedad";
export type GroupBy = "comercializadora" | "owner" | "municipio" | "provincia" | "tarifa" | "estado" | "tipo" | "mes" | null;

export interface Query {
  metric: Metric;
  groupBy: GroupBy;
  period: { from: ISODate; to: ISODate; label: string } | null;
  dateField: DateBasis;
  comercializadoras: string[];
  tipos: ProductType[];
  tarifas: string[];
  estados: EstadoKey[];
  provincias: string[];
  minDays?: number;
  top?: boolean;
}

export interface Answer {
  ok: boolean;
  headline: string;
  detail?: string;
  calc: string[];
  filters: string[];
  chart?: { kind: "bar" | "line"; cats: string[]; values: number[]; label: string; fmt: "int" | "eur" | "mwh" | "pct" };
  ids?: string[];
}

export const EXAMPLES = [
  "¿Cuántos contratos hemos conseguido este mes?",
  "¿Qué comercializadora nos ha aportado más contratos?",
  "¿Cuántos MWh hemos gestionado este año?",
  "¿Qué colaborador aporta más volumen?",
  "¿Qué porcentaje de los contratos tramitados se ha activado?",
  "¿Cuánto suman las comisiones registradas este trimestre?",
  "¿Qué municipios concentran más clientes?",
  "¿Qué contratos llevan más de 30 días pendientes?",
  "Altas por mes del año pasado",
  "¿Cuántas bajas ha habido en 2026?",
];

export const CAPABILITIES = [
  "Recuentos de contratos o clientes únicos en un período",
  "Rankings por comercializadora, colaborador, municipio, provincia, tarifa, estado o producto",
  "Consumo en MWh (electricidad y gas por separado)",
  "Comisiones registradas (venta, subdominio y total)",
  "Tasa de activación de contratos tramitados",
  "Contratos pendientes por antigüedad",
  "Evolución mensual",
  "Períodos: hoy, ayer, esta semana, este mes, mes pasado, este trimestre, este año, año pasado, últimos N días o meses, un mes o año concretos, desde/hasta fechas",
];

const has = (q: string, ...w: string[]) => w.some((x) => q.includes(x));

export function parsePeriod(q: string, ref: ISODate): Query["period"] {
  const y = +ref.slice(0, 4);
  const range = (from: ISODate, to: ISODate, label: string) => ({ from, to: to > ref ? ref : to, label });
  let m: RegExpMatchArray | null;
  if ((m = q.match(/desde (?:el )?(\d{1,2})\/(\d{1,2})\/(\d{4})(?: hasta (?:el )?(\d{1,2})\/(\d{1,2})\/(\d{4}))?/))) {
    const p = (d: string, mo: string, yy: string) => `${yy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    const from = p(m[1], m[2], m[3]);
    const to = m[4] ? p(m[4], m[5], m[6]) : ref;
    return range(from, to, `del ${fmtDate(from)} al ${fmtDate(to)}`);
  }
  if ((m = q.match(/ultim[oa]s? (\d+) dias?/))) return range(addDays(ref, -(+m[1] - 1)), ref, `últimos ${m[1]} días`);
  if ((m = q.match(/ultim[oa]s? (\d+) mes(?:es)?/))) return range(addDays(addMonths(ref, -+m[1]), 1), ref, `últimos ${m[1]} meses`);
  if (has(q, "hoy")) return range(ref, ref, "hoy");
  if (has(q, "ayer")) return range(addDays(ref, -1), addDays(ref, -1), "ayer");
  if (has(q, "semana pasada", "semana anterior")) {
    const s = addDays(startOfWeek(ref), -7);
    return range(s, addDays(s, 6), "la semana pasada");
  }
  if (has(q, "esta semana", "semana actual")) return range(startOfWeek(ref), ref, "esta semana");
  if (has(q, "mes pasado", "mes anterior")) {
    const s = startOfMonth(addMonths(ref, -1));
    return range(s, endOfMonth(s), `${MONTHS_LONG_ES[+s.slice(5, 7) - 1]} ${s.slice(0, 4)}`);
  }
  if (has(q, "este mes", "mes actual", "mes en curso", "del mes")) return range(startOfMonth(ref), ref, "este mes");
  const qStart = `${y}-${String(Math.floor((+ref.slice(5, 7) - 1) / 3) * 3 + 1).padStart(2, "0")}-01`;
  if (has(q, "trimestre pasado", "trimestre anterior")) {
    const s = addMonths(qStart, -3);
    return range(s, addDays(qStart, -1), "el trimestre pasado");
  }
  if (has(q, "este trimestre", "trimestre actual", "del trimestre")) return range(qStart, ref, "este trimestre");
  if (has(q, "ano pasado", "ano anterior")) return range(`${y - 1}-01-01`, `${y - 1}-12-31`, `${y - 1}`);
  if (has(q, "este ano", "ano actual", "lo que va de ano", "del ano")) return range(`${y}-01-01`, ref, `${y} (hasta hoy)`);
  const monthIdx = MONTHS_LONG_ES.findIndex((mn) => new RegExp(`\\b${mn}\\b`).test(q));
  const yearM = q.match(/\b(20\d{2})\b/);
  if (monthIdx >= 0) {
    let yy = yearM ? +yearM[1] : y;
    if (!yearM && `${yy}-${String(monthIdx + 1).padStart(2, "0")}-01` > ref) yy -= 1;
    const s = `${yy}-${String(monthIdx + 1).padStart(2, "0")}-01`;
    return range(s, endOfMonth(s), `${MONTHS_LONG_ES[monthIdx]} ${yy}`);
  }
  if (yearM) return range(`${yearM[1]}-01-01`, `${yearM[1]}-12-31`, yearM[1]);
  return null;
}

export interface Vocab {
  comercializadoras: string[];
  provincias: string[];
  tarifas: string[];
}

export function buildVocab(all: Contract[]): Vocab {
  return {
    comercializadoras: [...new Set(all.map((c) => c.comercializadora))].filter((x) => x !== "Sin comercializadora"),
    provincias: [...new Set(all.map((c) => c.provincia).filter(Boolean) as string[])],
    tarifas: [...new Set(all.map((c) => c.tarifa))],
  };
}

export function parseQuestion(raw: string, ref: ISODate, vocab: Vocab): Query {
  const q = " " + keyText(raw).replace(/[¿?¡!.,;:()"]/g, " ").replace(/\s+/g, " ") + " ";
  const words = (s: string) => new RegExp(`(^|[^a-z0-9])${keyText(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(q);

  const comercializadoras = vocab.comercializadoras.filter((c) => keyText(c).length > 1 && words(c));
  const provincias = vocab.provincias.filter((p) => words(p));
  const tarifas = vocab.tarifas.filter((t) => /td|rl/i.test(t) && (words(t) || words(t.replace(".", ""))));
  const tipos: ProductType[] = [];
  if (has(q, " luz ", "electric")) tipos.push("luz");
  if (has(q, " gas ")) tipos.push("gas");
  if (has(q, "telefon", "telecom", " fibra", " movil")) tipos.push("telefonia");

  let metric: Metric = "contratos";
  let groupBy: GroupBy = null;
  let dateField: DateBasis = "fTramitacion";
  const estados: EstadoKey[] = [];
  let minDays: number | undefined;

  const conversion = has(q, "porcentaje", "tasa", "ratio", "% ") && has(q, "activ");
  const daysM = q.match(/mas de (\d+) dias/);
  if (conversion) metric = "conversion";
  else if (daysM || (has(q, "llevan", "antigued") && has(q, "pendiente"))) {
    metric = "antiguedad";
    minDays = daysM ? +daysM[1] : 30;
  } else if (has(q, "comision", "comisiones")) metric = "comision";
  else if (has(q, "mwh", "kwh", "consumo", "energia gestionada", "energia")) metric = "consumo";
  else if (has(q, "clientes")) metric = "clientes";

  if (metric === "contratos" || metric === "clientes" || metric === "consumo" || metric === "comision") {
    if (has(q, "activaron", "activaciones", "activados", "se han activado", "activado")) dateField = "fActivacion";
    if (has(q, "bajas", "baja ")) dateField = "fBaja";
    const est: [string[], EstadoKey[]][] = [
      [["pendientes", "pendiente"], ["pendiente", "pendiente_activacion"]],
      [["firmados", "firmado"], ["firmado"]],
      [["tramitados", "tramitado"], ["tramitado"]],
      [["comisionados", "comisionado"], ["comisionado"]],
      [["anulados", "anulado"], ["anulado"]],
      [["incidencia"], ["incidencia"]],
    ];
    for (const [w, e] of est) if (w.some((x) => words(x))) estados.push(...e);
  }

  if (has(q, "comercializadora", "compania", "companias", "proveedor")) groupBy = "comercializadora";
  else if (has(q, "colaborador", "comercial ", "comerciales", "usuario", "vendedor", "propietario")) groupBy = "owner";
  else if (has(q, "municipio", "poblacion", "ciudad", "localidad")) groupBy = "municipio";
  else if (has(q, "provincia")) groupBy = "provincia";
  else if (has(q, "por tarifa", "que tarifa", "tarifas")) groupBy = "tarifa";
  else if (has(q, "por estado", "estados")) groupBy = "estado";
  else if (has(q, "por producto", "tipo de producto", "que producto")) groupBy = "tipo";
  else if (has(q, "por mes", "mensual", "evolucion", "cada mes")) groupBy = "mes";
  if (metric === "antiguedad" || metric === "conversion") groupBy = groupBy === "mes" ? null : groupBy;

  // en preguntas de ranking sin métrica explícita de volumen, "volumen" = contratos si no hay consumo
  const top = has(q, " mas ", " mayor", " top", "ranking", "principal", "mejor", "concentran");

  return { metric, groupBy, period: parsePeriod(q, ref), dateField, comercializadoras, tipos, tarifas, estados, provincias, minDays, top };
}

const GROUP_LABEL: Record<Exclude<GroupBy, null>, string> = {
  comercializadora: "comercializadora",
  owner: "colaborador",
  municipio: "municipio",
  provincia: "provincia",
  tarifa: "tarifa",
  estado: "estado",
  tipo: "tipo de producto",
  mes: "mes",
};
const DATE_LABEL: Record<DateBasis, string> = { fTramitacion: "fecha de tramitación", fActivacion: "fecha de activación", fBaja: "fecha de baja", fTraspaso: "fecha de traspaso" };

export function executeQuery(query: Query, base: Contract[], settings: Settings, ref: ISODate, globalFilterLabels: string[]): Answer {
  const filters = [...globalFilterLabels];
  const calc: string[] = [];
  let rows = base;
  if (query.comercializadoras.length) {
    rows = rows.filter((c) => query.comercializadoras.includes(c.comercializadora));
    filters.push(`Comercializadora: ${query.comercializadoras.join(", ")}`);
  }
  if (query.tipos.length) {
    rows = rows.filter((c) => query.tipos.includes(c.tipo));
    filters.push(`Producto: ${query.tipos.map((t) => TIPO_LABEL[t]).join(", ")}`);
  }
  if (query.tarifas.length) {
    rows = rows.filter((c) => query.tarifas.includes(c.tarifa));
    filters.push(`Tarifa: ${query.tarifas.join(", ")}`);
  }
  if (query.provincias.length) {
    rows = rows.filter((c) => c.provincia && query.provincias.includes(c.provincia));
    filters.push(`Provincia: ${query.provincias.join(", ")}`);
  }
  if (query.estados.length) {
    rows = rows.filter((c) => query.estados.includes(c.estado));
    filters.push(`Estado: ${[...new Set(query.estados.map((e) => ESTADO_LABEL[e]))].join(", ")}`);
  }
  const df = query.dateField;
  const inP = (c: Contract) => !query.period || (!!c[df] && c[df]! >= query.period.from && c[df]! <= query.period.to);
  const pLabel = query.period ? ` ${query.period.label === "hoy" || query.period.label === "ayer" || query.period.label.startsWith("este") || query.period.label.startsWith("esta") || query.period.label.startsWith("el ") || query.period.label.startsWith("la ") || query.period.label.startsWith("últimos") || query.period.label.startsWith("del ") ? query.period.label : `en ${query.period.label}`}` : "";
  if (query.period) filters.push(`Período: ${fmtDate(query.period.from)} – ${fmtDate(query.period.to)} (${DATE_LABEL[df]})`);
  const factor = settings.consumoUnit === "kWh" ? 1 / 1000 : 1;

  // ---- tasa de activación
  if (query.metric === "conversion") {
    const tram = rows.filter((c) => c.fTramitacion && (!query.period || (c.fTramitacion >= query.period.from && c.fTramitacion <= query.period.to)));
    const act = tram.filter((c) => c.fActivacion);
    const pct = tram.length ? (act.length / tram.length) * 100 : null;
    calc.push(`Contratos con fecha de tramitación${pLabel}: ${fmtInt(tram.length)}`);
    calc.push(`De ellos, con fecha de activación: ${fmtInt(act.length)}`);
    calc.push(`Tasa = ${fmtInt(act.length)} / ${fmtInt(tram.length)}`);
    calc.push("Se usa la existencia de fecha de activación, no el estado actual, para no excluir los comisionados.");
    const byMonth = monthRange(query.period?.from ?? addMonths(ref, -11), query.period?.to ?? ref).slice(-12);
    return {
      ok: pct !== null,
      headline: pct === null ? "No hay contratos tramitados en ese período." : `El ${fmtShare(pct)} de los contratos tramitados${pLabel} tiene fecha de activación.`,
      detail: pct === null ? undefined : `${fmtInt(act.length)} activados de ${fmtInt(tram.length)} tramitados.`,
      calc,
      filters,
      ids: tram.filter((c) => !c.fActivacion).map((c) => c.id),
      chart: {
        kind: "bar",
        cats: byMonth.map(fmtMonth),
        values: byMonth.map((mk) => {
          const t = rows.filter((c) => c.fTramitacion?.startsWith(mk));
          return t.length ? Math.round((t.filter((c) => c.fActivacion).length / t.length) * 1000) / 10 : 0;
        }),
        label: "Tasa de activación por mes de tramitación (%)",
        fmt: "pct",
      },
    };
  }

  // ---- pendientes por antigüedad
  if (query.metric === "antiguedad") {
    const n = query.minDays ?? 30;
    const pend = rows.filter((c) => c.estado === "pendiente" || c.estado === "pendiente_activacion");
    const old = pend.map((c) => ({ c, a: ageDays(c, ref) })).filter((x) => x.a && x.a.days > n).sort((a, b) => b.a!.days - a.a!.days);
    calc.push(`Contratos en estado Pendiente o Pendiente de activación: ${fmtInt(pend.length)}`);
    calc.push(`Antigüedad = días desde la fecha de tramitación (o de traspaso al CRM si no hay tramitación) hasta ${fmtDate(ref)}`);
    calc.push(`Con más de ${n} días: ${fmtInt(old.length)}`);
    const fromTraspaso = old.filter((x) => x.a!.from === "traspaso").length;
    if (fromTraspaso) calc.push(`${fmtInt(fromTraspaso)} se miden desde el traspaso porque no tienen fecha de tramitación.`);
    const groups = countBy(old.map((x) => x.c), (c) => c.comercializadora);
    const g = [...groups.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 10);
    return {
      ok: true,
      headline: `${fmtInt(old.length)} contratos llevan más de ${n} días pendientes.`,
      detail: old.length ? `El más antiguo: ${old[0].c.nombre} (${fmtInt(old[0].a!.days)} días).` : undefined,
      calc,
      filters,
      ids: old.map((x) => x.c.id),
      chart: old.length ? { kind: "bar", cats: g.map((x) => x[0]), values: g.map((x) => x[1].length), label: "Pendientes antiguos por comercializadora", fmt: "int" } : undefined,
    };
  }

  const period = rows.filter(inP);
  const value = (items: Contract[]): number => {
    if (query.metric === "clientes") return new Set(items.map(clientKeyOf)).size;
    if (query.metric === "consumo") return sum(items.filter((c) => c.tipo === "luz" || c.tipo === "gas"), (c) => c.consumo) * factor;
    if (query.metric === "comision") return sum(items, (c) => commissionOf(c, settings.commissionMode === "none" ? "sum" : settings.commissionMode));
    return items.length;
  };
  const fmtV = (n: number) => (query.metric === "consumo" ? `${fmtDec(n)} MWh` : query.metric === "comision" ? fmtEur(n) : fmtInt(n));
  const fmtKind: "int" | "eur" | "mwh" = query.metric === "consumo" ? "mwh" : query.metric === "comision" ? "eur" : "int";
  const noun = query.metric === "clientes" ? "clientes únicos" : query.metric === "consumo" ? "MWh" : query.metric === "comision" ? "comisiones registradas" : df === "fActivacion" ? "contratos activados" : df === "fBaja" ? "bajas" : "contratos";
  if (query.period && df === "fTramitacion" && query.metric === "contratos") calc.push("Se cuentan las altas comerciales por fecha de tramitación (igual a la de carterización).");
  if (query.metric === "consumo") {
    calc.push(`Consumo del Excel en ${settings.consumoUnit}${settings.consumoConfirmed ? "" : " (unidad supuesta, sin confirmar)"} convertido a MWh. Telecomunicaciones excluidas.`);
  }
  if (query.metric === "comision") calc.push(`Importes registrados; modo de cálculo: ${settings.commissionMode === "sum" ? "venta + subdominio" : settings.commissionMode}. No indica cobro.`);

  // ---- agrupaciones
  if (query.groupBy) {
    const key = (c: Contract): string | string[] => {
      switch (query.groupBy) {
        case "comercializadora": return c.comercializadora;
        case "owner": return c.owners;
        case "municipio": return c.poblacion ?? "Sin población";
        case "provincia": return c.provincia ?? "Sin provincia";
        case "tarifa": return c.tarifa;
        case "estado": return ESTADO_LABEL[c.estado];
        case "tipo": return TIPO_LABEL[c.tipo];
        case "mes": return c[df]?.slice(0, 7) ?? "Sin fecha";
        default: return "";
      }
    };
    const groups = countBy(period, key);
    let entries = [...groups.entries()].map(([k, items]) => ({ k, label: query.groupBy === "owner" ? ownerLabel(k, settings) : query.groupBy === "mes" ? fmtMonth(k) : k, v: value(items), items }));
    if (query.groupBy === "mes") {
      const months = monthRange(query.period?.from ?? addMonths(ref, -11), query.period?.to ?? ref);
      const map = new Map(entries.map((e) => [e.k, e]));
      entries = months.map((mk) => map.get(mk) ?? { k: mk, label: fmtMonth(mk), v: 0, items: [] });
    } else entries.sort((a, b) => b.v - a.v);
    if (!entries.length) return { ok: false, headline: `No hay datos${pLabel} con esos criterios.`, calc, filters };
    const total = entries.reduce((a, b) => a + b.v, 0);
    calc.push(`Agrupado por ${GROUP_LABEL[query.groupBy]} sobre ${fmtInt(period.length)} contratos${pLabel}.`);
    if (query.groupBy === "owner") calc.push("Un contrato con dos propietarios cuenta para ambos.");
    if (query.metric === "consumo" && query.groupBy !== "tipo") {
      const luz = sum(period.filter((c) => c.tipo === "luz"), (c) => c.consumo) * factor;
      const gas = sum(period.filter((c) => c.tipo === "gas"), (c) => c.consumo) * factor;
      calc.push(`Electricidad ${fmtDec(luz)} MWh · gas ${fmtDec(gas)} MWh (se ordena por la suma solo para clasificar).`);
    }
    const first = entries[0];
    const shown = query.groupBy === "mes" ? entries : entries.slice(0, 12);
    const headline =
      query.groupBy === "mes"
        ? `Evolución mensual de ${noun}${pLabel}: ${fmtV(total)} en total.`
        : `${first.label} lidera con ${fmtV(first.v)} ${query.metric === "consumo" || query.metric === "comision" ? "" : noun}${pLabel} (${fmtShare(total ? (first.v / total) * 100 : 0)} del total).`.replace(/\s+\(/, " (").replace(/\s{2,}/g, " ");
    return {
      ok: true,
      headline,
      detail: query.groupBy !== "mes" && entries.length > 1 ? `Le siguen ${entries.slice(1, 3).map((e) => `${e.label} (${fmtV(e.v)})`).join(" y ")}.` : undefined,
      calc,
      filters,
      ids: query.groupBy === "mes" ? period.map((c) => c.id) : first.items.map((c) => c.id),
      chart: { kind: query.groupBy === "mes" ? "line" : "bar", cats: shown.map((e) => e.label), values: shown.map((e) => Math.round(e.v * 10) / 10), label: `${noun} por ${GROUP_LABEL[query.groupBy]}`, fmt: fmtKind },
    };
  }

  // ---- totales
  const v = value(period);
  calc.push(`${fmtInt(period.length)} contratos cumplen los criterios.`);
  if (query.metric === "consumo") {
    const luz = sum(period.filter((c) => c.tipo === "luz"), (c) => c.consumo) * factor;
    const gas = sum(period.filter((c) => c.tipo === "gas"), (c) => c.consumo) * factor;
    const nl = period.filter((c) => c.tipo === "luz" && c.consumo !== null).length, ng = period.filter((c) => c.tipo === "gas" && c.consumo !== null).length;
    calc.push(`Electricidad: ${fmtDec(luz)} MWh en ${fmtInt(nl)} contratos con consumo · Gas: ${fmtDec(gas)} MWh en ${fmtInt(ng)} contratos.`);
    return {
      ok: true,
      headline: `Electricidad: ${fmtInt(luz)} MWh · Gas: ${fmtInt(gas)} MWh${pLabel}.`,
      detail: "Luz y gas se informan por separado; no se suman en una sola cifra.",
      calc,
      filters,
      ids: period.filter((c) => (c.tipo === "luz" || c.tipo === "gas") && c.consumo !== null).map((c) => c.id),
      chart: { kind: "bar", cats: ["Electricidad", "Gas"], values: [Math.round(luz), Math.round(gas)], label: "MWh", fmt: "mwh" },
    };
  }
  if (query.metric === "comision") {
    const ve = sum(period, (c) => c.comisionVenta), su = sum(period, (c) => c.comisionSubdominio);
    calc.push(`Comisión venta: ${fmtEur(ve, true)} · Comisión subdominio: ${fmtEur(su, true)}`);
    return {
      ok: true,
      headline: `Las comisiones registradas${pLabel} suman ${fmtEur(v)}.`,
      detail: `Venta ${fmtEur(ve)} · subdominio ${fmtEur(su)}.`,
      calc,
      filters,
      ids: period.filter((c) => c.comisionVenta !== null || c.comisionSubdominio !== null).map((c) => c.id),
      chart: { kind: "bar", cats: ["Venta", "Subdominio"], values: [Math.round(ve), Math.round(su)], label: "€", fmt: "eur" },
    };
  }
  const months = query.period ? monthRange(query.period.from, query.period.to) : [];
  return {
    ok: true,
    headline: `${fmtV(v)} ${noun}${pLabel}.`,
    detail: query.metric === "contratos" ? (() => { const n = new Set(period.map(clientKeyOf)).size; return `Corresponden a ${fmtInt(n)} ${n === 1 ? "cliente único" : "clientes únicos"}.`; })() : undefined,
    calc,
    filters,
    ids: period.map((c) => c.id),
    chart: months.length > 1 ? { kind: "bar", cats: months.map(fmtMonth), values: months.map((mk) => value(period.filter((c) => c[df]?.startsWith(mk)))), label: `${noun} por mes`, fmt: "int" } : undefined,
  };
}
