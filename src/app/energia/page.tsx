"use client";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Zap, Flame, Wifi } from "lucide-react";
import { useData } from "@/lib/useData";
import { useStore } from "@/lib/store";
import { countBy, dateExtent, ranked, sum } from "@/lib/metrics";
import { addMonths, fmtMonth, monthRange } from "@/lib/dates";
import { fmtInt } from "@/lib/format";
import { tipoColor, SEQ_BLUE } from "@/lib/palette";
import { EChart } from "@/components/charts/EChart";
import { barsOption } from "@/components/charts/builders";
import { tooltip, tipRow, tipTitle, font } from "@/components/charts/base";
import { FilteredEmpty, KpiTile, NoData, PageIntro, RankBars } from "@/components/ui/kpi";
import { Badge, Notice, Panel, cx } from "@/components/ui/primitives";
import type { Contract, ProductType } from "@/lib/types";
import type { EChartsOption } from "echarts";

const GROUPS: { tipo: ProductType; label: string; icon: typeof Zap; tarifas: string[] }[] = [
  { tipo: "luz", label: "Electricidad", icon: Zap, tarifas: ["2.0TD", "3.0TD", "6.1TD"] },
  { tipo: "gas", label: "Gas", icon: Flame, tarifas: ["RL1", "RL2", "RL3", "RL4", "RL5", "RL6"] },
  { tipo: "telefonia", label: "Telecomunicaciones", icon: Wifi, tarifas: ["Fibra", "Móvil", "Fibra + móvil"] },
];

const POT_BUCKETS = [
  { label: "≤ 3,45 kW", max: 3.45 },
  { label: "3,45–5,75", max: 5.75 },
  { label: "5,75–10", max: 10 },
  { label: "10–15", max: 15 },
  { label: "15–50", max: 50 },
  { label: "> 50 kW", max: Infinity },
];

export default function EnergiaPage() {
  const { rows, settings, tokens: t, ref, empty } = useData();
  const openDrawer = useStore((s) => s.openDrawer);
  const toggle = useStore((s) => s.toggleFilter);
  const [tab, setTab] = useState<ProductType>("luz");
  const m = settings.theme;
  const g = GROUPS.find((x) => x.tipo === tab)!;
  const factor = settings.consumoUnit === "kWh" ? 1 / 1000 : 1;
  const energy = tab !== "telefonia";

  const data = useMemo(() => {
    const tr = rows.filter((c) => c.tipo === tab);
    const known = [...g.tarifas];
    const others = [...new Set(tr.map((c) => c.tarifa).filter((x) => !known.includes(x)))];
    const tarifas = [...known, ...others];
    const byTarifa = tarifas.map((tf) => tr.filter((c) => c.tarifa === tf));
    // evolución mensual apilada por tarifa (máx 4 series + "otras")
    const ext = dateExtent(tr, "fTramitacion");
    const from = ext ? (ext.min < addMonths(ref, -18) ? addMonths(ref, -18) : ext.min) : ref;
    const months = monthRange(from, ref);
    const present = tarifas.filter((_, i) => byTarifa[i].length).slice(0, 4);
    const palette = [t.series[0], t.series[1], t.series[2], t.series[6]];
    const evo = barsOption(
      t,
      months.map(fmtMonth),
      present.map((tf, i) => ({ name: tf, color: palette[i], data: months.map((mk) => tr.filter((c) => c.tarifa === tf && c.fTramitacion?.startsWith(mk)).length) })),
      { stack: true },
    );
    // consumo por comercializadora × tarifa (heatmap), solo energía
    let heat: EChartsOption | null = null;
    let comRank: { key: string; label: string; value: number; color: string }[] = [];
    if (tab !== "telefonia") {
      const withC = tr.filter((c) => c.consumo !== null);
      const coms = ranked(countBy(withC, (c) => c.comercializadora)).map((r) => ({ key: r.key, v: sum(r.items, (c) => c.consumo) * factor })).sort((a, b) => b.v - a.v).slice(0, 10);
      const tfs = present;
      const vals: [number, number, number][] = [];
      let max = 0;
      coms.forEach((cm, y) =>
        tfs.forEach((tf, x) => {
          const v = sum(withC.filter((c) => c.comercializadora === cm.key && c.tarifa === tf), (c) => c.consumo) * factor;
          max = Math.max(max, v);
          vals.push([x, y, Math.round(v)]);
        }),
      );
      heat = {
        tooltip: tooltip(t, {
          trigger: "item",
          formatter: (p: { data: { value: [number, number, number] } }) => tipTitle(`${coms[p.data.value[1]].key} · ${tfs[p.data.value[0]]}`, t) + tipRow(SEQ_BLUE[8], "Consumo", `${fmtInt(p.data.value[2])} MWh`, t),
        }),
        grid: { left: 4, right: 4, top: 8, bottom: 40, containLabel: true },
        xAxis: { type: "category", data: tfs, splitArea: { show: false }, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.text2, fontFamily: font } },
        yAxis: { type: "category", data: coms.map((c) => c.key), inverse: true, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.text2, fontFamily: font } },
        visualMap: { dimension: 2, min: 0, max: Math.max(1, max), calculable: false, orient: "horizontal", left: "center", bottom: 0, itemWidth: 10, itemHeight: 160, inRange: { color: m === "dark" ? ["#1a2130", "#184f95", "#2a78d6", "#5598e7", "#9ec5f4"] : SEQ_BLUE.slice(0, 10) }, textStyle: { color: t.text3, fontFamily: font }, formatter: (v: number) => fmtInt(v) },
        series: [{ type: "heatmap", data: vals.map((v) => ({ value: [...v, v[2] ? fmtInt(v[2]) : ""], label: { formatter: "{@[3]}", color: v[2] > max * (m === "dark" ? 0.6 : 0.45) ? (m === "dark" ? "#0b0c0f" : "#ffffff") : t.text } })), itemStyle: { borderColor: t.surface, borderWidth: 3, borderRadius: 4 }, label: { show: true, fontSize: 11, fontFamily: font } }],
      } as unknown as EChartsOption;
      comRank = coms.map((c) => ({ key: c.key, label: c.key, value: c.v, color: tipoColor(tab, m) }));
    }
    // potencia (solo luz)
    const potIds = POT_BUCKETS.map(() => [] as string[]);
    if (tab === "luz") for (const c of tr) if (c.potencia !== null && c.potencia > 0) potIds[POT_BUCKETS.findIndex((b) => c.potencia! <= b.max)].push(c.id);
    const pot = barsOption(t, POT_BUCKETS.map((b) => b.label), [{ name: "Contratos", data: potIds.map((x) => x.length), color: tipoColor("luz", m) }], { legend: false });
    return { tr, tarifas, byTarifa, evo, heat, comRank, pot, potIds };
  }, [rows, tab, g, t, ref, factor, m]);

  const totals = useMemo(() => GROUPS.map((gr) => {
    const tr = rows.filter((c) => c.tipo === gr.tipo);
    const wc = tr.filter((c) => c.consumo !== null);
    return { ...gr, n: tr.length, ids: tr.map((c) => c.id), mwh: gr.tipo === "telefonia" ? null : sum(wc, (c) => c.consumo) * factor, nc: wc.length };
  }), [rows, factor]);

  if (empty) return <NoData />;
  if (!rows.length) return <FilteredEmpty />;

  return (
    <div className="grid gap-4">
      <PageIntro title="Energía y consumo">
        Electricidad, gas y telecomunicaciones se analizan por separado. La energía se expresa en MWh (consumo) y la potencia en kW. Nunca se suman consumos de luz y gas en un mismo total.
      </PageIntro>
      {!settings.consumoConfirmed && (
        <Notice tone="warn">
          El Excel no indica la unidad del campo Consumo. Por sus valores (mediana ≈ 3.000 en luz 2.0TD) se trata como <b>{settings.consumoUnit} {settings.consumoPeriod === "anual" ? "anuales" : ""}</b>. Confírmalo en Configuración para quitar este aviso.
        </Notice>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {totals.map((x) => {
          const Icon = x.icon;
          const on = tab === x.tipo;
          return (
            <motion.button
              key={x.tipo}
              onClick={() => setTab(x.tipo)}
              whileTap={{ scale: 0.985 }}
              className={cx("panel relative overflow-hidden p-5 text-left transition-[border-color] duration-200", on ? "border-line-strong" : "hover:border-line-strong")}
              aria-pressed={on}
            >
              {on && <motion.span layoutId="energy-tab" className="absolute inset-x-0 top-0 h-[2px]" style={{ background: tipoColor(x.tipo, m) }} />}
              <div className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: tipoColor(x.tipo, m) + "22", color: tipoColor(x.tipo, m) }}><Icon size={15} /></span>
                {x.label}
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <div className="text-[30px] font-semibold leading-none tracking-[-0.035em] tabular">{fmtInt(x.n)}</div>
                  <div className="mt-1 text-[12px] text-ink-3">contratos</div>
                </div>
                {x.mwh !== null && (
                  <div className="text-right">
                    <div className="text-[18px] font-semibold tabular tracking-[-0.02em]">{fmtInt(x.mwh)} <span className="text-[12px] font-medium text-ink-3">MWh</span></div>
                    <div className="text-[11.5px] text-ink-3">{fmtInt(x.nc)} con consumo informado</div>
                  </div>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {data.tarifas.map((tf, i) => {
          const tr = data.byTarifa[i];
          const wc = tr.filter((c: Contract) => c.consumo !== null);
          return (
            <KpiTile
              key={tf}
              label={tf}
              value={tr.length}
              ids={tr.map((c) => c.id)}
              drawerTitle={`${g.label} · ${tf}`}
              hint={energy ? `${fmtInt(sum(wc, (c) => c.consumo) * factor)} MWh` : tr.length ? `${fmtInt((tr.length / Math.max(1, data.tr.length)) * 100)} % de ${g.label.toLowerCase()}` : "sin contratos"}
            />
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Panel title={`Evolución de ${g.label.toLowerCase()} por tarifa`} subtitle="Altas mensuales por fecha de tramitación · últimos 18 meses" className="xl:col-span-7">
          <EChart option={data.evo} height={300} ariaLabel={`Evolución mensual de ${g.label} por tarifa`} />
        </Panel>
        {energy ? (
          <Panel title="Consumo por comercializadora" subtitle={`MWh ${settings.consumoPeriod === "anual" ? "anuales " : ""}· top 10 · clic para filtrar`} className="xl:col-span-5">
            <RankBars items={data.comRank} format={(n) => `${fmtInt(n)} MWh`} onSelect={(k) => toggle("comercializadoras", k)} />
          </Panel>
        ) : (
          <Panel title="Telecomunicaciones por operador" className="xl:col-span-5">
            <RankBars items={ranked(countBy(data.tr, (c) => c.comercializadora)).map((r) => ({ key: r.key, label: r.key, value: r.n, color: tipoColor("telefonia", m) }))} onSelect={(k) => toggle("comercializadoras", k)} />
            <p className="mt-3 text-[12px] text-ink-3">Los contratos de telecomunicaciones no tienen consumo energético y no se incluyen en ningún total de MWh.</p>
          </Panel>
        )}
      </div>

      {energy && data.heat && (
        <Panel title="Consumo por comercializadora y tarifa" subtitle="MWh · solo contratos con consumo informado · unidades comparables dentro del mismo suministro">
          <EChart option={data.heat} height={Math.max(260, data.comRank.length * 34 + 70)} ariaLabel="Mapa de calor de consumo por comercializadora y tarifa" />
        </Panel>
      )}

      {tab === "luz" && (
        <Panel title="Potencia contratada" subtitle="Campo Potencia en kW · clic para ver contratos" actions={<Badge>kW, no energía</Badge>}>
          <EChart option={data.pot} height={240} ariaLabel="Distribución de potencia contratada" onClick={(p) => openDrawer(`Potencia ${POT_BUCKETS[p.dataIndex].label}`, data.potIds[p.dataIndex])} />
        </Panel>
      )}
    </div>
  );
}
