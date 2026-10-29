"use client";
import { useMemo, useState } from "react";
import { useData } from "@/lib/useData";
import { useStore } from "@/lib/store";
import { countBy, hasCommission, ownerLabel, sum } from "@/lib/metrics";
import { addMonths, fmtMonth, monthRange } from "@/lib/dates";
import { fmtEur, fmtInt } from "@/lib/format";
import { ESTADOS } from "@/lib/normalize";
import { EChart } from "@/components/charts/EChart";
import { barsOption } from "@/components/charts/builders";
import { FilteredEmpty, KpiTile, NoData, PageIntro } from "@/components/ui/kpi";
import { Notice, Panel, Segmented } from "@/components/ui/primitives";
import { DataTable } from "@/components/ui/DataTable";
import { contractColumns } from "@/components/contracts/columns";
import type { Contract, DateBasis } from "@/lib/types";

const AMOUNT_BUCKETS = [
  { label: "< 50 €", max: 50 },
  { label: "50–100", max: 100 },
  { label: "100–200", max: 200 },
  { label: "200–500", max: 500 },
  { label: "500–1.000", max: 1000 },
  { label: "> 1.000 €", max: Infinity },
];

export default function ComisionesPage() {
  const { rows, settings, tokens: t, ref, comColors, empty } = useData();
  const openDrawer = useStore((s) => s.openDrawer);
  const openContract = useStore((s) => s.openContract);
  const toggle = useStore((s) => s.toggleFilter);
  const [field, setField] = useState<DateBasis>("fTramitacion");
  const cV = t.series[0], cS = t.series[2];

  const k = useMemo(() => {
    const withAny = rows.filter(hasCommission);
    const v = sum(rows, (c) => c.comisionVenta), s = sum(rows, (c) => c.comisionSubdominio);
    return {
      v, s, withAny,
      nV: rows.filter((c) => c.comisionVenta !== null).length,
      nS: rows.filter((c) => c.comisionSubdominio !== null).length,
      both: rows.filter((c) => c.comisionVenta !== null && c.comisionSubdominio !== null).length,
      sin: rows.filter((c) => !hasCommission(c)),
      sinActivos: rows.filter((c) => !hasCommission(c) && (c.estado === "activado" || c.estado === "comisionado")),
    };
  }, [rows]);

  const split = (groups: Map<string, Contract[]>, top = 10, label: (k: string) => string = (x) => x) => {
    const arr = [...groups.entries()].map(([key, items]) => ({ key, items, v: sum(items, (c) => c.comisionVenta), s: sum(items, (c) => c.comisionSubdominio) })).filter((x) => x.v + x.s > 0).sort((a, b) => b.v + b.s - (a.v + a.s)).slice(0, top);
    return {
      arr,
      option: barsOption(t, arr.map((x) => label(x.key)), [{ name: "Venta", data: arr.map((x) => Math.round(x.v)), color: cV }, { name: "Subdominio", data: arr.map((x) => Math.round(x.s)), color: cS }], { stack: true, horizontal: true, fmt: (n) => fmtEur(n), total: true }),
    };
  };

  const evo = useMemo(() => {
    const months = monthRange(addMonths(ref, -17), ref);
    return barsOption(t, months.map(fmtMonth), [
      { name: "Venta", data: months.map((mk) => Math.round(sum(rows.filter((c) => c[field]?.startsWith(mk)), (c) => c.comisionVenta))), color: cV },
      { name: "Subdominio", data: months.map((mk) => Math.round(sum(rows.filter((c) => c[field]?.startsWith(mk)), (c) => c.comisionSubdominio))), color: cS },
    ], { stack: true, fmt: (n) => fmtEur(n) });
  }, [rows, ref, t, field, cV, cS]);

  const byCom = useMemo(() => split(countBy(rows, (c) => c.comercializadora)), [rows, t]); // eslint-disable-line react-hooks/exhaustive-deps
  const byOwner = useMemo(() => split(countBy(rows, (c) => c.owners), 10, (e) => { const l = ownerLabel(e, settings); return l.length > 22 ? l.slice(0, 20) + "…" : l; }), [rows, t, settings]); // eslint-disable-line react-hooks/exhaustive-deps
  const byTarifa = useMemo(() => split(countBy(rows, (c) => c.tarifa), 12), [rows, t]); // eslint-disable-line react-hooks/exhaustive-deps
  const byEstado = useMemo(() => {
    const arr = ESTADOS.map((e) => ({ e, items: rows.filter((c) => c.estado === e.key) })).filter((x) => x.items.length);
    return barsOption(t, arr.map((x) => x.e.label), [
      { name: "Venta", data: arr.map((x) => Math.round(sum(x.items, (c) => c.comisionVenta))), color: cV },
      { name: "Subdominio", data: arr.map((x) => Math.round(sum(x.items, (c) => c.comisionSubdominio))), color: cS },
    ], { stack: true, horizontal: true, total: true, fmt: (n) => fmtEur(n) });
  }, [rows, t, cV, cS]);
  const dist = useMemo(() => {
    const idsV = AMOUNT_BUCKETS.map(() => [] as string[]), idsS = AMOUNT_BUCKETS.map(() => [] as string[]);
    for (const c of rows) {
      if (c.comisionVenta !== null) idsV[AMOUNT_BUCKETS.findIndex((b) => c.comisionVenta! < b.max)].push(c.id);
      if (c.comisionSubdominio !== null) idsS[AMOUNT_BUCKETS.findIndex((b) => c.comisionSubdominio! < b.max)].push(c.id);
    }
    return { idsV, idsS, option: barsOption(t, AMOUNT_BUCKETS.map((b) => b.label), [{ name: "Importes de venta", data: idsV.map((x) => x.length), color: cV }, { name: "Importes de subdominio", data: idsS.map((x) => x.length), color: cS }]) };
  }, [rows, t, cV, cS]);
  const cols = useMemo(() => contractColumns(settings, comColors), [settings, comColors]);

  if (empty) return <NoData />;
  if (!rows.length) return <FilteredEmpty />;

  const total = settings.commissionMode === "venta" ? k.v : settings.commissionMode === "subdominio" ? k.s : settings.commissionMode === "none" ? null : k.v + k.s;

  return (
    <div className="grid gap-4">
      <PageIntro title="Inteligencia de comisiones">
        Importes <b className="font-medium text-ink-2">registrados</b> en las columnas Comisión venta y Comisión subdominio. El Excel no indica si están cobrados, pendientes de cobro ni sus costes: aquí no se calculan ingresos, márgenes ni rentabilidad.
      </PageIntro>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiTile label="Comisión venta" value={k.v} format={(n) => fmtEur(n)} hint={`${fmtInt(k.nV)} contratos`} ids={rows.filter((c) => c.comisionVenta !== null).map((c) => c.id)} />
        <KpiTile label="Comisión subdominio" value={k.s} format={(n) => fmtEur(n)} hint={`${fmtInt(k.nS)} contratos`} ids={rows.filter((c) => c.comisionSubdominio !== null).map((c) => c.id)} />
        <KpiTile label="Total registrado" value={total} format={(n) => fmtEur(n)} hint={settings.commissionMode === "sum" ? "venta + subdominio" : settings.commissionMode === "none" ? "sin combinar" : `solo ${settings.commissionMode}`} info={`${fmtInt(k.both)} contratos tienen ambos importes y casi nunca coinciden, por eso se tratan como conceptos distintos. Cámbialo en Configuración si representan lo mismo.`} />
        <KpiTile label="Media por contrato con importe" value={k.withAny.length ? (k.v + k.s) / k.withAny.length : null} format={(n) => fmtEur(n)} hint={`${fmtInt(k.withAny.length)} contratos`} />
        <KpiTile label="Sin comisión registrada" value={k.sin.length} ids={k.sin.map((c) => c.id)} hint={`${fmtInt((k.sin.length / rows.length) * 100)} % del total`} />
        <KpiTile label="Activos sin comisión" value={k.sinActivos.length} ids={k.sinActivos.map((c) => c.id)} drawerTitle="Activados o comisionados sin importe" hint="activados o comisionados" info="Contratos en estado Activado o Comisionado sin ningún importe de comisión en el Excel." />
      </div>
      {settings.commissionMode === "none" && <Notice tone="warn">El total combinado está desactivado en Configuración. Se muestran los dos conceptos por separado.</Notice>}

      <Panel title="Evolución de importes registrados" subtitle="Imputados al mes de la fecha elegida · últimos 18 meses" actions={<Segmented size="sm" ariaLabel="Fecha de imputación" value={field} onChange={setField} options={[{ value: "fTramitacion", label: "Tramitación" }, { value: "fActivacion", label: "Activación" }]} />}>
        <EChart option={evo} height={300} ariaLabel="Evolución mensual de comisiones registradas" />
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Por comercializadora" subtitle="Top 10 · clic para filtrar">
          <EChart option={byCom.option} height={360} ariaLabel="Comisiones por comercializadora" onClick={(p) => toggle("comercializadoras", byCom.arr[p.dataIndex].key)} />
        </Panel>
        <Panel title="Por colaborador" subtitle="Usuario propietario · top 10 · clic para filtrar">
          <EChart option={byOwner.option} height={360} ariaLabel="Comisiones por colaborador" onClick={(p) => toggle("owners", byOwner.arr[p.dataIndex].key)} />
        </Panel>
        <Panel title="Por tarifa">
          <EChart option={byTarifa.option} height={360} ariaLabel="Comisiones por tarifa" onClick={(p) => toggle("tarifas", byTarifa.arr[p.dataIndex].key)} />
        </Panel>
        <Panel title="Por estado del contrato" subtitle="«Comisionado» es un estado del CRM, no un cobro confirmado">
          <EChart option={byEstado} height={360} ariaLabel="Comisiones por estado" />
        </Panel>
      </div>
      <Panel title="Distribución de importes" subtitle="Número de importes por tramo · clic para ver los contratos">
        <EChart option={dist.option} height={260} ariaLabel="Distribución de importes de comisión" onClick={(p) => openDrawer(`${p.seriesName} · ${AMOUNT_BUCKETS[p.dataIndex].label}`, (p.seriesIndex === 0 ? dist.idsV : dist.idsS)[p.dataIndex])} />
      </Panel>
      <Panel title="Activados o comisionados sin comisión registrada" subtitle="Posibles importes pendientes de anotar en el CRM">
        <DataTable rows={k.sinActivos} columns={cols} rowKey={(c) => c.id} onRowClick={(c) => openContract(c.id)} height={420} />
      </Panel>
      <p className="text-[11.5px] text-ink-3">La arquitectura está preparada para incorporar liquidaciones y costes reales (supabase/schema.sql, tablas settlements y costs). Hasta entonces no se muestra ninguna cifra de cobro ni de margen.</p>
    </div>
  );
}
