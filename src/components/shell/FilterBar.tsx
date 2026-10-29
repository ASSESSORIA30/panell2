"use client";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarRange, Check, ChevronDown, Search, X, RotateCcw } from "lucide-react";
import { useStore } from "@/lib/store";
import { useData } from "@/lib/useData";
import { applyFilters, countBy, DATE_BASIS_LABEL, ownerLabel, ranked } from "@/lib/metrics";
import { ESTADO_LABEL, ESTADOS, keyText, TIPO_LABEL } from "@/lib/normalize";
import { addDays, addMonths, endOfMonth, fmtDate, MONTHS_ES, startOfMonth } from "@/lib/dates";
import { fmtInt } from "@/lib/format";
import { cx, Popover } from "@/components/ui/primitives";
import type { Contract, Filters } from "@/lib/types";

type ArrKey = "comercializadoras" | "tipos" | "tarifas" | "estados" | "owners" | "provincias" | "municipios";

function Trigger({ label, count, open, icon }: { label: string; count: number; open: boolean; icon?: React.ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex h-8 cursor-pointer select-none items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-[12.5px] font-medium transition-colors",
        count ? "border-[color-mix(in_oklab,var(--brand)_45%,transparent)] bg-brand-soft text-ink" : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
        open && "border-line-strong text-ink",
      )}
    >
      {icon}
      {label}
      {count > 0 && <span className="rounded bg-brand px-1 text-[10.5px] font-semibold tabular text-brand-ink">{count}</span>}
      <ChevronDown size={13} className={cx("text-ink-3 transition-transform duration-200", open && "rotate-180")} />
    </span>
  );
}

function MultiFilter({ k, label, options }: { k: ArrKey; label: string; options: { value: string; label: string; n: number }[] }) {
  const selected = useStore((s) => s.filters[k]) as string[];
  const toggle = useStore((s) => s.toggleFilter);
  const setFilter = useStore((s) => s.setFilter);
  const [q, setQ] = useState("");
  const list = options.filter((o) => !q || keyText(o.label).includes(keyText(q)));
  return (
    <Popover width={290} trigger={(open) => <Trigger label={label} count={selected.length} open={open} />}>
      <div className="flex flex-col">
        {options.length > 7 && (
          <label className="relative mb-1 flex items-center">
            <Search size={13} className="pointer-events-none absolute left-2.5 text-ink-3" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar ${label.toLowerCase()}`} aria-label={`Buscar ${label}`} className="h-8 w-full rounded-md border border-line bg-surface pl-7 pr-2 text-[12.5px] outline-none placeholder:text-ink-3" />
          </label>
        )}
        <div className="max-h-72 overflow-y-auto scroll-thin">
          {list.map((o) => {
            const on = selected.includes(o.value);
            return (
              <button
                key={o.value}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick={() => toggle(k, o.value as any)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-ink-2 transition-colors hover:bg-hover hover:text-ink"
                role="checkbox"
                aria-checked={on}
              >
                <span className={cx("grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors", on ? "border-brand bg-brand text-brand-ink" : "border-line-strong")}>{on && <Check size={11} strokeWidth={3} />}</span>
                <span className="flex-1 truncate">{o.label}</span>
                <span className="tabular text-[11.5px] text-ink-3">{fmtInt(o.n)}</span>
              </button>
            );
          })}
          {list.length === 0 && <p className="px-2 py-3 text-[12.5px] text-ink-3">Sin coincidencias</p>}
        </div>
        {selected.length > 0 && (
          <button onClick={() => setFilter(k, [])} className="mt-1 rounded-md px-2 py-1.5 text-left text-[12px] text-ink-3 hover:bg-hover hover:text-ink">
            Quitar selección
          </button>
        )}
      </div>
    </Popover>
  );
}

function PeriodFilter({ years }: { years: number[] }) {
  const f = useStore((s) => s.filters);
  const setFilter = useStore((s) => s.setFilter);
  const toggle = useStore((s) => s.toggleFilter);
  const { ref, settings } = useData();
  const active = (f.dateFrom || f.dateTo ? 1 : 0) + f.years.length + f.months.length;
  const set = (from: string | null, to: string | null) => {
    useStore.setState((s) => ({ filters: { ...s.filters, dateFrom: from, dateTo: to, years: [], months: [] } }));
  };
  const y = +ref.slice(0, 4);
  const qStart = `${y}-${String(Math.floor((+ref.slice(5, 7) - 1) / 3) * 3 + 1).padStart(2, "0")}-01`;
  const presets: { label: string; from: string | null; to: string | null }[] = [
    { label: "Hoy", from: ref, to: ref },
    { label: "Últimos 7 días", from: addDays(ref, -6), to: ref },
    { label: "Mes en curso", from: startOfMonth(ref), to: ref },
    { label: "Mes anterior", from: startOfMonth(addMonths(ref, -1)), to: endOfMonth(addMonths(ref, -1)) },
    { label: "Trimestre en curso", from: qStart, to: ref },
    { label: "Año en curso", from: `${y}-01-01`, to: ref },
    { label: "Año anterior", from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
    { label: "Últimos 12 meses", from: addDays(addMonths(ref, -12), 1), to: ref },
    { label: "Todo el histórico", from: null, to: null },
  ];
  const label = f.dateFrom || f.dateTo ? `${fmtDate(f.dateFrom)} – ${fmtDate(f.dateTo)}` : f.years.length || f.months.length ? "Período" : "Todo el período";
  return (
    <Popover width={360} trigger={(open) => <Trigger label={label} count={active} open={open} icon={<CalendarRange size={14} className="text-ink-3" />} />}>
      {(close) => (
        <div className="p-1.5">
          <div className="grid grid-cols-2 gap-1">
            {presets.map((p) => {
              const on = f.dateFrom === p.from && f.dateTo === p.to && !f.years.length && !f.months.length;
              return (
                <button key={p.label} onClick={() => { set(p.from, p.to); close(); }} className={cx("rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors", on ? "bg-brand-soft text-ink" : "text-ink-2 hover:bg-hover hover:text-ink")}>
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-[11.5px] text-ink-3">
              Desde
              <input type="date" value={f.dateFrom ?? ""} onChange={(e) => setFilter("dateFrom", e.target.value || null)} className="mt-1 h-8 w-full rounded-md border border-line bg-surface px-2 text-[12.5px] text-ink outline-none" />
            </label>
            <label className="text-[11.5px] text-ink-3">
              Hasta
              <input type="date" value={f.dateTo ?? ""} onChange={(e) => setFilter("dateTo", e.target.value || null)} className="mt-1 h-8 w-full rounded-md border border-line bg-surface px-2 text-[12.5px] text-ink outline-none" />
            </label>
          </div>
          <p className="mt-3 text-[11.5px] text-ink-3">Año</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {years.map((yy) => (
              <button key={yy} onClick={() => toggle("years", yy)} className={cx("rounded-md border px-2 py-1 text-[12px] tabular transition-colors", f.years.includes(yy) ? "border-brand bg-brand-soft text-ink" : "border-line text-ink-2 hover:text-ink")}>
                {yy}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11.5px] text-ink-3">Mes</p>
          <div className="mt-1 grid grid-cols-6 gap-1">
            {MONTHS_ES.map((m, i) => (
              <button key={m} onClick={() => toggle("months", i + 1)} className={cx("rounded-md border px-1 py-1 text-[12px] transition-colors", f.months.includes(i + 1) ? "border-brand bg-brand-soft text-ink" : "border-line text-ink-2 hover:text-ink")}>
                {m}
              </button>
            ))}
          </div>
          <p className="mt-3 border-t border-line pt-2 text-[11.5px] leading-relaxed text-ink-3">
            Filtra por <span className="text-ink-2">{DATE_BASIS_LABEL[settings.dateBasis].toLowerCase()}</span>. Los registros sin esa fecha quedan fuera mientras el filtro esté activo. Puedes cambiar la fecha base en Configuración.
          </p>
        </div>
      )}
    </Popover>
  );
}

const CHIP_LABEL: Partial<Record<keyof Filters, string>> = {
  comercializadoras: "Comercializadora",
  tipos: "Producto",
  tarifas: "Tarifa",
  estados: "Estado",
  owners: "Comercial",
  provincias: "Provincia",
  municipios: "Municipio",
};

export function FilterBar() {
  const { all, filters, settings } = useData();
  const clear = useStore((s) => s.clearFilters);
  const toggle = useStore((s) => s.toggleFilter);

  const facets = useMemo(() => {
    const opt = (k: ArrKey, fn: (c: Contract) => string | string[], lab: (v: string) => string = (v) => v) =>
      ranked(countBy(applyFilters(all, filters, settings.dateBasis, k), fn)).map((r) => ({ value: r.key, label: lab(r.key), n: r.n }));
    const years = [...new Set(all.map((c) => c[settings.dateBasis]?.slice(0, 4)).filter(Boolean).map(Number))].sort();
    return {
      years,
      comercializadoras: opt("comercializadoras", (c) => c.comercializadora),
      tipos: opt("tipos", (c) => c.tipo, (v) => TIPO_LABEL[v as keyof typeof TIPO_LABEL]),
      tarifas: opt("tarifas", (c) => c.tarifa),
      estados: opt("estados", (c) => c.estado, (v) => ESTADO_LABEL[v as keyof typeof ESTADO_LABEL]).sort(
        (a, b) => ESTADOS.findIndex((e) => e.key === a.value) - ESTADOS.findIndex((e) => e.key === b.value),
      ),
      owners: opt("owners", (c) => c.owners, (v) => ownerLabel(v, settings)),
      provincias: opt("provincias", (c) => c.provincia ?? "Sin provincia"),
      municipios: opt("municipios", (c) => c.poblacion ?? "Sin población"),
    };
  }, [all, filters, settings]);

  const chips: { k: ArrKey; v: string; label: string }[] = [];
  (Object.keys(CHIP_LABEL) as ArrKey[]).forEach((k) =>
    (filters[k] as string[]).forEach((v) =>
      chips.push({
        k,
        v,
        label: k === "tipos" ? TIPO_LABEL[v as keyof typeof TIPO_LABEL] : k === "estados" ? ESTADO_LABEL[v as keyof typeof ESTADO_LABEL] : k === "owners" ? ownerLabel(v, settings) : v,
      }),
    ),
  );
  const anyActive = chips.length > 0 || filters.dateFrom || filters.dateTo || filters.years.length || filters.months.length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <PeriodFilter years={facets.years} />
        <MultiFilter k="comercializadoras" label="Comercializadora" options={facets.comercializadoras} />
        <MultiFilter k="tipos" label="Producto" options={facets.tipos} />
        <MultiFilter k="tarifas" label="Tarifa" options={facets.tarifas} />
        <MultiFilter k="estados" label="Estado" options={facets.estados} />
        <MultiFilter k="owners" label="Comercial" options={facets.owners} />
        <MultiFilter k="provincias" label="Provincia" options={facets.provincias} />
        <MultiFilter k="municipios" label="Municipio" options={facets.municipios} />
        <AnimatePresence>
          {anyActive && (
            <motion.button
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={clear}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-ink-3 transition-colors hover:bg-hover hover:text-ink"
            >
              <RotateCcw size={13} /> Limpiar filtros
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <AnimatePresence initial={false}>
            {chips.map((c) => (
              <motion.button
                layout
                key={`${c.k}:${c.v}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick={() => toggle(c.k, c.v as any)}
                className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 py-0.5 pl-2 pr-1 text-[11.5px] text-ink-2 hover:text-ink"
                aria-label={`Quitar filtro ${CHIP_LABEL[c.k]}: ${c.label}`}
              >
                <span className="text-ink-3">{CHIP_LABEL[c.k]}:</span> {c.label}
                <X size={12} />
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
