"use client";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useData } from "@/lib/useData";
import { useStore } from "@/lib/store";
import { countBy, dateExtent, ranked } from "@/lib/metrics";
import { daysBetween, monthRange, MONTHS_ES, fmtMonth, addMonths } from "@/lib/dates";
import { fmtInt } from "@/lib/format";
import { estadoColor, tipoColor, SERIES } from "@/lib/palette";
import { ESTADO_LABEL, ESTADOS, TIPO_LABEL } from "@/lib/normalize";
import { TimelinePanel } from "@/components/charts/TimelinePanel";
import { EChart } from "@/components/charts/EChart";
import { barsOption, donutOption, linesOption } from "@/components/charts/builders";
import { FilteredEmpty, NoData, PageIntro, RankBars } from "@/components/ui/kpi";
import { Button, Notice, Panel, Segmented, Stat } from "@/components/ui/primitives";
import { DataTable } from "@/components/ui/DataTable";
import { contractColumns } from "@/components/contracts/columns";
import { exportContracts } from "@/lib/export";
import type { DateBasis } from "@/lib/types";

const BUCKETS = [
  { label: "0–7 días", max: 7 },
  { label: "8–15", max: 15 },
  { label: "16–30", max: 30 },
  { label: "31–60", max: 60 },
  { label: "61–90", max: 90 },
  { label: "91–180", max: 180 },
  { label: "> 180", max: Infinity },
];

export default function ContratosPage() {
  const { rows, settings, tokens: t, comColors, filters, ref, empty } = useData();
  const toggle = useStore((s) => s.toggleFilter);
  const openDrawer = useStore((s) => s.openDrawer);
  const openContract = useStore((s) => s.openContract);
  const unlocked = useStore((s) => s.sensitiveUnlocked);
  const [yearField, setYearField] = useState<DateBasis>("fTramitacion");
  const m = settings.theme;

  const annual = useMemo(() => {
    const years = new Set<string>();
    for (const c of rows) for (const f of ["fTramitacion", "fActivacion", "fBaja"] as const) if (c[f]) years.add(c[f]!.slice(0, 4));
    const ys = [...years].sort();
    const cnt = (f: DateBasis) => ys.map((y) => rows.filter((c) => c[f]?.startsWith(y)).length);
    return barsOption(t, ys, [
      { name: "Altas (tramitación)", data: cnt("fTramitacion"), color: t.series[0] },
      { name: "Activaciones", data: cnt("fActivacion"), color: t.series[2] },
      { name: "Bajas", data: cnt("fBaja"), color: t.series[7] },
    ]);
  }, [rows, t]);

  const yoy = useMemo(() => {
    const byYear = new Map<string, number[]>();
    for (const c of rows) {
      const d = c[yearField];
      if (!d) continue;
      const y = d.slice(0, 4);
      if (!byYear.has(y)) byYear.set(y, Array(12).fill(0));
      byYear.get(y)![+d.slice(5, 7) - 1]++;
    }
    const ys = [...byYear.keys()].sort().slice(-4); // máx. 4 años para legibilidad
    return linesOption(t, MONTHS_ES, ys.map((y, i) => ({ name: y, data: byYear.get(y)!, color: i === ys.length - 1 ? t.brand : t.series[[0, 2, 6][i % 3]], dashed: i < ys.length - 2 })));
  }, [rows, t, yearField]);

  const lead = useMemo(() => {
    const ds = rows.filter((c) => c.fTramitacion && c.fActivacion).map((c) => ({ id: c.id, d: daysBetween(c.fTramitacion!, c.fActivacion!) })).filter((x) => x.d >= 0);
    const neg = rows.filter((c) => c.fTramitacion && c.fActivacion && daysBetween(c.fTramitacion, c.fActivacion) < 0).length;
    const sorted = ds.map((x) => x.d).sort((a, b) => a - b);
    const q = (p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : null);
    const ids = BUCKETS.map(() => [] as string[]);
    for (const x of ds) ids[BUCKETS.findIndex((b) => x.d <= b.max)].push(x.id);
    return { n: ds.length, neg, median: q(0.5), p90: q(0.9), mean: sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : null, ids, option: barsOption(t, BUCKETS.map((b) => b.label), [{ name: "Contratos", data: ids.map((x) => x.length), color: t.series[2] }], { legend: false }) };
  }, [rows, t]);

  const netFlow = useMemo(() => {
    const ext = dateExtent(rows, "fTramitacion");
    if (!ext) return null;
    const from = ext.min < addMonths(ref, -18) ? addMonths(ref, -18) : ext.min;
    const months = monthRange(from, ref);
    const alt = months.map((mk) => rows.filter((c) => c.fTramitacion?.startsWith(mk)).length);
    const baj = months.map((mk) => -rows.filter((c) => c.fBaja?.startsWith(mk)).length);
    const opt = barsOption(t, months.map(fmtMonth), [
      { name: "Altas", data: alt, color: t.series[0] },
      { name: "Bajas", data: baj, color: t.series[7] },
    ], { stack: true, fmt: (n) => fmtInt(Math.abs(n)) });
    return opt;
  }, [rows, t, ref]);

  const estados = useMemo(() => ESTADOS.map((e) => ({ name: e.label, key: e.key, value: rows.filter((c) => c.estado === e.key).length, color: estadoColor(e.key, m) })).filter((x) => x.value), [rows, m]);
  const tipos = useMemo(() => ranked(countBy(rows, (c) => c.tipo)).map((r) => ({ key: r.key, label: TIPO_LABEL[r.key as keyof typeof TIPO_LABEL], value: r.n, color: tipoColor(r.key as never, m) })), [rows, m]);
  const tarifas = useMemo(() => ranked(countBy(rows, (c) => c.tarifa)).map((r) => ({ key: r.key, label: r.key, value: r.n, color: tipoColor(r.items[0].tipo, m) })), [rows, m]);
  const coms = useMemo(() => ranked(countBy(rows, (c) => c.comercializadora)).map((r) => ({ key: r.key, label: r.key, value: r.n, color: comColors[r.key] })), [rows, comColors]);
  const provs = useMemo(() => ranked(countBy(rows, (c) => c.provincia ?? "Sin provincia")).map((r) => ({ key: r.key, label: r.key, value: r.n, color: SERIES[m][0] })), [rows, m]);
  const cols = useMemo(() => contractColumns(settings, comColors), [settings, comColors]);

  if (empty) return <NoData />;
  if (!rows.length) return <FilteredEmpty />;

  return (
    <div className="grid gap-4">
      <PageIntro title="Analítica de contratos">
        Cuatro fechas distintas, nunca mezcladas: <b className="font-medium text-ink-2">carterización/tramitación</b> (alta comercial), <b className="font-medium text-ink-2">activación</b> (suministro en marcha), <b className="font-medium text-ink-2">baja</b> y <b className="font-medium text-ink-2">traspaso</b> (registro en el CRM).
      </PageIntro>
      <TimelinePanel />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Evolución anual" subtitle="Altas, activaciones y bajas por año natural">
          <EChart option={annual} height={280} ariaLabel="Evolución anual de altas, activaciones y bajas" />
        </Panel>
        <Panel title="Comparativa entre años" subtitle="Mismo mes, distintos años" actions={<Segmented size="sm" ariaLabel="Fecha comparativa" value={yearField} onChange={setYearField} options={[{ value: "fTramitacion", label: "Altas" }, { value: "fActivacion", label: "Activaciones" }]} />}>
          <EChart option={yoy} height={280} ariaLabel="Comparativa mensual entre años" />
        </Panel>
      </div>
      <div className="grid gap-4 xl:grid-cols-12">
        <Panel title="Nuevos contratos frente a bajas" subtitle="Últimos 18 meses · altas por tramitación, bajas por fecha de baja" className="xl:col-span-7">
          {netFlow && <EChart option={netFlow} height={280} ariaLabel="Altas frente a bajas por mes" />}
        </Panel>
        <Panel title="Distribución por estado" subtitle="Clic para filtrar" className="xl:col-span-5">
          <div className="grid items-center gap-2 sm:grid-cols-[1fr_1fr]">
            <EChart option={donutOption(t, estados, { value: fmtInt(rows.length), label: "contratos" })} height={230} ariaLabel="Distribución por estado" onClick={(p) => toggle("estados", estados[p.dataIndex].key)} />
            <ul className="grid gap-0.5 text-[12.5px]">
              {estados.map((e) => (
                <li key={e.key} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: e.color }} />
                  <span className="flex-1 text-ink-2">{ESTADO_LABEL[e.key]}</span>
                  <span className="font-semibold tabular">{fmtInt(e.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>
      <Panel title="Tiempo entre tramitación y activación" subtitle={`${fmtInt(lead.n)} contratos con ambas fechas${lead.neg ? ` · ${lead.neg} con activación anterior a la tramitación (excluidos)` : ""}`}>
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <div className="grid grid-cols-3 gap-4 lg:grid-cols-1">
            <Stat label="Mediana" value={lead.median === null ? "—" : `${lead.median} días`} />
            <Stat label="Media" value={lead.mean === null ? "—" : `${Math.round(lead.mean)} días`} />
            <Stat label="Percentil 90" value={lead.p90 === null ? "—" : `${lead.p90} días`} hint="el 90 % se activa antes" />
          </div>
          <EChart option={lead.option} height={240} ariaLabel="Distribución de días entre tramitación y activación" onClick={(p) => openDrawer(`Activados en ${BUCKETS[p.dataIndex].label}`, lead.ids[p.dataIndex])} />
        </div>
      </Panel>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Panel title="Por tipo de producto"><RankBars items={tipos} onSelect={(k) => toggle("tipos", k as never)} selected={filters.tipos} /></Panel>
        <Panel title="Por tarifa"><RankBars items={tarifas} max={12} onSelect={(k) => toggle("tarifas", k)} selected={filters.tarifas} /></Panel>
        <Panel title="Por comercializadora"><RankBars items={coms} max={12} onSelect={(k) => toggle("comercializadoras", k)} selected={filters.comercializadoras} /></Panel>
        <Panel title="Por provincia"><RankBars items={provs} max={12} onSelect={(k) => toggle("provincias", k)} selected={filters.provincias} /></Panel>
      </div>
      <Panel
        title="Registros"
        subtitle="Todos los contratos que cumplen los filtros. Clic en una fila para abrir la ficha."
        actions={
          <>
            <Button size="sm" onClick={() => exportContracts(rows, settings, "csv", "contratos", unlocked && settings.role === "admin")}><Download size={13} /> CSV</Button>
            <Button size="sm" onClick={() => exportContracts(rows, settings, "xlsx", "contratos", unlocked && settings.role === "admin")}><Download size={13} /> Excel</Button>
          </>
        }
      >
        <DataTable rows={rows} columns={cols} rowKey={(c) => c.id} onRowClick={(c) => openContract(c.id)} initialSort={{ key: "fTramitacion", dir: "desc" }} placeholder="Buscar cliente, CUPS, producto, municipio…" />
        {!(unlocked && settings.role === "admin") && <div className="mt-3"><Notice>Las exportaciones enmascaran CIF, teléfono, correo e IBAN salvo que un administrador haya desbloqueado los datos sensibles.</Notice></div>}
      </Panel>
    </div>
  );
}
