"use client";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Pencil, Trophy } from "lucide-react";
import { useData } from "@/lib/useData";
import { useStore } from "@/lib/store";
import { applyFilters, commissionOf, countBy, currentWindow, growth, inWindow, OWNER_CATEGORY_LABEL, ownerCategory, ownerLabel, PENDING_STATES, previousWindow, sum } from "@/lib/metrics";
import { addMonths, fmtMonth, monthRange } from "@/lib/dates";
import { fmtEur, fmtInt, fmtShare } from "@/lib/format";
import { EChart } from "@/components/charts/EChart";
import { linesOption } from "@/components/charts/builders";
import { FilteredEmpty, NoData, PageIntro } from "@/components/ui/kpi";
import { Badge, Button, cx, Delta, Panel, Segmented } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/DataTable";
import type { Contract, OwnerProfile } from "@/lib/types";

type Metric = "contratos" | "periodo" | "activos" | "conversion" | "comision";
type Cat = "todos" | OwnerProfile["category"];

interface Row {
  email: string;
  name: string;
  cat: OwnerProfile["category"];
  items: Contract[];
  n: number;
  periodo: number;
  prev: number;
  activados: number;
  activos: number; // activados + comisionados
  pendientes: number;
  anulados: number;
  mwh: number;
  comision: number;
  conversion: number | null;
  shared: number;
}

const METRIC_LABEL: Record<Metric, string> = { contratos: "Contratos", periodo: "Altas del período", activos: "Activados + comisionados", conversion: "Tasa de activación", comision: "Comisiones" };

function OwnerEditor({ email }: { email: string }) {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const [open, setOpen] = useState(false);
  const p = settings.owners[email] ?? { name: "", category: "sin_clasificar" as const };
  const [name, setName] = useState(p.name);
  const [category, setCategory] = useState<OwnerProfile["category"]>(p.category);
  const save = () => {
    update({ owners: { ...settings.owners, [email]: { name: name.trim(), category } } });
    setOpen(false);
  };
  return (
    <>
      <button onClick={() => { setName(p.name); setCategory(p.category); setOpen(true); }} aria-label={`Editar ${email}`} className="grid h-7 w-7 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink"><Pencil size={13} /></button>
      {typeof document !== "undefined" && createPortal(<AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[80] grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Editar usuario" onClick={(e) => e.stopPropagation()}>
            <motion.div className="absolute inset-0 bg-black/55" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.form initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }} onSubmit={(e) => { e.preventDefault(); save(); }} className="panel relative w-full max-w-sm p-5">
              <h2 className="text-[15px] font-semibold">Identificar usuario</h2>
              <p className="mt-0.5 truncate text-[12.5px] text-ink-3">{email}</p>
              <label className="mt-4 block text-[12.5px] text-ink-2">
                Nombre comercial
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-line-strong bg-surface-2 px-2.5 text-[13px] text-ink outline-none focus:border-brand" placeholder="Ej.: Finques Ronda" />
              </label>
              <p className="mt-4 text-[12.5px] text-ink-2">Categoría</p>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {(["interno", "colaborador", "administrativa", "sin_clasificar"] as const).map((c) => (
                  <button type="button" key={c} onClick={() => setCategory(c)} className={cx("rounded-md border px-2 py-2 text-left text-[12.5px] transition-colors", category === c ? "border-brand bg-brand-soft text-ink" : "border-line text-ink-2 hover:text-ink")}>
                    {OWNER_CATEGORY_LABEL[c]}
                  </button>
                ))}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button variant="primary" type="submit">Guardar</Button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>, document.body)}
    </>
  );
}

export default function ComercialesPage() {
  const { all, rows, filters, settings, tokens: t, ref, empty } = useData();
  const toggle = useStore((s) => s.toggleFilter);
  const openDrawer = useStore((s) => s.openDrawer);
  const [metric, setMetric] = useState<Metric>("contratos");
  const [cat, setCat] = useState<Cat>("todos");
  const factor = settings.consumoUnit === "kWh" ? 1 / 1000 : 1;
  const w = currentWindow(filters, ref);
  const pw = previousWindow(w);

  const table = useMemo(() => {
    const b = settings.dateBasis;
    const base = applyFilters(all, filters, b, "date");
    const baseBy = countBy(base, (c) => c.owners);
    return [...countBy(rows, (c) => c.owners).entries()].map(([email, items]): Row => {
      const bi = baseBy.get(email) ?? [];
      const activos = items.filter((c) => c.estado === "activado" || c.estado === "comisionado").length;
      const decided = items.filter((c) => !PENDING_STATES.includes(c.estado) && c.estado !== "borrador").length;
      return {
        email,
        name: ownerLabel(email, settings),
        cat: ownerCategory(email, settings),
        items,
        n: items.length,
        periodo: bi.filter((c) => inWindow(c[b], w)).length,
        prev: bi.filter((c) => inWindow(c[b], pw)).length,
        activados: items.filter((c) => c.estado === "activado").length,
        activos,
        pendientes: items.filter((c) => PENDING_STATES.includes(c.estado)).length,
        anulados: items.filter((c) => c.estado === "anulado" || c.estado === "baja").length,
        mwh: sum(items.filter((c) => c.tipo === "luz" || c.tipo === "gas"), (c) => c.consumo) * factor,
        comision: sum(items, (c) => commissionOf(c, settings.commissionMode === "none" ? "sum" : settings.commissionMode)),
        conversion: decided >= 5 ? (activos / items.length) * 100 : null,
        shared: items.filter((c) => c.owners.length > 1).length,
      };
    });
  }, [all, rows, filters, settings, w, pw, factor]);

  const val = (r: Row) => (metric === "contratos" ? r.n : metric === "periodo" ? r.periodo : metric === "activos" ? r.activos : metric === "conversion" ? r.conversion ?? -1 : r.comision);
  const fmtVal = (r: Row) => (metric === "comision" ? fmtEur(r.comision) : metric === "conversion" ? (r.conversion === null ? "—" : fmtShare(r.conversion)) : fmtInt(val(r)));
  const shown = useMemo(() => table.filter((r) => (cat === "todos" ? !(settings.excludeAdminFromRanking && r.cat === "administrativa") : r.cat === cat)).sort((a, b) => val(b) - val(a)), [table, cat, metric, settings.excludeAdminFromRanking]); // eslint-disable-line react-hooks/exhaustive-deps
  const max = Math.max(1, ...shown.map((r) => Math.max(0, val(r))));
  const podium = shown.slice(0, 3);

  const evo = useMemo(() => {
    const months = monthRange(addMonths(ref, -11), ref);
    const top = shown.slice(0, 4);
    const colors = [t.series[0], t.series[1], t.series[2], t.series[6]];
    return linesOption(t, months.map(fmtMonth), top.map((r, i) => ({ name: r.name.length > 26 ? r.name.slice(0, 24) + "…" : r.name, color: colors[i], data: months.map((mk) => r.items.filter((c) => c.fTramitacion?.startsWith(mk)).length) })));
  }, [shown, ref, t]);

  const cols: Column<Row>[] = [
    { key: "name", header: "Usuario", width: "minmax(220px,1.6fr)", cell: (r) => <span className="flex items-center gap-2"><span className="truncate font-medium text-ink">{r.name}</span>{r.name !== r.email && <span className="truncate text-ink-3">{r.email}</span>}</span>, sort: (r) => r.name.toLowerCase(), search: (r) => `${r.name} ${r.email}` },
    { key: "cat", header: "Categoría", width: 150, cell: (r) => <Badge>{OWNER_CATEGORY_LABEL[r.cat]}</Badge>, sort: (r) => r.cat },
    { key: "n", header: "Contratos", align: "right", width: 92, cell: (r) => fmtInt(r.n), sort: (r) => r.n },
    { key: "periodo", header: w.explicit ? "Período" : "Este mes", align: "right", width: 86, cell: (r) => fmtInt(r.periodo), sort: (r) => r.periodo },
    { key: "d", header: "vs anterior", align: "right", width: 116, cell: (r) => <Delta value={growth(r.periodo, r.prev)} />, sort: (r) => growth(r.periodo, r.prev) },
    { key: "activados", header: "Activados", align: "right", width: 88, cell: (r) => fmtInt(r.activados), sort: (r) => r.activados },
    { key: "pendientes", header: "Pendientes", align: "right", width: 92, cell: (r) => fmtInt(r.pendientes), sort: (r) => r.pendientes },
    { key: "anulados", header: "Bajas/anul.", align: "right", width: 94, cell: (r) => fmtInt(r.anulados), sort: (r) => r.anulados },
    { key: "mwh", header: "Cartera MWh", align: "right", width: 104, cell: (r) => fmtInt(r.mwh), sort: (r) => r.mwh },
    { key: "comision", header: "Comisiones", align: "right", width: 108, cell: (r) => fmtEur(r.comision), sort: (r) => r.comision },
    { key: "edit", header: "", width: 48, cell: (r) => <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}><OwnerEditor email={r.email} /></div> },
  ];

  if (empty) return <NoData />;
  if (!rows.length) return <FilteredEmpty />;

  return (
    <div className="grid gap-4">
      <PageIntro title="Comerciales y colaboradores">
        Rendimiento por <b className="font-medium text-ink-2">usuario propietario</b> del CRM. No se asume que todos sean comerciales: asigna nombre y categoría a cada correo con el lápiz. Un contrato con dos propietarios cuenta para ambos ({fmtInt(table.reduce((a, r) => a + r.shared, 0))} asignaciones compartidas).
      </PageIntro>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented ariaLabel="Categoría de usuario" value={cat} onChange={setCat} options={[{ value: "todos", label: "Todos" }, { value: "interno", label: "Internos" }, { value: "colaborador", label: "Colaboradores" }, { value: "administrativa", label: "Administrativas" }, { value: "sin_clasificar", label: "Sin clasificar" }]} />
        <Segmented ariaLabel="Métrica leaderboard" value={metric} onChange={setMetric} options={(Object.keys(METRIC_LABEL) as Metric[]).map((k) => ({ value: k, label: METRIC_LABEL[k] }))} />
      </div>

      {podium.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {podium.map((r, i) => (
            <motion.button
              key={r.email}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => openDrawer(`Contratos de ${r.name}`, r.items.map((c) => c.id))}
              className="panel group relative overflow-hidden p-5 text-left transition-[border-color] hover:border-line-strong"
            >
              <div aria-hidden className="absolute -right-6 -top-8 text-[120px] font-bold leading-none tracking-[-0.06em] text-[color-mix(in_oklab,var(--text)_5%,transparent)]">{i + 1}</div>
              <div className="flex items-center gap-2 text-[12.5px] text-ink-3">
                <Trophy size={14} className={i === 0 ? "text-brand" : "text-ink-3"} /> {i === 0 ? "Primera posición" : i === 1 ? "Segunda posición" : "Tercera posición"} · {METRIC_LABEL[metric].toLowerCase()}
              </div>
              <div className="relative mt-3 truncate text-[17px] font-semibold tracking-[-0.02em]">{r.name}</div>
              <div className="text-[12px] text-ink-3">{OWNER_CATEGORY_LABEL[r.cat]}</div>
              <div className="relative mt-4 flex items-end justify-between">
                <div className="text-[32px] font-semibold leading-none tracking-[-0.04em] tabular">{fmtVal(r)}</div>
                <div className="text-right text-[12px] text-ink-3">
                  <div>{fmtInt(r.n)} contratos</div>
                  <div>{fmtInt(r.activos)} activados o comisionados</div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-12">
        <Panel title="Leaderboard" subtitle={`${METRIC_LABEL[metric]} · clic para filtrar todo el panel`} className="xl:col-span-6">
          <ol className="grid gap-1">
            {shown.slice(0, 15).map((r, i) => (
              <li key={r.email}>
                <button onClick={() => toggle("owners", r.email)} className={cx("w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-hover", filters.owners.length && !filters.owners.includes(r.email) && "opacity-45")} aria-pressed={filters.owners.includes(r.email)}>
                  <div className="flex items-center gap-3 text-[12.5px]">
                    <span className={cx("grid h-6 w-6 shrink-0 place-items-center rounded-md text-[11px] font-semibold tabular", i < 3 ? "bg-brand-soft text-brand" : "bg-surface-2 text-ink-3")}>{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
                    <span className="hidden text-[11.5px] text-ink-3 sm:inline">{OWNER_CATEGORY_LABEL[r.cat]}</span>
                    <span className="w-20 text-right font-semibold tabular">{fmtVal(r)}</span>
                  </div>
                  <div className="ml-9 mt-1.5 h-[5px] overflow-hidden rounded-full bg-surface-3">
                    <motion.div className="h-full rounded-full" style={{ background: i < 3 ? "var(--brand)" : "var(--s1)" }} initial={{ width: 0 }} animate={{ width: `${(Math.max(0, val(r)) / max) * 100}%` }} transition={{ duration: 0.7, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }} />
                  </div>
                </button>
              </li>
            ))}
          </ol>
          {metric === "conversion" && <p className="mt-2 text-[11.5px] text-ink-3">Tasa = (activados + comisionados) / contratos aportados. Solo se calcula con al menos 5 contratos resueltos.</p>}
        </Panel>
        <Panel title="Evolución de altas · top 4" subtitle="Últimos 12 meses, por fecha de tramitación" className="xl:col-span-6">
          <EChart option={evo} height={640} ariaLabel="Evolución de altas de los cuatro primeros usuarios" />
        </Panel>
      </div>

      <Panel title="Rendimiento detallado" subtitle="Ordena por cualquier columna · clic para ver sus contratos">
        <DataTable rows={shown} columns={cols} rowKey={(r) => r.email} onRowClick={(r) => openDrawer(`Contratos de ${r.name}`, r.items.map((c) => c.id))} initialSort={{ key: "n", dir: "desc" }} height={640} />
      </Panel>
    </div>
  );
}
