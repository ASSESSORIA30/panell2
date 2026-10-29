"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { FileSpreadsheet, UploadCloud, CheckCircle2, TriangleAlert, RotateCcw, Layers, GitMerge, Replace, History } from "lucide-react";
import { useImporter } from "@/lib/import/useImporter";
import { useStore } from "@/lib/store";
import { FIELDS, FIELD_BY_KEY } from "@/lib/schema";
import { ISSUE_LABEL } from "@/lib/import/quality";
import { applyImport, diffImport } from "@/lib/import/merge";
import { Badge, Button, cx, Notice, Panel, Segmented } from "@/components/ui/primitives";
import { fmtInt } from "@/lib/format";
import { ESTADO_LABEL } from "@/lib/normalize";
import { mask } from "@/lib/format";
import type { IssueCode } from "@/lib/types";

const ease = [0.23, 1, 0.32, 1] as const;

function Progress({ stage, pct }: { stage: string; pct: number }) {
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <p className="text-[13px] text-ink-2">{stage}…</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <motion.div className="h-full rounded-full bg-brand" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.4, ease }} />
      </div>
      <p className="mt-2 text-[12px] tabular text-ink-3">{pct} %</p>
    </div>
  );
}

export default function ImportPage() {
  const imp = useImporter();
  const contracts = useStore((s) => s.contracts);
  const imports = useStore((s) => s.imports);
  const settings = useStore((s) => s.settings);
  const setContracts = useStore((s) => s.setContracts);
  const notify = useStore((s) => s.notify);
  const [drag, setDrag] = useState(false);
  const [mode, setMode] = useState<"merge" | "replace">(contracts.length ? "merge" : "replace");
  const [done, setDone] = useState<{ added: number; updated: number; total: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const sheetInfo = imp.sheets.find((s) => s.name === imp.sheet);
  const headers = sheetInfo?.headers ?? [];
  const sensitiveCols = new Set(FIELDS.filter((f) => f.sensitive).map((f) => imp.mapping[f.key]).filter(Boolean));
  const requiredMissing = FIELDS.filter((f) => f.required && !imp.mapping[f.key]);
  const diffs = useMemo(
    () => (imp.result ? { merge: diffImport(contracts, imp.result.contracts, "merge"), replace: diffImport(contracts, imp.result.contracts, "replace") } : null),
    [imp.result, contracts],
  );

  const onFiles = (files: FileList | null) => {
    if (!files?.[0]) return;
    setDone(null);
    imp.readFile(files[0]);
  };

  const commit = async () => {
    if (!imp.result || !diffs) return;
    const next = applyImport(contracts, imp.result.contracts, mode);
    const d = diffs[mode];
    const q = imp.result.quality;
    const errors = q.invalidDates + q.invalidNumbers;
    await setContracts(next, {
      id: crypto.randomUUID(),
      fileName: imp.fileName,
      date: new Date().toISOString(),
      mode,
      rows: imp.result.contracts.length,
      added: d.added,
      updated: d.updated,
      unchanged: d.unchanged,
      errors,
      warnings: Object.values(q.issues).reduce((a, b) => a + (b ?? 0), 0),
      sheet: imp.sheet,
    });
    setDone({ added: d.added, updated: d.updated, total: next.length });
    notify(`Importación completada: ${fmtInt(next.length)} contratos disponibles.`);
    imp.reset();
  };

  return (
    <div className="grid gap-5">
      <div className="max-w-2xl">
        <h2 className="text-[26px] font-semibold tracking-[-0.03em]">Importa una exportación del CRM</h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
          El archivo se procesa íntegramente en este navegador. Ningún dato personal sale de tu equipo. Se reconocen las columnas, se normalizan estados, comercializadoras y provincias, y se evitan duplicados al reimportar.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {(imp.stage === "idle" || imp.stage === "error") && (
          <motion.div key="drop" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease }}>
            <label
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); onFiles(e.dataTransfer.files); }}
              className={cx(
                "panel group flex cursor-pointer flex-col items-center justify-center border-dashed px-6 py-16 text-center transition-[border-color,background] duration-200",
                drag ? "border-brand bg-brand-soft" : "hover:border-line-strong",
              )}
            >
              <motion.div animate={{ y: drag ? -4 : 0, scale: drag ? 1.06 : 1 }} transition={{ type: "spring", duration: 0.35, bounce: 0.3 }} className="grid h-14 w-14 place-items-center rounded-2xl border border-line-strong bg-surface-2 text-brand">
                <UploadCloud size={24} />
              </motion.div>
              <p className="mt-4 text-[15px] font-semibold">Arrastra aquí el archivo o selecciónalo</p>
              <p className="mt-1 text-[13px] text-ink-3">.xlsx, .xls o .csv · Se procesa en segundo plano sin bloquear la interfaz</p>
              <input ref={input} type="file" accept=".xlsx,.xls,.xlsm,.csv" className="sr-only" onChange={(e) => onFiles(e.target.files)} aria-label="Seleccionar archivo" />
            </label>
            {imp.error && <div className="mt-3"><Notice tone="warn">{imp.error}</Notice></div>}
            {done && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="panel mt-4 flex flex-wrap items-center gap-4 p-5">
                <CheckCircle2 className="text-good" size={22} />
                <div className="flex-1">
                  <p className="font-semibold">Datos actualizados</p>
                  <p className="text-[13px] text-ink-3">{fmtInt(done.added)} nuevos · {fmtInt(done.updated)} actualizados · {fmtInt(done.total)} contratos en total</p>
                </div>
                <Link href="/"><Button variant="primary">Ver el Overview</Button></Link>
              </motion.div>
            )}
          </motion.div>
        )}

        {(imp.stage === "reading" || imp.stage === "processing") && imp.progress && (
          <motion.div key="progress" className="panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Progress stage={imp.progress.stage} pct={imp.progress.pct} />
          </motion.div>
        )}

        {imp.stage === "mapping" && sheetInfo && (
          <motion.div key="mapping" className="grid gap-5" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease }}>
            <Panel
              title={<span className="flex items-center gap-2"><FileSpreadsheet size={15} className="text-brand" /> {imp.fileName}</span>}
              subtitle={`${imp.sheets.length} hojas detectadas · ${fmtInt(sheetInfo.rowCount)} filas y ${headers.length} columnas en «${imp.sheet}»`}
              actions={<Button size="sm" variant="ghost" onClick={imp.reset}><RotateCcw size={13} /> Cambiar archivo</Button>}
            >
              <div className="flex flex-wrap gap-2">
                {imp.sheets.map((s) => (
                  <button key={s.name} onClick={() => imp.chooseSheet(s.name)} className={cx("rounded-lg border px-3 py-2 text-left transition-colors", s.name === imp.sheet ? "border-brand bg-brand-soft" : "border-line hover:border-line-strong")}>
                    <div className="flex items-center gap-1.5 text-[13px] font-medium"><Layers size={13} /> {s.name}</div>
                    <div className="text-[11.5px] text-ink-3">{fmtInt(s.rowCount)} filas · esquema CRM {Math.round(s.score * 100)} %</div>
                  </button>
                ))}
              </div>
              <div className="mt-4">
                {sheetInfo.score > 0.75 ? (
                  <Notice>Esquema del CRM reconocido ({Math.round(sheetInfo.score * 100)} %). Revisa la correspondencia de columnas si el CRM ha cambiado algún nombre.</Notice>
                ) : (
                  <Notice tone="warn">Esta hoja no coincide del todo con el esquema esperado ({Math.round(sheetInfo.score * 100)} %). Asigna manualmente las columnas obligatorias.</Notice>
                )}
              </div>
            </Panel>

            <Panel title="Correspondencia de columnas" subtitle="Cada campo de la aplicación se alimenta de una columna del archivo. Los marcados con • son obligatorios." info="La correspondencia se detecta por el nombre de la cabecera ignorando mayúsculas, acentos, asteriscos y espacios.">
              <div className="grid gap-x-8 gap-y-1 md:grid-cols-2 xl:grid-cols-3">
                {FIELDS.map((f) => (
                  <label key={f.key} className="flex items-center justify-between gap-3 border-b border-line py-1.5 text-[12.5px]">
                    <span className={cx("shrink-0", imp.mapping[f.key] ? "text-ink-2" : "text-ink-3")}>
                      {f.label}{f.required && <span className="ml-1 text-brand">•</span>}
                    </span>
                    <select
                      value={imp.mapping[f.key] ?? ""}
                      onChange={(e) => imp.setMapping({ ...imp.mapping, [f.key]: e.target.value || null })}
                      className="h-7 min-w-0 max-w-[60%] rounded-md border border-line bg-surface-2 px-1.5 text-[12px] text-ink outline-none"
                      aria-label={`Columna para ${f.label}`}
                    >
                      <option value="">— sin asignar —</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              {sheetInfo.unmapped.length > 0 && (
                <p className="mt-3 text-[12px] text-ink-3">Columnas no utilizadas: {sheetInfo.unmapped.join(", ")}</p>
              )}
            </Panel>

            <Panel title="Vista previa" subtitle="Primeras filas tal como vienen en el archivo. Las columnas sensibles se muestran enmascaradas.">
              <div className="overflow-x-auto rounded-lg border border-line scroll-thin">
                <table className="w-full text-[12px]">
                  <thead className="bg-surface-2 text-ink-3">
                    <tr>{headers.slice(0, 22).map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-medium">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {imp.preview.slice(0, 8).map((r, i) => (
                      <tr key={i} className="border-t border-line">
                        {headers.slice(0, 22).map((h) => {
                          const v = r[h];
                          const s = v instanceof Date ? v.toLocaleDateString("es-ES") : v === null ? "" : String(v);
                          return <td key={h} className="max-w-[180px] truncate whitespace-nowrap px-3 py-1.5 text-ink-2">{sensitiveCols.has(h) && s ? mask(s) : s}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <div className="flex flex-wrap items-center justify-end gap-3">
              {requiredMissing.length > 0 && <span className="text-[12.5px] text-critical">Falta asignar: {requiredMissing.map((f) => f.label).join(", ")}</span>}
              <Button variant="primary" disabled={requiredMissing.length > 0} onClick={() => imp.process(settings.comercializadoraAliases, settings.dedupeFields)}>
                Validar {fmtInt(sheetInfo.rowCount)} registros
              </Button>
            </div>
          </motion.div>
        )}

        {imp.stage === "review" && imp.result && diffs && (
          <motion.div key="review" className="grid gap-5" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease }}>
            <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
              <Panel title="Resumen de calidad de datos" subtitle={`${fmtInt(imp.result.quality.rows)} registros validados de «${imp.sheet}»`}>
                <div className="flex items-end gap-6">
                  <div>
                    <div className="text-[44px] font-semibold leading-none tracking-[-0.04em] tabular">{imp.result.quality.score}</div>
                    <div className="mt-1 text-[12px] text-ink-3">índice de calidad sobre 100</div>
                  </div>
                  <div className="grid flex-1 grid-cols-2 gap-3 text-[12.5px] sm:grid-cols-3">
                    <div><div className="text-ink-3">Fechas no válidas</div><div className="text-[16px] font-semibold tabular">{fmtInt(imp.result.quality.invalidDates)}</div></div>
                    <div><div className="text-ink-3">Números no válidos</div><div className="text-[16px] font-semibold tabular">{fmtInt(imp.result.quality.invalidNumbers)}</div></div>
                    <div><div className="text-ink-3">Grupos duplicados</div><div className="text-[16px] font-semibold tabular">{fmtInt(imp.result.quality.duplicateGroups)}</div></div>
                    <div><div className="text-ink-3">Provincias resueltas</div><div className="text-[16px] font-semibold tabular">{fmtInt(imp.result.quality.provinciaResolved)}</div></div>
                    <div><div className="text-ink-3">Variantes de provincia</div><div className="text-[16px] font-semibold tabular">{imp.result.quality.provinciaVariants} → {imp.result.quality.provinciasFound}</div></div>
                    <div><div className="text-ink-3">Comercializadoras</div><div className="text-[16px] font-semibold tabular">{new Set(imp.result.quality.comercializadoraMap.map((c) => c.normalized)).size}</div></div>
                  </div>
                </div>
                <h3 className="mb-2 mt-5 text-[12.5px] font-semibold text-ink-2">Avisos detectados</h3>
                <div className="grid gap-1 sm:grid-cols-2">
                  {(Object.entries(imp.result.quality.issues) as [IssueCode, number][]).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                    <div key={k} className="flex justify-between border-b border-line py-1 text-[12.5px]"><span className="text-ink-2">{ISSUE_LABEL[k]}</span><span className="tabular text-ink">{fmtInt(n)}</span></div>
                  ))}
                </div>
                <p className="mt-3 text-[12px] text-ink-3">Ningún registro se descarta: los avisos quedan marcados y aparecen en Pendientes e incidencias.</p>
              </Panel>
              <Panel title="Celdas vacías por campo" subtitle="Solo campos asignados">
                <div className="max-h-[340px] overflow-y-auto pr-1 scroll-thin">
                  {imp.result.quality.emptyByField.filter((f) => f.empty > 0).sort((a, b) => b.empty - a.empty).map((f) => {
                    const pct = (f.empty / imp.result!.quality.rows) * 100;
                    return (
                      <div key={f.key} className="py-1.5">
                        <div className="flex justify-between text-[12.5px]"><span className="text-ink-2">{f.label}{FIELD_BY_KEY[f.key]?.required && <span className="ml-1 text-brand">•</span>}</span><span className="tabular text-ink-3">{fmtInt(f.empty)} · {pct.toFixed(0)} %</span></div>
                        <div className="mt-1 h-1 rounded-full bg-surface-3"><motion.div className="h-full rounded-full bg-ink-3" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease }} /></div>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Panel title="Normalización de comercializadoras" subtitle="Valor original → nombre unificado. Puedes añadir alias en Configuración.">
                <div className="max-h-64 overflow-y-auto scroll-thin">
                  {imp.result.quality.comercializadoraMap.map((c) => (
                    <div key={c.raw + c.normalized} className="flex items-center justify-between border-b border-line py-1.5 text-[12.5px]">
                      <span className="text-ink-3">{c.raw}</span>
                      <span className="flex items-center gap-2"><span className={c.raw !== c.normalized ? "text-ink" : "text-ink-2"}>{c.normalized}</span><span className="w-10 text-right tabular text-ink-3">{fmtInt(c.count)}</span></span>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel title="Normalización de estados">
                {imp.result.quality.estadoMap.map((c) => (
                  <div key={c.raw} className="flex items-center justify-between border-b border-line py-1.5 text-[12.5px]">
                    <span className="text-ink-3">{c.raw}</span>
                    <span className="flex items-center gap-2"><span className={c.normalized === "otro" ? "text-critical" : "text-ink-2"}>{ESTADO_LABEL[c.normalized as keyof typeof ESTADO_LABEL]}</span><span className="w-10 text-right tabular text-ink-3">{fmtInt(c.count)}</span></span>
                  </div>
                ))}
              </Panel>
            </div>

            <Panel title="Cómo aplicar esta importación">
              <div className="flex flex-wrap items-start gap-5">
                <Segmented
                  ariaLabel="Modo de importación"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "merge", label: <span className="flex items-center gap-1.5"><GitMerge size={13} /> Fusionar</span> },
                    { value: "replace", label: <span className="flex items-center gap-1.5"><Replace size={13} /> Sustituir</span> },
                  ]}
                />
                <div className="min-w-[260px] flex-1 text-[13px] text-ink-2">
                  {mode === "merge" ? (
                    <p>Actualiza los contratos que ya existen y añade solo los nuevos. Los contratos actuales que no aparezcan en el archivo se conservan.</p>
                  ) : (
                    <p>La nueva exportación sustituye por completo al conjunto actual.</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge color="var(--good)">{fmtInt(diffs[mode].added)} nuevos</Badge>
                    <Badge color="var(--s1)">{fmtInt(diffs[mode].updated)} actualizados</Badge>
                    <Badge>{fmtInt(diffs[mode].unchanged)} sin cambios</Badge>
                    {mode === "merge" ? <Badge>{fmtInt(diffs.merge.kept)} existentes conservados</Badge> : <Badge color="var(--critical)">{fmtInt(diffs.replace.removed)} se eliminarán</Badge>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => imp.setStage("mapping")}>Volver</Button>
                  <Button variant="primary" onClick={commit}>Importar {fmtInt(imp.result.contracts.length)} registros</Button>
                </div>
              </div>
            </Panel>
          </motion.div>
        )}
      </AnimatePresence>

      <Panel title={<span className="flex items-center gap-2"><History size={14} /> Historial de importaciones</span>} subtitle="Se guarda en este navegador">
        {imports.length === 0 ? (
          <p className="text-[13px] text-ink-3">Todavía no hay importaciones.</p>
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[720px] text-[12.5px]">
              <thead className="text-left text-ink-3">
                <tr>{["Fecha", "Archivo", "Modo", "Registros", "Nuevos", "Actualizados", "Sin cambios", "Errores de formato", "Avisos"].map((h) => <th key={h} className="pb-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {imports.map((r) => (
                  <tr key={r.id} className="border-t border-line text-ink-2">
                    <td className="py-2 tabular">{new Date(r.date).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="max-w-[260px] truncate py-2 text-ink">{r.fileName}</td>
                    <td className="py-2">{r.mode === "merge" ? "Fusión" : "Sustitución"}</td>
                    <td className="py-2 tabular">{fmtInt(r.rows)}</td>
                    <td className="py-2 tabular">{fmtInt(r.added)}</td>
                    <td className="py-2 tabular">{fmtInt(r.updated)}</td>
                    <td className="py-2 tabular">{fmtInt(r.unchanged)}</td>
                    <td className="py-2 tabular">{r.errors ? <span className="inline-flex items-center gap-1 text-critical"><TriangleAlert size={12} /> {fmtInt(r.errors)}</span> : "0"}</td>
                    <td className="py-2 tabular">{fmtInt(r.warnings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
