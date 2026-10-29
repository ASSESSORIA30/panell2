import type { EChartsOption } from "echarts";
import type { ChartTokens } from "@/lib/palette";
import { axisCategory, axisValue, grid, legend, tipRow, tipTitle, tooltip } from "./base";
import { fmtInt } from "@/lib/format";

export interface SeriesSpec {
  name: string;
  data: number[];
  color: string;
  type?: "bar" | "line";
  dashed?: boolean;
}

/** Barras verticales u horizontales, agrupadas o apiladas. Un solo eje de valores. */
export function barsOption(
  t: ChartTokens,
  cats: string[],
  series: SeriesSpec[],
  opts: { stack?: boolean; horizontal?: boolean; fmt?: (n: number) => string; legend?: boolean; total?: boolean; barMax?: number } = {},
): EChartsOption {
  const fmt = opts.fmt ?? fmtInt;
  const showLegend = opts.legend ?? series.length > 1;
  const cat = axisCategory(t, cats, opts.horizontal ? { inverse: true, axisLine: { show: false }, axisLabel: { color: t.text2, fontSize: 11.5, width: 120, overflow: "truncate" } } : {});
  const val = axisValue(t, { axisLabel: { color: t.text3, fontSize: 11, formatter: (v: number) => fmt(v) } });
  const lastIdx = series.length - 1;
  return {
    legend: showLegend ? legend(t) : undefined,
    grid: grid({ top: showLegend ? 34 : 10, right: opts.total && opts.horizontal ? 76 : 12 }),
    tooltip: tooltip(t, {
      trigger: "axis",
      axisPointer: { type: "shadow", shadowStyle: { color: t.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(15,17,21,0.04)" } },
      formatter: (ps: { dataIndex: number; seriesIndex: number }[]) => {
        const i = ps[0].dataIndex;
        let h = tipTitle(cats[i], t);
        let tot = 0;
        for (const s of series) {
          h += tipRow(s.color, s.name, fmt(s.data[i]), t);
          tot += s.data[i];
        }
        if (opts.stack && series.length > 1) h += `<div style="border-top:1px solid ${t.border};margin-top:4px;padding-top:4px">${tipRow("transparent", "Total", fmt(tot), t)}</div>`;
        return h;
      },
    }),
    xAxis: (opts.horizontal ? val : cat) as EChartsOption["xAxis"],
    yAxis: (opts.horizontal ? cat : val) as EChartsOption["yAxis"],
    series: series.map((s, si) => {
      const isEnd = !opts.stack || si === lastIdx;
      const radius = opts.horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0];
      return {
        id: s.name,
        name: s.name,
        type: s.type ?? "bar",
        data: s.data,
        stack: opts.stack ? "total" : undefined,
        barMaxWidth: opts.barMax ?? (opts.horizontal ? 16 : 28),
        barGap: "18%",
        itemStyle: { color: s.color, borderRadius: isEnd ? radius : 0, borderColor: opts.stack ? t.surface : undefined, borderWidth: opts.stack ? 1 : 0 },
        lineStyle: s.type === "line" ? { color: s.color, width: 2, type: s.dashed ? "dashed" : "solid" } : undefined,
        symbol: s.type === "line" ? "circle" : undefined,
        symbolSize: 6,
        emphasis: { focus: "series" },
        label:
          opts.total && isEnd && opts.horizontal
            ? { show: true, position: "right", color: t.text2, fontSize: 11, formatter: (p: { dataIndex: number }) => fmt(series.reduce((a, x) => a + x.data[p.dataIndex], 0)) }
            : undefined,
      };
    }) as EChartsOption["series"],
  };
}

export function linesOption(t: ChartTokens, cats: string[], series: SeriesSpec[], opts: { fmt?: (n: number) => string; area?: boolean } = {}): EChartsOption {
  const fmt = opts.fmt ?? fmtInt;
  return {
    legend: series.length > 1 ? legend(t) : undefined,
    grid: grid({ top: series.length > 1 ? 34 : 10 }),
    tooltip: tooltip(t, {
      trigger: "axis",
      axisPointer: { type: "line", lineStyle: { color: t.axis, type: "dashed" } },
      formatter: (ps: { dataIndex: number }[]) => {
        const i = ps[0].dataIndex;
        return tipTitle(cats[i], t) + series.map((s) => tipRow(s.color, s.name, fmt(s.data[i]), t)).join("");
      },
    }),
    xAxis: axisCategory(t, cats, { boundaryGap: false }),
    yAxis: axisValue(t, { axisLabel: { color: t.text3, fontSize: 11, formatter: (v: number) => fmt(v) } }),
    series: series.map((s) => ({
      id: s.name,
      name: s.name,
      type: "line",
      data: s.data,
      smooth: 0.2,
      symbol: "circle",
      symbolSize: 7,
      showSymbol: cats.length <= 14,
      lineStyle: { color: s.color, width: 2, type: s.dashed ? "dashed" : "solid" },
      itemStyle: { color: s.color, borderColor: t.surface, borderWidth: 2 },
      areaStyle: opts.area ? { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: s.color + "40" }, { offset: 1, color: s.color + "00" }] } } : undefined,
      emphasis: { focus: "series" },
    })) as EChartsOption["series"],
  };
}

export function donutOption(t: ChartTokens, items: { name: string; value: number; color: string }[], center: { value: string; label: string }, fmt: (n: number) => string = fmtInt): EChartsOption {
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  return ({
    tooltip: tooltip(t, {
      trigger: "item",
      formatter: (p: { name: string; value: number; color: string }) => tipRow(p.color, p.name, `${fmt(p.value)} · ${((p.value / total) * 100).toFixed(1).replace(".", ",")} %`, t),
    }),
    graphic: [
      { type: "text", left: "center", top: "41%", style: { text: center.value, fill: t.text, fontSize: 22, fontWeight: 600, fontFamily: "Schibsted Grotesk Variable", textAlign: "center" } },
      { type: "text", left: "center", top: "54%", style: { text: center.label, fill: t.text3, fontSize: 11.5, fontFamily: "Schibsted Grotesk Variable", textAlign: "center" } },
    ],
    series: [
      {
        type: "pie",
        radius: ["62%", "84%"],
        padAngle: 1.2,
        itemStyle: { borderRadius: 4, borderColor: t.surface, borderWidth: 2 },
        label: { show: false },
        emphasis: { scale: true, scaleSize: 4 },
        data: items.map((i) => ({ name: i.name, value: i.value, itemStyle: { color: i.color } })),
      },
    ],
  }) as unknown as EChartsOption;
}
