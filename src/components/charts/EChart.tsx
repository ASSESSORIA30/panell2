"use client";
import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart, MapChart, HeatmapChart, ScatterChart, BoxplotChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  GeoComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkAreaComponent,
  GraphicComponent,
  DatasetComponent,
  AriaComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";
import spain from "@/data/spain-provinces.json";

echarts.use([
  BarChart, LineChart, PieChart, MapChart, HeatmapChart, ScatterChart, BoxplotChart,
  GridComponent, TooltipComponent, LegendComponent, VisualMapComponent, GeoComponent, DataZoomComponent,
  MarkLineComponent, MarkAreaComponent, GraphicComponent, DatasetComponent, AriaComponent, CanvasRenderer,
]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
echarts.registerMap("spain", spain as any);

export { echarts };

export interface EChartProps {
  option: EChartsOption;
  height?: number | string;
  className?: string;
  onClick?: (p: echarts.ECElementEvent) => void;
  ariaLabel: string;
  notMerge?: boolean;
}

export function EChart({ option, height = 280, className, onClick, ariaLabel, notMerge }: EChartProps) {
  const el = useRef<HTMLDivElement>(null);
  const inst = useRef<echarts.ECharts | null>(null);
  const clickRef = useRef(onClick);
  clickRef.current = onClick;

  useEffect(() => {
    if (!el.current) return;
    const chart = echarts.init(el.current, undefined, { renderer: "canvas" });
    inst.current = chart;
    chart.on("click", (p) => clickRef.current?.(p as echarts.ECElementEvent));
    const ro = new ResizeObserver(() => chart.resize({ animation: { duration: 200 } }));
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      chart.dispose();
      inst.current = null;
    };
  }, []);

  useEffect(() => {
    inst.current?.setOption(
      {
        animationDuration: 650,
        animationEasing: "cubicOut",
        animationDurationUpdate: 420,
        animationEasingUpdate: "cubicInOut",
        aria: { enabled: true, label: { description: ariaLabel } },
        ...option,
      },
      notMerge ? { notMerge: true, lazyUpdate: true } : { replaceMerge: ["series", "xAxis", "yAxis", "visualMap", "graphic"], lazyUpdate: true },
    );
  }, [option, ariaLabel, notMerge]);

  return <div ref={el} role="img" aria-label={ariaLabel} className={className} style={{ height, width: "100%", cursor: onClick ? "pointer" : undefined }} />;
}
