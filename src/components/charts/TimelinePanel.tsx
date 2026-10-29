"use client";
import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { EChart } from "./EChart";
import { axisCategory, axisValue, grid, tipRow, tipTitle, tooltip } from "./base";
import { useData } from "@/lib/useData";
import { useStore } from "@/lib/store";
import { applyFilters, currentWindow, growth, hasDateFilter, inWindow, previousWindow, yearAgoWindow } from "@/lib/metrics";
import { addDays, addMonths, fmtDate } from "@/lib/dates";
import { autoGran, bucketRange, buildBuckets, type Gran } from "@/lib/timeseries";
import { AnimatedNumber, Delta, Segmented, cx } from "@/components/ui/primitives";
import { fmtInt } from "@/lib/format";
import type { DateBasis } from "@/lib/types";

const FIELD_LABEL: Record<string, string> = { fTramitacion: "Altas comerciales", fActivacion: "Activaciones", fBaja: "Bajas" };
const FIELD_HINT: Record<string, string> = {
  fTramitacion: "por fecha de tramitación (= carterización)",
  fActivacion: "por fecha de activación",
  fBaja: "por fecha de baja",
};

export function TimelinePanel({ hero = false, defaultField = "fTramitacion" }: { hero?: boolean; defaultField?: DateBasis }) {
  const { all, filters, settings, ref, tokens: t } = useData();
  const setFilter = useStore((s) => s.setFilter);
  const [field, setField] = useState<DateBasis>(defaultField);
  const [granSel, setGranSel] = useState<Gran | "auto">("auto");
  const [compare, setCompare] = useState<"yoy" | "none">("yoy");

  // filas con todos los filtros salvo la fecha (para poder comparar con otros períodos)
  const base = useMemo(() => applyFilters(all, filters, settings.dateBasis, "date"), [all, filters, settings.dateBasis]);

  const range = useMemo(() => {
    if (hasDateFilter(filters)) {
      const w = currentWindow(filters, ref);
      if (filters.dateFrom || filters.dateTo) return { from: w.from === "1990-01-01" ? addMonths(ref, -24) : w.from, to: w.to };
      if (filters.years.length) {
        const ys = [...filters.years].sort();
        const to = `${ys[ys.length - 1]}-12-31`;
        return { from: `${ys[0]}-01-01`, to: to > ref ? ref : to };
      }
    }
    return { from: addDays(addMonths(ref, -24), 1).slice(0, 8) + "01", to: ref };
  }, [filters, ref]);

  const gran: Gran = granSel === "auto" ? autoGran(range.from, range.to) : granSel;

  const data = useMemo(() => {
    const rows = filters.months.length ? base.filter((c) => c[field] && filters.months.includes(+c[field]!.slice(5, 7))) : base;
    const cur = buildBuckets(rows, field, gran, range.from, range.to);
    let prev: number[] | null = null;
    if (compare === "yoy") {
      const shift = (k: string) => (gran === "week" ? addDays(k, -364) : gran === "month" ? addMonths(`${k}-01`, -12).slice(0, 7) : gran === "day" ? addMonths(k, -12) : String(+k - 1));
      const pFrom = gran === "week" ? addDays(range.from, -364) : addMonths(range.from, -12);
      const pTo = gran === "week" ? addDays(range.to, -364) : addMonths(range.to, -12);
      const p = buildBuckets(rows, field, gran, pFrom, pTo);
      const map = new Map(p.keys.map((k, i) => [k, p.counts[i]]));
      prev = cur.keys.map((k) => map.get(shift(k)) ?? 0);
    }
    return { cur, prev };
  }, [base, field, gran, range, compare, filters.months]);

  // Titular: ventana actual (período filtrado o mes en curso)
  const w = currentWindow(filters, ref);
  const pw = previousWindow(w);
  const yw = yearAgoWindow(w);
  const nowN = base.filter((c) => inWindow(c[field], w)).length;
  const prevN = base.filter((c) => inWindow(c[field], pw)).length;
  const yoyN = base.filter((c) => inWindow(c[field], yw)).length;

  const option = useMemo<EChartsOption>(() => {
    const color = field === "fBaja" ? t.series[7] : field === "fActivacion" ? "#0ca30c" : t.brand;
    const n = data.cur.labels.length;
    return {
      grid: grid({ top: 16, bottom: 0 }),
      tooltip: tooltip(t, {
        trigger: "axis",
        axisPointer: { type: "line", lineStyle: { color: t.axis, type: "dashed" } },
        formatter: (ps: { dataIndex: number }[]) => {
          const i = ps[0].dataIndex;
          const r = bucketRange(data.cur.keys[i], gran);
          let html = tipTitle(gran === "day" ? fmtDate(r.from) : `${fmtDate(r.from)} – ${fmtDate(r.to)}`, t);
          html += tipRow(color, FIELD_LABEL[field], fmtInt(data.cur.counts[i]), t);
          if (data.prev) {
            html += tipRow(t.text3, "Mismo período año anterior", fmtInt(data.prev[i]), t);
            const g = growth(data.cur.counts[i], data.prev[i]);
            if (g !== null) html += `<div style="color:${t.text3};margin-top:4px;font-size:11px">Variación interanual ${g > 0 ? "+" : ""}${g.toFixed(1).replace(".", ",")} %</div>`;
          }
          html += `<div style="color:${t.text3};margin-top:6px;font-size:11px">Clic para filtrar este período</div>`;
          return html;
        },
      }),
      xAxis: axisCategory(t, data.cur.labels, { boundaryGap: n < 40 }),
      yAxis: axisValue(t, { minInterval: 1 }),
      series: [
        ...(data.prev
          ? [{
              id: "prev",
              name: "Año anterior",
              type: "line" as const,
              data: data.prev,
              symbol: "none",
              smooth: 0.25,
              lineStyle: { color: t.text3, width: 1.5, type: "dashed" as const },
              z: 1,
            }]
          : []),
        n < 40
          ? {
              id: "cur",
              name: FIELD_LABEL[field],
              type: "bar" as const,
              data: data.cur.counts,
              barMaxWidth: 26,
              itemStyle: { color, borderRadius: [4, 4, 0, 0] },
              emphasis: { itemStyle: { color, shadowBlur: 12, shadowColor: color } },
              z: 2,
            }
          : {
              id: "cur",
              name: FIELD_LABEL[field],
              type: "line" as const,
              data: data.cur.counts,
              symbol: "none",
              smooth: 0.2,
              lineStyle: { color, width: 2 },
              areaStyle: {
                color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: color + "55" }, { offset: 1, color: color + "00" }] },
              },
              z: 2,
            },
      ],
    };
  }, [data, t, field, gran]);

  return (
    <section className={cx("panel relative overflow-hidden", hero && "min-h-[420px]")}>
      {hero && <div aria-hidden className="pointer-events-none absolute -top-24 right-[-10%] h-64 w-[60%] rounded-full opacity-60 blur-3xl" style={{ background: "radial-gradient(closest-side, var(--brand-soft), transparent)" }} />}
      <div className="relative flex flex-wrap items-start justify-between gap-4 px-5 pt-5">
        <div>
          <p className="text-[13px] font-medium text-ink-2">
            {FIELD_LABEL[field]} · {w.label}
          </p>
          <div className={cx("mt-1.5 font-semibold leading-none tracking-[-0.045em]", hero ? "text-[56px]" : "text-[40px]")}>
            <AnimatedNumber value={nowN} format={fmtInt} tabular={false} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <Delta value={growth(nowN, prevN)} label={`vs período anterior (${fmtInt(prevN)})`} invert={field === "fBaja"} />
            <Delta value={growth(nowN, yoyN)} label={`vs mismo período ${+w.from.slice(0, 4) - 1} (${fmtInt(yoyN)})`} invert={field === "fBaja"} />
          </div>
          <p className="mt-2 text-[11.5px] text-ink-3">{FIELD_HINT[field]} · {fmtDate(w.from)} – {fmtDate(w.to)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            ariaLabel={`Métrica temporal ${hero ? "hero" : ""}`}
            size="sm"
            value={field}
            onChange={(v) => setField(v)}
            options={[
              { value: "fTramitacion", label: "Altas" },
              { value: "fActivacion", label: "Activaciones" },
              { value: "fBaja", label: "Bajas" },
            ]}
          />
          <Segmented
            ariaLabel={`Granularidad ${hero ? "hero" : ""}`}
            size="sm"
            value={granSel}
            onChange={setGranSel}
            options={[
              { value: "auto", label: "Auto" },
              { value: "day", label: "Día" },
              { value: "week", label: "Semana" },
              { value: "month", label: "Mes" },
            ]}
          />
          <Segmented
            ariaLabel={`Comparación ${hero ? "hero" : ""}`}
            size="sm"
            value={compare}
            onChange={setCompare}
            options={[
              { value: "yoy", label: "vs año anterior" },
              { value: "none", label: "Sin comparar" },
            ]}
          />
        </div>
      </div>
      <div className="relative px-3 pb-4 pt-2">
        <EChart
          option={option}
          height={hero ? 290 : 260}
          ariaLabel={`${FIELD_LABEL[field]} por ${gran === "day" ? "día" : gran === "week" ? "semana" : "mes"}`}
          onClick={(p) => {
            const r = bucketRange(data.cur.keys[p.dataIndex], gran);
            useStore.setState((s) => ({ filters: { ...s.filters, years: [], months: [] } }));
            setFilter("dateFrom", r.from);
            setFilter("dateTo", r.to > ref ? ref : r.to);
          }}
        />
        <div className="flex items-center gap-4 px-2 pt-1 text-[11.5px] text-ink-3">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm" style={{ background: field === "fBaja" ? t.series[7] : field === "fActivacion" ? "#0ca30c" : t.brand }} /> {FIELD_LABEL[field]}</span>
          {compare === "yoy" && <span className="inline-flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: t.text3 }} /> Mismo período del año anterior</span>}
          <span className="ml-auto">{fmtDate(range.from)} – {fmtDate(range.to)}</span>
        </div>
      </div>
    </section>
  );
}
