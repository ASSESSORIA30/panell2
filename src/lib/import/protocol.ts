import type { Contract } from "../types";
import type { QualityReport } from "./quality";

export interface SheetInfo {
  name: string;
  headers: string[];
  rowCount: number;
  score: number;
  mapping: Record<string, string | null>;
  unmapped: string[];
}

export type WorkerRequest =
  | { type: "read"; buffer: ArrayBuffer; fileName: string }
  | { type: "preview"; sheet: string }
  | {
      type: "process";
      sheet: string;
      mapping: Record<string, string | null>;
      aliases: Record<string, string>;
      dedupeFields: string[];
      fileName: string;
    };

export type WorkerResponse =
  | { type: "progress"; stage: string; pct: number }
  | { type: "read:done"; sheets: SheetInfo[]; selected: string; preview: Record<string, unknown>[] }
  | { type: "preview:done"; preview: Record<string, unknown>[] }
  | { type: "process:done"; contracts: Contract[]; quality: QualityReport }
  | { type: "error"; message: string };
