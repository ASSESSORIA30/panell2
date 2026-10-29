import type { Contract, IssueCode } from "../types";
import { FIELDS } from "../schema";

export interface QualityReport {
  rows: number;
  emptyByField: { key: string; label: string; empty: number }[];
  invalidDates: number;
  invalidNumbers: number;
  issues: Partial<Record<IssueCode, number>>;
  comercializadoraMap: { raw: string; normalized: string; count: number }[];
  provinciaVariants: number;
  provinciaResolved: number;
  provinciasFound: number;
  estadoMap: { raw: string; normalized: string; count: number }[];
  duplicateGroups: number;
  duplicateRows: number;
  score: number; // 0-100
}

export const ISSUE_LABEL: Record<IssueCode, string> = {
  fecha_invalida: "Fecha con formato no válido",
  numero_invalido: "Número no válido",
  cp_invalido: "Código postal no válido",
  provincia_no_reconocida: "Provincia no reconocida",
  sin_comercializadora: "Sin comercializadora",
  sin_tarifa: "Sin tarifa",
  sin_cups: "Luz/gas sin CUPS",
  sin_cif: "Sin CIF/NIF",
  posible_duplicado: "Posible duplicado",
  nombre_copia: "Nombre marcado como «copia»",
  baja_inconsistente: "Fecha de baja con estado no de baja",
  activacion_inconsistente: "Fecha de activación con estado previo",
  propietario_compartido: "Varios propietarios",
};

export function buildQuality(
  raw: Record<string, unknown>[],
  contracts: Contract[],
  invalidDates: number,
  invalidNumbers: number,
  mappedKeys: string[],
): QualityReport {
  const emptyByField = FIELDS.filter((f) => mappedKeys.includes(f.key)).map((f) => ({
    key: f.key,
    label: f.label,
    empty: raw.reduce<number>((n, r) => (r[f.key] === null || r[f.key] === undefined || String(r[f.key]).trim() === "" ? n + 1 : n), 0),
  }));
  const issues: Partial<Record<IssueCode, number>> = {};
  for (const c of contracts) for (const i of c.issues) issues[i] = (issues[i] ?? 0) + 1;

  const cm = new Map<string, { raw: string; normalized: string; count: number }>();
  for (const c of contracts) {
    const k = `${c.comercializadoraRaw ?? "(vacío)"}→${c.comercializadora}`;
    const e = cm.get(k) ?? { raw: c.comercializadoraRaw ?? "(vacío)", normalized: c.comercializadora, count: 0 };
    e.count++;
    cm.set(k, e);
  }
  const em = new Map<string, { raw: string; normalized: string; count: number }>();
  for (const c of contracts) {
    const k = `${c.estadoRaw}→${c.estado}`;
    const e = em.get(k) ?? { raw: c.estadoRaw || "(vacío)", normalized: c.estado, count: 0 };
    e.count++;
    em.set(k, e);
  }
  const provRaw = new Set(contracts.map((c) => c.provinciaRaw ?? ""));
  const provFound = new Set(contracts.map((c) => c.provinciaCode).filter(Boolean));
  const groups = new Map<string, number>();
  for (const c of contracts) groups.set(c.baseKey, (groups.get(c.baseKey) ?? 0) + 1);
  const dupGroups = [...groups.values()].filter((n) => n > 1);

  const totalCells = Math.max(1, contracts.length * Math.max(1, emptyByField.length));
  const required = emptyByField.filter((f) => FIELDS.find((x) => x.key === f.key)?.required);
  const reqEmpty = required.reduce((n, f) => n + f.empty, 0);
  const badCells = invalidDates + invalidNumbers + reqEmpty * 3;
  const score = Math.max(0, Math.round(100 - (badCells / totalCells) * 100 * 4 - (dupGroups.length / Math.max(1, contracts.length)) * 100));

  return {
    rows: contracts.length,
    emptyByField,
    invalidDates,
    invalidNumbers,
    issues,
    comercializadoraMap: [...cm.values()].sort((a, b) => b.count - a.count),
    provinciaVariants: provRaw.size,
    provinciaResolved: contracts.filter((c) => c.provinciaCode).length,
    provinciasFound: provFound.size,
    estadoMap: [...em.values()].sort((a, b) => b.count - a.count),
    duplicateGroups: dupGroups.length,
    duplicateRows: dupGroups.reduce((a, b) => a + b, 0),
    score: Math.min(100, score),
  };
}
