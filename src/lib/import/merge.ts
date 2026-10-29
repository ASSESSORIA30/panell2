import type { Contract } from "../types";

const COMPARE_IGNORE = new Set(["importedAt", "updatedAt", "sourceFile", "sourceRow"]);

function sameContract(a: Contract, b: Contract): boolean {
  for (const k of Object.keys(b) as (keyof Contract)[]) {
    if (COMPARE_IGNORE.has(k)) continue;
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) return false;
  }
  return true;
}

export interface MergeDiff {
  added: number;
  updated: number;
  unchanged: number;
  kept: number; // existentes no presentes en el nuevo archivo (solo fusión)
  removed: number; // solo sustitución
}

export function diffImport(existing: Contract[], incoming: Contract[], mode: "replace" | "merge"): MergeDiff {
  const byId = new Map(existing.map((c) => [c.id, c]));
  let added = 0, updated = 0, unchanged = 0;
  const inIds = new Set<string>();
  for (const c of incoming) {
    inIds.add(c.id);
    const prev = byId.get(c.id);
    if (!prev) added++;
    else if (sameContract(prev, c)) unchanged++;
    else updated++;
  }
  const notInNew = existing.filter((c) => !inIds.has(c.id)).length;
  return { added, updated, unchanged, kept: mode === "merge" ? notInNew : 0, removed: mode === "replace" ? notInNew : 0 };
}

export function applyImport(existing: Contract[], incoming: Contract[], mode: "replace" | "merge"): Contract[] {
  if (mode === "replace") return incoming;
  const byId = new Map(existing.map((c) => [c.id, c]));
  for (const c of incoming) {
    const prev = byId.get(c.id);
    if (prev && sameContract(prev, c)) continue; // conserva fechas de importación originales
    byId.set(c.id, prev ? { ...c, importedAt: prev.importedAt } : c);
  }
  return [...byId.values()];
}
