"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ChevronRight, FileUp } from "lucide-react";
import { AnimatedNumber, Button, cx, Delta, EmptyState, InfoTip } from "./primitives";
import { useStore } from "@/lib/store";
import { fmtInt, fmtShare } from "@/lib/format";

export function KpiTile({
  label,
  value,
  format = fmtInt,
  delta,
  deltaLabel,
  hint,
  ids,
  drawerTitle,
  info,
  flag,
  size = "md",
  invert,
  className,
}: {
  label: string;
  value: number | null;
  format?: (n: number) => string;
  delta?: number | null;
  deltaLabel?: string;
  hint?: ReactNode;
  ids?: string[];
  drawerTitle?: string;
  info?: string;
  flag?: ReactNode;
  size?: "md" | "lg";
  invert?: boolean;
  className?: string;
}) {
  const open = useStore((s) => s.openDrawer);
  const clickable = !!ids;
  const act = () => open(drawerTitle ?? label, ids!);
  return (
    <motion.div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? act : undefined}
      onKeyDown={clickable ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), act()) : undefined}
      whileTap={clickable ? { scale: 0.985 } : undefined}
      className={cx(
        "panel group relative flex min-w-0 flex-col items-start p-4 text-left transition-[border-color,background] duration-200",
        clickable && "cursor-pointer hover:border-line-strong hover:bg-[color-mix(in_oklab,var(--surface)_92%,var(--text))]",
        className,
      )}
      aria-label={clickable ? `${label}: ver desglose` : undefined}
    >
      <div className="flex w-full items-start gap-1.5 text-[12.5px] font-medium text-ink-2">
        <span className="min-w-0 leading-snug">{label}</span>
        {info && <InfoTip text={info} />}
        {clickable && <ChevronRight size={14} className="ml-auto -translate-x-1 text-ink-3 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />}
      </div>
      <div className={cx("mt-2 font-semibold leading-none tracking-[-0.035em] text-ink", size === "lg" ? "text-[34px]" : "text-[26px]")}>
        <AnimatedNumber value={value} format={format} tabular={false} />
      </div>
      <div className="mt-2.5 flex min-h-[20px] flex-wrap items-center gap-x-2 gap-y-1">
        {delta !== undefined && <Delta value={delta} label={deltaLabel} invert={invert} />}
        {hint && <span className="text-[12px] text-ink-3">{hint}</span>}
        {flag}
      </div>
    </motion.div>
  );
}

export interface RankItem {
  key: string;
  label: string;
  value: number;
  color?: string;
  sub?: string;
  ids?: string[];
}

/** Ranking con barras horizontales animadas, accesible y con tooltip nativo. */
export function RankBars({
  items,
  format = fmtInt,
  onSelect,
  selected = [],
  total,
  max: maxItems = 10,
  showShare = true,
}: {
  items: RankItem[];
  format?: (n: number) => string;
  onSelect?: (key: string) => void;
  selected?: string[];
  total?: number;
  max?: number;
  showShare?: boolean;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const shown = items.slice(0, maxItems);
  const max = Math.max(1, ...shown.map((i) => i.value));
  const tot = total ?? items.reduce((a, b) => a + b.value, 0);
  return (
    <ul className="flex flex-col gap-1">
      {shown.map((it, i) => {
        const pct = (it.value / max) * 100;
        const dim = selected.length > 0 && !selected.includes(it.key);
        return (
          <li key={it.key}>
            <button
              type="button"
              onClick={() => onSelect?.(it.key)}
              onMouseEnter={() => setHover(it.key)}
              onMouseLeave={() => setHover(null)}
              className={cx("group w-full rounded-lg px-2 py-1.5 text-left transition-[background,opacity] duration-200", onSelect && "hover:bg-hover", dim && "opacity-40")}
              title={`${it.label}: ${format(it.value)}${tot ? ` (${fmtShare((it.value / tot) * 100)})` : ""}`}
              aria-pressed={selected.includes(it.key)}
            >
              <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-4 shrink-0 text-right text-[11px] tabular text-ink-3">{i + 1}</span>
                  <span className="truncate font-medium text-ink">{it.label}</span>
                  {it.sub && <span className="hidden truncate text-ink-3 sm:inline">{it.sub}</span>}
                </span>
                <span className="flex shrink-0 items-baseline gap-2 tabular">
                  <span className="font-semibold text-ink">{format(it.value)}</span>
                  {showShare && tot > 0 && <span className="w-12 text-right text-[11.5px] text-ink-3">{fmtShare((it.value / tot) * 100)}</span>}
                </span>
              </div>
              <div className="ml-6 mt-1.5 h-[6px] overflow-hidden rounded-full bg-surface-3">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: it.color ?? "var(--s1)", filter: hover === it.key ? "brightness(1.15)" : undefined }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(pct, 0.8)}%` }}
                  transition={{ duration: 0.7, delay: i * 0.035, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function NoData() {
  return (
    <div className="panel">
      <EmptyState
        icon={<FileUp size={20} />}
        title="Todavía no hay datos cargados"
        action={
          <Link href="/importar">
            <Button variant="primary">Importar exportación del CRM</Button>
          </Link>
        }
      >
        Arrastra el Excel de contratos exportado del CRM. Todos los indicadores se calcularán con los registros reales del archivo.
      </EmptyState>
    </div>
  );
}

export function FilteredEmpty() {
  const clear = useStore((s) => s.clearFilters);
  return (
    <div className="panel">
      <EmptyState title="Ningún contrato cumple los filtros actuales" action={<Button onClick={clear}>Limpiar filtros</Button>}>
        Amplía el período o quita algún filtro para ver resultados.
      </EmptyState>
    </div>
  );
}

export function PageIntro({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="max-w-3xl">
        <h2 className="text-[22px] font-semibold tracking-[-0.03em]">{title}</h2>
        {children && <p className="mt-1 text-[13.5px] leading-relaxed text-ink-3">{children}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
