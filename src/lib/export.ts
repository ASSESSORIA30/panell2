import type { Contract, Settings } from "./types";
import { ESTADO_LABEL, TIPO_LABEL } from "./normalize";
import { mask } from "./format";
import { ownerLabel } from "./metrics";

export function contractsToRows(rows: Contract[], settings: Settings, includeSensitive: boolean) {
  const s = (v: string | null, k: Parameters<typeof mask>[1]) => (includeSensitive ? v ?? "" : v ? mask(v, k) : "");
  return rows.map((c) => ({
    Cliente: c.nombre,
    "CIF/NIF": s(c.cif, "cif"),
    Municipio: c.poblacion ?? "",
    Provincia: c.provincia ?? "",
    "Código postal": c.cp ?? "",
    "Tipo de producto": TIPO_LABEL[c.tipo],
    Comercializadora: c.comercializadora,
    Tarifa: c.tarifa,
    Producto: c.producto ?? "",
    CUPS: c.cups ?? "",
    Estado: ESTADO_LABEL[c.estado],
    [`Consumo (${settings.consumoUnit})`]: c.consumo ?? "",
    "Potencia (kW)": c.potencia ?? "",
    "Fecha tramitación": c.fTramitacion ?? "",
    "Fecha activación": c.fActivacion ?? "",
    "Fecha baja": c.fBaja ?? "",
    "Fecha traspaso": c.fTraspaso ?? "",
    "Comisión venta (€)": c.comisionVenta ?? "",
    "Comisión subdominio (€)": c.comisionSubdominio ?? "",
    Propietario: c.owners.map((o) => ownerLabel(o, settings)).join(", "),
    Teléfono: s(c.telefono, "tel"),
    Correo: s(c.email, "email"),
    IBAN: s(c.iban, "iban"),
    Observaciones: c.observaciones ?? "",
    "Fila original": c.sourceRow,
    "Archivo origen": c.sourceFile,
  }));
}

const safeName = (s: string) => s.replace(/[^\p{L}\p{N} _-]/gu, "").trim().replace(/\s+/g, "_").slice(0, 60) || "export";
const stamp = () => new Date().toISOString().slice(0, 10);

export async function exportContracts(rows: Contract[], settings: Settings, format: "xlsx" | "csv", name: string, includeSensitive: boolean) {
  const XLSX = await import("@e965/xlsx");
  const ws = XLSX.utils.json_to_sheet(contractsToRows(rows, settings, includeSensitive));
  const file = `Assessoria30_${safeName(name)}_${stamp()}`;
  if (format === "csv") {
    const csv = "﻿" + XLSX.utils.sheet_to_csv(ws, { FS: ";" });
    download(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${file}.csv`);
    return;
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Contratos");
  XLSX.writeFile(wb, `${file}.xlsx`);
}

export async function exportTable(sheets: { name: string; rows: Record<string, unknown>[] }[], name: string) {
  const XLSX = await import("@e965/xlsx");
  const wb = XLSX.utils.book_new();
  for (const s of sheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.rows), s.name.slice(0, 31));
  XLSX.writeFile(wb, `Assessoria30_${safeName(name)}_${stamp()}.xlsx`);
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
