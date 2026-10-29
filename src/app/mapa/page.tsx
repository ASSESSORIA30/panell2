"use client";
import { useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { useData } from "@/lib/useData";
import { useStore } from "@/lib/store";
import { clientKeyOf, commissionOf, countBy, ranked, sum } from "@/lib/metrics";
import { PROVINCES } from "@/lib/provinces";
import { fmtEur, fmtInt, fmtShare } from "@/lib/format";
import { SEQ_BLUE } from "@/lib/palette";
import { EChart } from "@/components/charts/EChart";
import { font, tipRow, tipTitle, tooltip } from "@/components/charts/base";
import { FilteredEmpty, NoData, PageIntro, RankBars } from "@/components/ui/kpi";
import { Notice, Panel, Segmented } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/DataTable";
import type { Contract } from "@/lib/types";

type Metric = "contratos" | "clientes" | "mwh" | "comision";
const METRIC_LABEL: Record<Metric, string> = { contratos: "Contratos", clientes: "Clientes", mwh: "MWh (luz + gas)", comision: "Comisiones" };

interface ProvRow {
  key: string;
  items: Contract[];
  n: number;
  clientes: number;
  activos: number;
  mwh: number;
  comision: number;
  municipios: number;
}

/** Tramos por cuantiles de los valores no nulos (escala secuencial de un solo tono). */
function pieces(values: number[], colors: string[], empty: string, fmt: (n: number) => string) {
  const nz = values.filter((v) => v > 0).sort((a, b) => a - b);
  const out: { min: number; max: number; color: string; label: string }[] = [{ min: 0, max: 0, color: empty, label: "Sin datos" }];
  if (!nz.length) return out;
  const qs = [0.2, 0.4, 0.6, 0.8].map((q) => nz[Math.floor(q * (nz.length - 1))]);
  const bounds = [...new Set([nz[0] - 1, ...qs, nz[nz.length - 1]])].sort((a, b) => a - b);
  const steps = bounds.length - 1;
  for (let i = 0; i < steps; i++) {
    const lo = bounds[i] + 1, hi = bounds[i + 1];
    if (lo > hi) continue;
    const color = colors[Math.round((i / Math.max(1, steps - 1)) * (colors.length - 1))];
    out.push({ min: lo, max: hi, color, label: lo === hi ? fmt(lo) : `${fmt(lo)} – ${fmt(hi)}` });
  }
  return out;
}

export default function MapaPage() {
  const { rows, settings, tokens: t, filters, empty } = useData();
  const toggle = useStore((s) => s.toggleFilter);
  const openDrawer = useStore((s) => s.openDrawer);
  const [metric, setMetric] = useState<Metric>("contratos");
  const [mapH, setMapH] = useState(520);
  useEffect(() => {
    const f = () => setMapH(window.innerWidth < 640 ? 330 : 520);
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  const factor = settings.consumoUnit === "kWh" ? 1 / 1000 : 1;

  const provs: ProvRow[] = useMemo(
    () =>
      ranked(countBy(rows, (c) => c.provincia ?? "Sin provincia")).map((r) => ({
        key: r.key,
        items: r.items,
        n: r.n,
        clientes: new Set(r.items.map(clientKeyOf)).size,
        activos: r.items.filter((c) => c.estado === "activado" || c.estado === "comisionado").length,
        mwh: sum(r.items.filter((c) => c.tipo === "luz" || c.tipo === "gas"), (c) => c.consumo) * factor,
        comision: sum(r.items, (c) => commissionOf(c, settings.commissionMode === "none" ? "sum" : settings.commissionMode)),
        municipios: new Set(r.items.map((c) => c.poblacion)).size,
      })),
    [rows, factor, settings.commissionMode],
  );
  const val = (r: ProvRow) => (metric === "contratos" ? r.n : metric === "clientes" ? r.clientes : metric === "mwh" ? r.mwh : r.comision);
  const fmtV = (n: number) => (metric === "comision" ? fmtEur(n) : metric === "mwh" ? `${fmtInt(n)} MWh` : fmtInt(n));

  const option = useMemo<EChartsOption>(() => {
    const byName = new Map(provs.map((p) => [p.key, p]));
    const data = Object.entries(PROVINCES).map(([code, name]) => {
      const p = byName.get(name);
      return { name: code, value: p ? Math.round(val(p)) : 0, prov: name, n: p?.n ?? 0 };
    });
    const selCodes = new Set(Object.entries(PROVINCES).filter(([, n]) => filters.provincias.includes(n)).map(([c]) => c));
    return {
      tooltip: tooltip(t, {
        trigger: "item",
        formatter: (p: { data?: { prov: string; value: number; n: number } }) =>
          p.data ? tipTitle(p.data.prov, t) + tipRow(SEQ_BLUE[7], METRIC_LABEL[metric], fmtV(p.data.value), t) + (metric !== "contratos" ? tipRow("transparent", "Contratos", fmtInt(p.data.n), t) : "") + `<div style="color:${t.text3};font-size:11px;margin-top:4px">Clic para filtrar</div>` : "",
      }),
      visualMap: {
        type: "piecewise",
        pieces: pieces(data.map((d) => d.value), t.mode === "dark" ? [SEQ_BLUE[11], SEQ_BLUE[9], SEQ_BLUE[7], SEQ_BLUE[5], SEQ_BLUE[2]] : [SEQ_BLUE[1], SEQ_BLUE[3], SEQ_BLUE[6], SEQ_BLUE[8], SEQ_BLUE[11]], t.mode === "dark" ? "#1c1f25" : "#eef0f3", fmtV),
        left: 8,
        bottom: 8,
        itemWidth: 12,
        itemHeight: 10,
        textStyle: { color: t.text3, fontFamily: font, fontSize: 11 },
      },
      series: [
        {
          type: "map",
          map: "spain",
          nameProperty: "code",
          roam: false,
          aspectScale: 0.82,
          layoutCenter: ["52%", "50%"],
          layoutSize: "112%",
          selectedMode: false,
          itemStyle: { borderColor: t.mode === "dark" ? "#0b0c0f" : "#ffffff", borderWidth: 0.8, areaColor: t.surface2 },
          emphasis: { label: { show: false }, itemStyle: { areaColor: t.brand, borderColor: t.text, borderWidth: 1 } },
          data: data.map((d) => ({ ...d, itemStyle: selCodes.has(d.name) ? { borderColor: t.brand, borderWidth: 2 } : undefined })),
        },
      ],
    } as unknown as EChartsOption;
  }, [provs, metric, t, filters.provincias]); // eslint-disable-line react-hooks/exhaustive-deps

  const munis = useMemo(() => ranked(countBy(rows, (c) => c.poblacion ?? "Sin población")).map((r) => ({ key: r.key, label: r.key, value: r.n, sub: r.items[0].provincia ?? "", color: SEQ_BLUE[6], ids: r.items.map((c) => c.id) })), [rows]);
  const provRank = [...provs].sort((a, b) => val(b) - val(a)).map((p) => ({ key: p.key, label: p.key, value: val(p), color: SEQ_BLUE[7] }));

  const cols: Column<ProvRow>[] = [
    { key: "key", header: "Provincia", width: "minmax(160px,1.4fr)", cell: (r) => <span className="font-medium text-ink">{r.key}</span>, sort: (r) => r.key, search: (r) => r.key },
    { key: "n", header: "Contratos", align: "right", width: 96, cell: (r) => fmtInt(r.n), sort: (r) => r.n },
    { key: "share", header: "Cuota", align: "right", width: 80, cell: (r) => fmtShare((r.n / rows.length) * 100), sort: (r) => r.n },
    { key: "clientes", header: "Clientes", align: "right", width: 90, cell: (r) => fmtInt(r.clientes), sort: (r) => r.clientes },
    { key: "municipios", header: "Municipios", align: "right", width: 96, cell: (r) => fmtInt(r.municipios), sort: (r) => r.municipios },
    { key: "act", header: "% activos", align: "right", width: 92, cell: (r) => fmtShare((r.activos / r.n) * 100), sort: (r) => r.activos / r.n },
    { key: "mwh", header: "MWh", align: "right", width: 96, cell: (r) => fmtInt(r.mwh), sort: (r) => r.mwh },
    { key: "comision", header: "Comisiones", align: "right", width: 110, cell: (r) => fmtEur(r.comision), sort: (r) => r.comision },
  ];

  if (empty) return <NoData />;
  if (!rows.length) return <FilteredEmpty />;

  const out = rows.filter((c) => !c.provinciaCode).length;

  return (
    <div className="grid gap-4">
      <PageIntro title="Mapa de negocio" actions={<Segmented ariaLabel="Métrica del mapa" value={metric} onChange={setMetric} options={(Object.keys(METRIC_LABEL) as Metric[]).map((k) => ({ value: k, label: METRIC_LABEL[k] }))} />}>
        Reparto por provincia deducida del código postal. Pulsa una provincia o un municipio para filtrar todos los módulos.
      </PageIntro>
      <div className="grid gap-4 xl:grid-cols-12">
        <Panel title={`${METRIC_LABEL[metric]} por provincia`} subtitle="Escala por tramos de concentración · Canarias desplazada para mayor legibilidad" className="xl:col-span-8">
          <EChart option={option} height={mapH} ariaLabel={`Mapa de España: ${METRIC_LABEL[metric]} por provincia`} onClick={(p) => { const name = PROVINCES[(p.name as string) ?? ""]; if (name) toggle("provincias", name); }} />
          <div className="mt-2"><Notice>Solo se agregan provincias y municipios. No se representan direcciones ni se infieren coordenadas de domicilios.{out ? ` ${fmtInt(out)} contratos sin provincia reconocible quedan fuera del mapa.` : ""}</Notice></div>
        </Panel>
        <div className="grid gap-4 xl:col-span-4">
          <Panel title="Ranking de provincias">
            <RankBars items={provRank} max={10} format={fmtV} onSelect={(k) => toggle("provincias", k)} selected={filters.provincias} />
          </Panel>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-12">
        <Panel title="Ranking de municipios" subtitle="Contratos por población · clic para filtrar" className="xl:col-span-5">
          <RankBars items={munis} max={15} onSelect={(k) => toggle("municipios", k)} selected={filters.municipios} />
        </Panel>
        <Panel title="Comparativa territorial" subtitle="Clic en una fila para ver los contratos de la provincia" className="xl:col-span-7">
          <DataTable rows={provs} columns={cols} rowKey={(r) => r.key} onRowClick={(r) => openDrawer(`Contratos en ${r.key}`, r.items.map((c) => c.id))} initialSort={{ key: "n", dir: "desc" }} height={560} />
        </Panel>
      </div>
    </div>
  );
}
