/// <reference lib="webworker" />
import * as XLSX from "@e965/xlsx";
import * as cptable from "@e965/xlsx/dist/cpexcel.full";

XLSX.set_cptable(cptable);
import { autoMap } from "../schema";
import { assignIds, normalizeRow } from "../normalize";
import { buildQuality } from "./quality";
import type { WorkerRequest, WorkerResponse, SheetInfo } from "./protocol";

let wb: XLSX.WorkBook | null = null;
const sheetCache = new Map<string, { headers: string[]; rows: unknown[][] }>();

const post = (m: WorkerResponse) => (self as unknown as Worker).postMessage(m);

function readSheet(name: string) {
  if (sheetCache.has(name)) return sheetCache.get(name)!;
  const ws = wb!.Sheets[name];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null, blankrows: false });
  // detectar la fila de cabecera: la de mejor reconocimiento entre las 10 primeras
  let best = 0, bestScore = -1;
  for (let i = 0; i < Math.min(10, aoa.length); i++) {
    const cells = (aoa[i] ?? []).filter((c) => c !== null && String(c).trim() !== "");
    if (cells.length < 2) continue;
    const s = autoMap((aoa[i] ?? []).map((c) => String(c ?? ""))).score;
    if (s > bestScore) { bestScore = s; best = i; }
  }
  const headerRow = (aoa[best] ?? []).map((h, i) => (h === null || String(h).trim() === "" ? `Columna ${i + 1}` : String(h)));
  // nombres duplicados
  const seen = new Map<string, number>();
  const headers = headerRow.map((h) => {
    const n = seen.get(h) ?? 0;
    seen.set(h, n + 1);
    return n ? `${h} (${n + 1})` : h;
  });
  const rows = aoa.slice(best + 1).filter((r) => r.some((c) => c !== null && String(c).trim() !== ""));
  const out = { headers, rows };
  sheetCache.set(name, out);
  return out;
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  try {
    if (msg.type === "read") {
      sheetCache.clear();
      post({ type: "progress", stage: "Leyendo el archivo", pct: 10 });
      wb = XLSX.read(msg.buffer, { type: "array", cellDates: true, dense: true });
      post({ type: "progress", stage: "Detectando hojas y columnas", pct: 40 });
      const sheets: SheetInfo[] = wb.SheetNames.map((name) => {
        const { headers, rows } = readSheet(name);
        const m = autoMap(headers);
        return { name, headers, rowCount: rows.length, score: m.score, mapping: m.mapping, unmapped: m.unmapped };
      });
      const best = [...sheets].sort((a, b) => b.score - a.score)[0];
      const { headers, rows } = readSheet(best.name);
      const preview = rows.slice(0, 30).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? null])));
      post({ type: "read:done", sheets, selected: best.name, preview });
      return;
    }
    if (msg.type === "preview") {
      const { headers, rows } = readSheet(msg.sheet);
      const preview = rows.slice(0, 30).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? null])));
      post({ type: "preview:done", preview });
      return;
    }
    if (msg.type === "process") {
      const { headers, rows } = readSheet(msg.sheet);
      const idx: Record<string, number> = {};
      for (const [field, col] of Object.entries(msg.mapping)) if (col) idx[field] = headers.indexOf(col);
      const importedAt = new Date().toISOString();
      const mapped: Record<string, unknown>[] = [];
      const normalized = [];
      let invalidDates = 0, invalidNumbers = 0;
      const ctx = { fileName: msg.fileName, importedAt, aliases: msg.aliases, dedupeFields: msg.dedupeFields };
      const chunk = 2000;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const obj: Record<string, unknown> = {};
        for (const [field, j] of Object.entries(idx)) if (j >= 0) obj[field] = r[j] ?? null;
        mapped.push(obj);
        const res = normalizeRow(obj, i, ctx);
        invalidDates += res.invalidDates;
        invalidNumbers += res.invalidNumbers;
        normalized.push(res.c);
        if (i % chunk === 0) post({ type: "progress", stage: "Normalizando registros", pct: 10 + Math.round((i / rows.length) * 80) });
      }
      const contracts = assignIds(normalized);
      post({ type: "progress", stage: "Evaluando calidad", pct: 95 });
      const quality = buildQuality(mapped, contracts, invalidDates, invalidNumbers, Object.keys(idx));
      post({ type: "process:done", contracts, quality });
    }
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
