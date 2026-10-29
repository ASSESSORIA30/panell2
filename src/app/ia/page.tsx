"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, Calculator, Filter, ListChecks, Sparkles, Cpu } from "lucide-react";
import type { EChartsOption } from "echarts";
import { useData } from "@/lib/useData";
import { useStore } from "@/lib/store";
import { buildVocab, CAPABILITIES, EXAMPLES, executeQuery, parseQuestion, type Answer, type Query } from "@/lib/ai/engine";
import { describeFilters } from "@/lib/describe";
import { fmtEur, fmtInt, fmtShare } from "@/lib/format";
import { EChart } from "@/components/charts/EChart";
import { barsOption, linesOption } from "@/components/charts/builders";
import { NoData, PageIntro } from "@/components/ui/kpi";
import { Badge, Button, cx, Panel } from "@/components/ui/primitives";

interface Turn {
  id: number;
  q: string;
  a: Answer;
  via: "determinista" | "ia";
}

export default function IAPage() {
  const { all, rows, filters, settings, ref, tokens: t, empty } = useData();
  const openDrawer = useStore((s) => s.openDrawer);
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [llm, setLlm] = useState<{ enabled: boolean; model: string | null }>({ enabled: false, model: null });
  const [useLlm, setUseLlm] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const vocab = useMemo(() => buildVocab(all), [all]);

  useEffect(() => {
    fetch("/api/ask").then((r) => r.json()).then((d) => setLlm(d)).catch(() => setLlm({ enabled: false, model: null }));
  }, []);

  const ask = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    setBusy(true);
    let query: Query = parseQuestion(question, ref, vocab);
    let via: Turn["via"] = "determinista";
    if (useLlm && llm.enabled) {
      try {
        const r = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question, today: ref, vocab }) });
        if (r.ok) {
          const d = await r.json();
          if (d.query) {
            query = { ...query, ...d.query, comercializadoras: d.query.comercializadoras ?? [], tipos: d.query.tipos ?? [], tarifas: d.query.tarifas ?? [], estados: d.query.estados ?? [], provincias: d.query.provincias ?? [] };
            via = "ia";
          }
        }
      } catch {
        /* se mantiene la interpretación determinista */
      }
    }
    const a = executeQuery(query, rows, settings, ref, describeFilters(filters, settings));
    setTurns((ts) => [{ id: Date.now(), q: question, a, via }, ...ts]);
    setQ("");
    setBusy(false);
  };

  if (empty) return <NoData />;

  return (
    <div className="mx-auto grid max-w-5xl gap-5">
      <PageIntro title="Pregunta a tus datos">
        Las respuestas se calculan sobre los contratos cargados y respetan los filtros globales activos. Cada respuesta muestra el cálculo, los filtros y los registros que la explican.
      </PageIntro>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
        className="panel relative p-2"
      >
        <textarea
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(q);
            }
          }}
          rows={2}
          placeholder="Por ejemplo: ¿qué comercializadora nos ha aportado más contratos este año?"
          aria-label="Pregunta"
          className="w-full resize-none bg-transparent px-3 py-2.5 text-[15px] leading-relaxed outline-none placeholder:text-ink-3"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-1">
          <div className="flex items-center gap-2 text-[12px] text-ink-3">
            {llm.enabled ? (
              <button type="button" onClick={() => setUseLlm(!useLlm)} aria-pressed={useLlm} className={cx("inline-flex items-center gap-1.5 rounded-md border px-2 py-1 transition-colors", useLlm ? "border-brand bg-brand-soft text-ink" : "border-line hover:text-ink")}>
                <Sparkles size={12} /> Interpretación con IA {useLlm ? "activada" : "desactivada"}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5"><Cpu size={12} /> Motor estadístico determinista · sin conexión a un modelo de IA</span>
            )}
          </div>
          <Button type="submit" variant="primary" size="sm" disabled={!q.trim() || busy} ariaLabel="Preguntar">
            <ArrowUp size={14} /> Preguntar
          </Button>
        </div>
      </form>

      {turns.length === 0 && (
        <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
          <Panel title="Prueba con">
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((e) => (
                <button key={e} onClick={() => ask(e)} className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-left text-[13px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink">
                  {e}
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="Qué sabe responder">
            <ul className="grid gap-1.5 text-[12.5px] text-ink-2">
              {CAPABILITIES.map((c) => (
                <li key={c} className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-3" />{c}</li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] text-ink-3">
              {llm.enabled
                ? `Con la interpretación con IA activada, solo se envía la pregunta y los nombres de comercializadoras, provincias y tarifas al modelo ${llm.model}. Ningún dato de cliente sale del navegador y las cifras se calculan aquí.`
                : "Para interpretar preguntas más libres, define ANTHROPIC_API_KEY en el servidor. Ni siquiera entonces se envían datos de clientes."}
            </p>
          </Panel>
        </div>
      )}

      <AnimatePresence initial={false}>
        {turns.map((tn) => (
          <motion.article key={tn.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="panel overflow-hidden">
            <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3">
              <p className="text-[13.5px] text-ink-2">{tn.q}</p>
              <Badge>{tn.via === "ia" ? "interpretado con IA" : "determinista"}</Badge>
            </div>
            <div className="px-5 py-4">
              <p className={cx("text-[20px] font-semibold leading-snug tracking-[-0.02em]", !tn.a.ok && "text-ink-2")}>{tn.a.headline}</p>
              {tn.a.detail && <p className="mt-1 text-[13.5px] text-ink-2">{tn.a.detail}</p>}
              {tn.a.chart && tn.a.chart.values.length > 0 && (
                <div className="mt-4">
                  <EChart option={chartFor(tn.a.chart, t)} height={tn.a.chart.kind === "bar" && tn.a.chart.cats.length > 6 && !tn.a.chart.cats[0].match(/\d{2}$/) ? Math.max(220, tn.a.chart.cats.length * 28) : 240} ariaLabel={tn.a.chart.label} />
                </div>
              )}
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-ink-3"><Calculator size={12} /> Cálculo realizado</h3>
                  <ul className="grid gap-1 text-[12.5px] text-ink-2">{tn.a.calc.map((c, i) => <li key={i}>{c}</li>)}</ul>
                </div>
                <div>
                  <h3 className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-ink-3"><Filter size={12} /> Filtros aplicados</h3>
                  {tn.a.filters.length ? <ul className="grid gap-1 text-[12.5px] text-ink-2">{tn.a.filters.map((c, i) => <li key={i}>{c}</li>)}</ul> : <p className="text-[12.5px] text-ink-3">Ninguno: todos los contratos cargados.</p>}
                </div>
              </div>
              {tn.a.ids && tn.a.ids.length > 0 && (
                <Button size="sm" className="mt-4" onClick={() => openDrawer(tn.q, tn.a.ids!, "Registros que explican la respuesta")}>
                  <ListChecks size={13} /> Ver {fmtInt(tn.a.ids.length)} registros
                </Button>
              )}
            </div>
          </motion.article>
        ))}
      </AnimatePresence>
    </div>
  );
}

function chartFor(c: NonNullable<Answer["chart"]>, t: ReturnType<typeof useData>["tokens"]): EChartsOption {
  const fmt = c.fmt === "eur" ? (n: number) => fmtEur(n) : c.fmt === "pct" ? (n: number) => fmtShare(n) : c.fmt === "mwh" ? (n: number) => `${fmtInt(n)} MWh` : fmtInt;
  if (c.kind === "line") return linesOption(t, c.cats, [{ name: c.label, data: c.values, color: t.brand }], { fmt, area: true });
  const horizontal = c.cats.length > 2 && !/\d{2}$/.test(c.cats[0]);
  return barsOption(t, c.cats, [{ name: c.label, data: c.values, color: t.series[0] }], { horizontal, fmt, legend: false });
}
