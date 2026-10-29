import type { EChartsOption } from "echarts";
import type { ChartTokens } from "@/lib/palette";
import { fmtInt } from "@/lib/format";

export function tooltip(t: ChartTokens, extra: Record<string, unknown> = {}) {
  return {
    backgroundColor: t.mode === "dark" ? "rgba(24,27,33,0.96)" : "rgba(255,255,255,0.98)",
    borderColor: t.border,
    borderWidth: 1,
    padding: [10, 12],
    textStyle: { color: t.text, fontFamily: "Schibsted Grotesk Variable, system-ui", fontSize: 12 },
    extraCssText: `border-radius:10px;box-shadow:0 12px 32px -12px rgba(0,0,0,${t.mode === "dark" ? 0.7 : 0.25});backdrop-filter:blur(8px);`,
    className: "a30-tip",
    confine: true,
    ...extra,
  };
}

export const font = "Schibsted Grotesk Variable, system-ui, sans-serif";

export function axisCategory(t: ChartTokens, data: string[], extra: Record<string, unknown> = {}) {
  return {
    type: "category" as const,
    data,
    axisLine: { lineStyle: { color: t.axis } },
    axisTick: { show: false },
    axisLabel: { color: t.text3, fontFamily: font, fontSize: 11, hideOverlap: true },
    ...extra,
  };
}

export function axisValue(t: ChartTokens, extra: Record<string, unknown> = {}) {
  return {
    type: "value" as const,
    splitLine: { lineStyle: { color: t.grid } },
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: t.text3, fontFamily: font, fontSize: 11, formatter: (v: number) => fmtInt(v) },
    splitNumber: 4,
    ...extra,
  };
}

export function legend(t: ChartTokens, extra: Record<string, unknown> = {}) {
  return {
    type: "scroll" as const,
    top: 0,
    left: 0,
    right: 0,
    icon: "roundRect",
    pageIconColor: t.text2,
    pageTextStyle: { color: t.text3 },
    itemWidth: 10,
    itemHeight: 10,
    itemGap: 16,
    textStyle: { color: t.text2, fontFamily: font, fontSize: 12 },
    ...extra,
  };
}

export const grid = (extra: Record<string, unknown> = {}) => ({ left: 4, right: 12, top: 36, bottom: 4, containLabel: true, ...extra });

/** Fila de tooltip con marca de color + etiqueta + valor (texto en tinta, no en color de serie) */
export function tipRow(color: string, label: string, value: string, t: ChartTokens) {
  return `<div style="display:flex;align-items:center;gap:8px;min-width:180px;line-height:1.7"><span style="width:8px;height:8px;border-radius:2px;background:${color}"></span><span style="color:${t.text2};flex:1">${label}</span><b style="color:${t.text};font-variant-numeric:tabular-nums;font-weight:600">${value}</b></div>`;
}
export function tipTitle(s: string, t: ChartTokens) {
  return `<div style="color:${t.text};font-weight:600;margin-bottom:4px">${s}</div>`;
}

export type Opt = EChartsOption;
