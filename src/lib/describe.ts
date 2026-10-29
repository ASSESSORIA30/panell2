import type { Filters, Settings } from "./types";
import { ESTADO_LABEL, TIPO_LABEL } from "./normalize";
import { fmtDate, MONTHS_ES } from "./dates";
import { DATE_BASIS_LABEL, ownerLabel } from "./metrics";

export function describeFilters(f: Filters, settings: Settings): string[] {
  const out: string[] = [];
  if (f.dateFrom || f.dateTo) out.push(`${DATE_BASIS_LABEL[settings.dateBasis]}: ${fmtDate(f.dateFrom)} – ${fmtDate(f.dateTo)}`);
  if (f.years.length) out.push(`Año: ${f.years.join(", ")}`);
  if (f.months.length) out.push(`Mes: ${f.months.map((m) => MONTHS_ES[m - 1]).join(", ")}`);
  if (f.comercializadoras.length) out.push(`Comercializadora: ${f.comercializadoras.join(", ")}`);
  if (f.tipos.length) out.push(`Producto: ${f.tipos.map((t) => TIPO_LABEL[t]).join(", ")}`);
  if (f.tarifas.length) out.push(`Tarifa: ${f.tarifas.join(", ")}`);
  if (f.estados.length) out.push(`Estado: ${f.estados.map((e) => ESTADO_LABEL[e]).join(", ")}`);
  if (f.owners.length) out.push(`Comercial: ${f.owners.map((o) => ownerLabel(o, settings)).join(", ")}`);
  if (f.provincias.length) out.push(`Provincia: ${f.provincias.join(", ")}`);
  if (f.municipios.length) out.push(`Municipio: ${f.municipios.join(", ")}`);
  return out.map((s) => `Filtro global · ${s}`);
}
