"use client";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { useData } from "@/lib/useData";
import { useStore } from "@/lib/store";
import { ESTADOS } from "@/lib/normalize";
import { estadoColor } from "@/lib/palette";
import { fmtInt, fmtShare } from "@/lib/format";
import { cx } from "@/components/ui/primitives";
import type { EstadoKey } from "@/lib/types";

/** Barra apilada 100 % del estado actual de la cartera + leyenda interactiva. */
export function StatePipeline() {
  const { rows, settings, filters } = useData();
  const toggle = useStore((s) => s.toggleFilter);
  const openDrawer = useStore((s) => s.openDrawer);
  const [hover, setHover] = useState<EstadoKey | null>(null);
  const items = useMemo(() => {
    const m = new Map<EstadoKey, string[]>();
    for (const c of rows) {
      const a = m.get(c.estado);
      if (a) a.push(c.id);
      else m.set(c.estado, [c.id]);
    }
    return ESTADOS.filter((e) => m.has(e.key)).map((e) => ({ ...e, ids: m.get(e.key)!, n: m.get(e.key)!.length }));
  }, [rows]);
  const total = rows.length || 1;
  return (
    <div>
      <div className="flex h-9 w-full gap-[2px] overflow-hidden rounded-lg" role="img" aria-label="Distribución de contratos por estado">
        {items.map((it, i) => (
          <motion.button
            key={it.key}
            onMouseEnter={() => setHover(it.key)}
            onMouseLeave={() => setHover(null)}
            onClick={() => toggle("estados", it.key)}
            className="h-full first:rounded-l-lg last:rounded-r-lg"
            style={{ background: estadoColor(it.key, settings.theme), opacity: hover && hover !== it.key ? 0.35 : filters.estados.length && !filters.estados.includes(it.key) ? 0.35 : 1 }}
            initial={{ flexGrow: 0 }}
            animate={{ flexGrow: it.n / total }}
            transition={{ duration: 0.8, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
            title={`${it.label}: ${fmtInt(it.n)} (${fmtShare((it.n / total) * 100)})`}
            aria-label={`${it.label}: ${fmtInt(it.n)}`}
          />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
        {items.map((it) => (
          <button
            key={it.key}
            onMouseEnter={() => setHover(it.key)}
            onMouseLeave={() => setHover(null)}
            onClick={() => openDrawer(`Contratos en estado ${it.label}`, it.ids)}
            className={cx("flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-[12.5px] transition-colors hover:bg-hover", hover === it.key && "bg-hover")}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: estadoColor(it.key, settings.theme) }} />
            <span className="flex-1 truncate text-ink-2">{it.label}</span>
            <span className="font-semibold tabular text-ink">{fmtInt(it.n)}</span>
            <span className="w-11 text-right text-[11px] tabular text-ink-3">{fmtShare((it.n / total) * 100, 0)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
