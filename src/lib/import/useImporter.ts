"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SheetInfo, WorkerRequest, WorkerResponse } from "./protocol";
import type { QualityReport } from "./quality";
import type { Contract } from "../types";

export type ImportStage = "idle" | "reading" | "mapping" | "processing" | "review" | "error";

export function useImporter() {
  const worker = useRef<Worker | null>(null);
  const [stage, setStage] = useState<ImportStage>("idle");
  const [progress, setProgress] = useState<{ stage: string; pct: number } | null>(null);
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [sheet, setSheet] = useState("");
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [preview, setPreview] = useState<Record<string, unknown>[]>([]);
  const [result, setResult] = useState<{ contracts: Contract[]; quality: QualityReport } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ensure = useCallback(() => {
    if (!worker.current) {
      worker.current = new Worker(new URL("./import.worker.ts", import.meta.url));
      worker.current.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const m = e.data;
        if (m.type === "progress") setProgress({ stage: m.stage, pct: m.pct });
        else if (m.type === "read:done") {
          setSheets(m.sheets);
          setSheet(m.selected);
          setMapping(m.sheets.find((s) => s.name === m.selected)!.mapping);
          setPreview(m.preview);
          setStage("mapping");
          setProgress(null);
        } else if (m.type === "preview:done") setPreview(m.preview);
        else if (m.type === "process:done") {
          setResult({ contracts: m.contracts, quality: m.quality });
          setStage("review");
          setProgress(null);
        } else if (m.type === "error") {
          setError(m.message);
          setStage("error");
          setProgress(null);
        }
      };
    }
    return worker.current;
  }, []);

  useEffect(() => () => worker.current?.terminate(), []);

  const send = (msg: WorkerRequest, transfer?: Transferable[]) => ensure().postMessage(msg, transfer ?? []);

  const readFile = useCallback(async (file: File) => {
    const ok = /\.(xlsx|xls|csv|xlsm)$/i.test(file.name);
    if (!ok) {
      setError("Formato no admitido. Usa un archivo .xlsx, .xls o .csv exportado del CRM.");
      setStage("error");
      return;
    }
    setError(null);
    setResult(null);
    setFileName(file.name);
    setStage("reading");
    setProgress({ stage: "Leyendo el archivo", pct: 5 });
    const buffer = await file.arrayBuffer();
    send({ type: "read", buffer, fileName: file.name }, [buffer]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chooseSheet = (name: string) => {
    setSheet(name);
    setMapping(sheets.find((s) => s.name === name)!.mapping);
    send({ type: "preview", sheet: name });
  };

  const process = (aliases: Record<string, string>, dedupeFields: string[]) => {
    setStage("processing");
    setProgress({ stage: "Normalizando registros", pct: 10 });
    send({ type: "process", sheet, mapping, aliases, dedupeFields, fileName });
  };

  const reset = () => {
    setStage("idle");
    setResult(null);
    setSheets([]);
    setPreview([]);
    setError(null);
  };

  return { stage, progress, fileName, sheets, sheet, mapping, setMapping, preview, result, error, readFile, chooseSheet, process, reset, setStage };
}
