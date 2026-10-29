"use client";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useData } from "@/lib/useData";
import { useStore } from "@/lib/store";
import { applyFilters, commissionOf, countBy, growth, hasCommission, inWindow, ownerLabel, PENDING_STATES, previousWindow, currentWindow, ranked, sum } from "@/lib/metrics";
import { addMonths, fmtMonth, monthRange } from "@/lib/dates";
import { fmtEur, fmtInt, fmtShare } from "@/lib/format";
import { estadoColor, tipoColor } from "@/lib/palette";
import { ESTADOS } from "@/lib/normalize";
import { EChart } from "@/components/charts/EChart";
import { barsOption, linesOption } from "@/components/charts/builders";
import { FilteredEmpty, KpiTile, NoData, PageIntro, RankBars } from "@/components/ui/kpi";
import { Button, cx, Delta, Panel, Segmented } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/DataTable";
import type { Contract } from "@/lib/types";

type Metric = "contratos" | "activados" | "consumo" | "comision";

interface Row {
  key: string;
  items: Contract[];
  n: number;
  mes: number;
  prev: number;
  activados: number;
  pendientes: number;
  mwhLuz: number;
  mwhGas: number;
  comision: number;
  share: number;
}

export default function ComercializadorasPage() {
  const { all, rows, filters, settings, tokens: t, comColors, ref, empty } = useData();
  const toggle = useStore((s) => s.toggleFilter);
  const [metric, setMetric] = useState<Metric>("contratos");
  const [sel, setSel] = useState<string | null>(null);
  const factor = settings.consumoUnit === "kWh" ? 1 / 1000 : 1;

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("c");
    if (q) setSel(q);
  }, []);

  const base = useMemo(() => applyFilters(all, filters, settings.dateBasis, "date"), [all, filters, settings.dateBasis]);
  const w = currentWindow(filters, ref);
  const pw = previousWindow(w);

  const table: Row[] = useMemo(() => {
    const b = settings.dateBasis;
    const baseBy = countBy(base, (c) => c.comercializadora);
    return ranked(countBy(rows, (c) => c.comercializadora)).map((r) => {
      const bi = baseBy.get(r.key) ?? [];
      return {
        key: r.key,
        items: r.items,
        n: r.n,
        mes: bi.filter((c) => inWindow(c[b], w)).length,
        prev: bi.filter((c) => inWindow(c[b], pw)).length,
        activados: r.items.filter((c) => c.estado === "activado").length,
        pendientes: r.items.filter((c) => PENDING_STATES.includes(c.estado)).length,
        mwhLuz: sum(r.items.filter((c) => c.tipo === "luz"), (c) => c.consumo) * factor,
        mwhGas: sum(r.items.filter((c) => c.tipo === "gas"), (c) => c.consumo) * factor,
        comision: sum(r.items, (c) => commissionOf(c, settings.commissionMode === "none" ? "sum" : settings.commissionMode)),
        share: (r.n / rows.length) * 100,
      };
    });
  }, [rows, base, settings, w, pw, factor]);

  const rankItems = useMemo(() => {
    const val = (r: Row) => (metric === "contratos" ? r.n : metric === "activados" ? r.activados : metric === "consumo" ? r.mwhLuz + r.mwhGas : r.comision);
    return [...table].sort((a, b) => val(b) - val(a)).map((r) => ({ key: r.key, label: r.key, value: val(r), color: comColors[r.key] }));
  }, [table, metric, comColors]);

  const evo = useMemo(() => {
    const months = monthRange(addMonths(ref, -11), ref);
    const top = table.slice(0, 5);
    return linesOption(t, months.map(fmtMonth), top.map((r) => ({ name: r.key, color: comColors[r.key], data: months.map((mk) => base.filter((c) => c.comercializadora === r.key && c.fTramitacion?.startsWith(mk)).length) })));
  }, [table, base, ref, t, comColors]);

  const compare = useMemo(() => {
    const top = table.slice(0, 8);
    return barsOption(t, top.map((r) => r.key), ESTADOS.filter((e) => ["activado", "comisionado", "tramitado", "firmado", "pendiente"].includes(e.key)).map((e) => ({ name: e.label, color: estadoColor(e.key, settings.theme), data: top.map((r) => r.items.filter((c) => c.estado === e.key).length) })), { stack: true, horizontal: true, total: true });
  }, [table, t, settings.theme]);

  const cols: Column<Row>[] = [
    { key: "key", header: "Comercializadora", width: "minmax(170px,1.4fr)", cell: (r) => <span className="inline-flex items-center gap-2 font-medium text-ink"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: comColors[r.key] }} />{r.key}</span>, sort: (r) => r.key, search: (r) => r.key },
    { key: "n", header: "Contratos", align: "right", width: 96, cell: (r) => fmtInt(r.n), sort: (r) => r.n },
    { key: "share", header: "Cuota", align: "right", width: 80, cell: (r) => fmtShare(r.share), sort: (r) => r.share },
    { key: "mes", header: w.explicit ? "En período" : "Este mes", align: "right", width: 92, cell: (r) => fmtInt(r.mes), sort: (r) => r.mes },
    { key: "delta", header: "vs anterior", align: "right", width: 120, cell: (r) => <Delta value={growth(r.mes, r.prev)} />, sort: (r) => growth(r.mes, r.prev) },
    { key: "activados", header: "Activados", align: "right", width: 90, cell: (r) => fmtInt(r.activados), sort: (r) => r.activados },
    { key: "pendientes", header: "Pendientes", align: "right", width: 96, cell: (r) => fmtInt(r.pendientes), sort: (r) => r.pendientes },
    { key: "mwhLuz", header: "Luz MWh", align: "right", width: 96, cell: (r) => fmtInt(r.mwhLuz), sort: (r) => r.mwhLuz },
    { key: "mwhGas", header: "Gas MWh", align: "right", width: 92, cell: (r) => fmtInt(r.mwhGas), sort: (r) => r.mwhGas },
    { key: "comision", header: "Comisiones", align: "right", width: 110, cell: (r) => fmtEur(r.comision), sort: (r) => r.comision },
  ];

  if (empty) return <NoData />;
  if (!rows.length) return <FilteredEmpty />;

  const selRow = sel ? table.find((r) => r.key === sel) : null;

  return (
    <div className="grid gap-4">
      <PageIntro title="Ranking de comercializadoras">
        {fmtInt(table.length)} compañías en los datos filtrados. Pulsa cualquiera para abrir su ficha de análisis.
      </PageIntro>
      <div className="grid gap-4 xl:grid-cols-12">
        <Panel
          title="Clasificación"
          subtitle="Barras ordenadas por la métrica elegida"
          className="xl:col-span-5"
          actions={<Segmented size="sm" ariaLabel="Métrica ranking comercializadoras" value={metric} onChange={setMetric} options={[{ value: "contratos", label: "Contratos" }, { value: "activados", label: "Activados" }, { value: "consumo", label: "MWh" }, { value: "comision", label: "€" }]} />}
        >
          <RankBars items={rankItems} max={14} format={metric === "comision" ? (n) => fmtEur(n) : metric === "consumo" ? (n) => `${fmtInt(n)} MWh` : fmtInt} onSelect={(k) => setSel(k === sel ? null : k)} selected={sel ? [sel] : []} />
          {metric === "consumo" && <p className="mt-2 text-[11.5px] text-ink-3">Electricidad y gas se ordenan por su suma solo para clasificar; en la tabla y en la ficha aparecen separados.</p>}
        </Panel>
        <div className="grid gap-4 xl:col-span-7">
          <Panel title="Evolución mensual · top 5" subtitle="Altas por fecha de tramitación, últimos 12 meses">
            <EChart option={evo} height={260} ariaLabel="Evolución mensual de las cinco principales comercializadoras" />
          </Panel>
          <Panel title="Comparación de estados · top 8" subtitle="Situación actual de los contratos de cada compañía">
            <EChart option={compare} height={300} ariaLabel="Estados por comercializadora" onClick={(p) => setSel(table[p.dataIndex]?.key ?? null)} />
          </Panel>
        </div>
      </div>

      <AnimatePresence>
        {selRow && (
          <motion.div key={selRow.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
            <CompanyCard row={selRow} onClose={() => setSel(null)} onFilter={() => toggle("comercializadoras", selRow.key)} filtered={filters.comercializadoras.includes(selRow.key)} />
          </motion.div>
        )}
      </AnimatePresence>

      <Panel title="Tabla comparativa" subtitle="Ordena por cualquier columna · clic en una fila para abrir la ficha">
        <DataTable rows={table} columns={cols} rowKey={(r) => r.key} onRowClick={(r) => { setSel(r.key); window.scrollTo({ top: 0, behavior: "smooth" }); }} initialSort={{ key: "n", dir: "desc" }} height={600} />
      </Panel>
    </div>
  );
}

function CompanyCard({ row, onClose, onFilter, filtered }: { row: Row; onClose: () => void; onFilter: () => void; filtered: boolean }) {
  const { settings, tokens: t, comColors, ref } = useData();
  const m = settings.theme;
  const months = monthRange(addMonths(ref, -11), ref);
  const evo = barsOption(t, months.map(fmtMonth), [
    { name: "Altas", color: comColors[row.key] ?? t.series[0], data: months.map((mk) => row.items.filter((c) => c.fTramitacion?.startsWith(mk)).length) },
    { name: "Activaciones", color: "#0ca30c", data: months.map((mk) => row.items.filter((c) => c.fActivacion?.startsWith(mk)).length) },
  ]);
  const tarifas = ranked(countBy(row.items, (c) => c.tarifa)).map((r) => ({ key: r.key, label: r.key, value: r.n, color: tipoColor(r.items[0].tipo, m) }));
  const owners = ranked(countBy(row.items, (c) => c.owners)).map((r) => ({ key: r.key, label: ownerLabel(r.key, settings), value: r.n, color: comColors[row.key] }));
  const estados = ESTADOS.map((e) => ({ key: e.key, label: e.label, value: row.items.filter((c) => c.estado === e.key).length, color: estadoColor(e.key, m) })).filter((x) => x.value);
  return (
    <section className="panel overflow-hidden">
      <div className="h-[3px]" style={{ background: comColors[row.key] }} />
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <div>
          <p className="text-[12.5px] text-ink-3">Ficha de análisis</p>
          <h3 className="text-[22px] font-semibold tracking-[-0.03em]">{row.key}</h3>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={filtered ? "primary" : "secondary"} onClick={onFilter}>{filtered ? "Filtrando todo el panel" : "Filtrar todo el panel"}</Button>
          <Button size="sm" variant="ghost" onClick={onClose} ariaLabel="Cerrar ficha"><X size={15} /></Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 p-5 md:grid-cols-3 xl:grid-cols-6">
        <KpiTile label="Contratos" value={row.n} ids={row.items.map((c) => c.id)} drawerTitle={`Contratos de ${row.key}`} hint={`${fmtShare(row.share)} del total`} />
        <KpiTile label="Activados" value={row.activados} ids={row.items.filter((c) => c.estado === "activado").map((c) => c.id)} drawerTitle={`${row.key} · activados`} />
        <KpiTile label="Pendientes" value={row.pendientes} ids={row.items.filter((c) => PENDING_STATES.includes(c.estado)).map((c) => c.id)} drawerTitle={`${row.key} · pendientes`} />
        <KpiTile label="Electricidad" value={row.mwhLuz} format={(n) => `${fmtInt(n)} MWh`} />
        <KpiTile label="Gas" value={row.mwhGas} format={(n) => `${fmtInt(n)} MWh`} />
        <KpiTile label="Comisiones registradas" value={row.comision} format={(n) => fmtEur(n)} ids={row.items.filter(hasCommission).map((c) => c.id)} drawerTitle={`${row.key} · con comisión`} />
      </div>
      <div className="grid gap-5 border-t border-line p-5 xl:grid-cols-12">
        <div className="xl:col-span-6">
          <h4 className="mb-2 text-[13px] font-semibold">Altas y activaciones · 12 meses</h4>
          <EChart option={evo} height={240} ariaLabel={`Evolución mensual de ${row.key}`} />
        </div>
        <div className="xl:col-span-3">
          <h4 className="mb-2 text-[13px] font-semibold">Tarifas</h4>
          <RankBars items={tarifas} max={6} />
        </div>
        <div className="xl:col-span-3">
          <h4 className="mb-2 text-[13px] font-semibold">Comerciales</h4>
          <RankBars items={owners} max={6} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-line px-5 py-4">
        {estados.map((e) => (
          <span key={e.key} className={cx("inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[12px] text-ink-2")}>
            <span className="h-2 w-2 rounded-[2px]" style={{ background: e.color }} />
            {e.label} <b className="tabular text-ink">{fmtInt(e.value)}</b>
          </span>
        ))}
      </div>
    </section>
  );
}
