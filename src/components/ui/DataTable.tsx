"use client";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { cx } from "./primitives";
import { fmtInt } from "@/lib/format";
import { keyText } from "@/lib/normalize";

export interface Column<T> {
  key: string;
  header: string;
  cell: (r: T) => ReactNode;
  sort?: (r: T) => string | number | null;
  search?: (r: T) => string;
  width?: number | string;
  align?: "left" | "right";
  hideOnMobile?: boolean;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  height = 520,
  searchable = true,
  placeholder = "Buscar…",
  toolbar,
  initialSort,
  emptyText = "No hay registros que coincidan.",
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (r: T) => string;
  onRowClick?: (r: T) => void;
  height?: number;
  searchable?: boolean;
  placeholder?: string;
  toolbar?: ReactNode;
  initialSort?: { key: string; dir: "asc" | "desc" };
  emptyText?: string;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState(initialSort ?? null);
  const parent = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    let out = rows;
    const nq = keyText(q);
    if (nq) {
      const cols = columns.filter((c) => c.search);
      out = out.filter((r) => cols.some((c) => keyText(c.search!(r)).includes(nq)));
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sort) {
        const dir = sort.dir === "asc" ? 1 : -1;
        out = [...out].sort((a, b) => {
          const x = col.sort!(a), y = col.sort!(b);
          if (x === y) return 0;
          if (x === null || x === undefined || x === "") return 1;
          if (y === null || y === undefined || y === "") return -1;
          return x > y ? dir : -dir;
        });
      }
    }
    return out;
  }, [rows, q, sort, columns]);

  const v = useVirtualizer({ count: filtered.length, getScrollElement: () => parent.current, estimateSize: () => 42, overscan: 12 });
  const template = columns.map((c) => (typeof c.width === "number" ? `${c.width}px` : c.width ?? "minmax(120px,1fr)")).join(" ");

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {(searchable || toolbar) && (
        <div className="flex flex-wrap items-center gap-2">
          {searchable && (
            <label className="relative flex h-9 min-w-[220px] flex-1 items-center sm:max-w-sm">
              <Search size={14} className="pointer-events-none absolute left-3 text-ink-3" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={placeholder}
                aria-label={placeholder}
                className="h-full w-full rounded-lg border border-line bg-surface-2 pl-8 pr-3 text-[13px] text-ink outline-none placeholder:text-ink-3 focus:border-line-strong"
              />
            </label>
          )}
          <span className="text-[12px] tabular text-ink-3">{fmtInt(filtered.length)} registros</span>
          <div className="ml-auto flex items-center gap-2">{toolbar}</div>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-line scroll-thin">
        <div style={{ minWidth: columns.length * 110 }}>
          <div role="row" className="sticky top-0 z-10 grid border-b border-line bg-surface-2 text-[11.5px] font-medium text-ink-3" style={{ gridTemplateColumns: template }}>
            {columns.map((c) => {
              const active = sort?.key === c.key;
              return (
                <button
                  key={c.key}
                  role="columnheader"
                  disabled={!c.sort}
                  onClick={() => c.sort && setSort(active && sort?.dir === "desc" ? { key: c.key, dir: "asc" } : { key: c.key, dir: "desc" })}
                  className={cx("flex items-center gap-1 px-3 py-2.5 text-left transition-colors", c.sort && "hover:text-ink", c.align === "right" && "justify-end", active && "text-ink")}
                >
                  {c.header}
                  {active && (sort?.dir === "desc" ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
                </button>
              );
            })}
          </div>
          <div ref={parent} className="overflow-y-auto scroll-thin" style={{ height: Math.min(height, Math.max(84, filtered.length * 42)) }}>
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-ink-3">{emptyText}</div>
            ) : (
              <div style={{ height: v.getTotalSize(), position: "relative" }}>
                {v.getVirtualItems().map((it) => {
                  const r = filtered[it.index];
                  return (
                    <div
                      key={rowKey(r)}
                      role="row"
                      tabIndex={onRowClick ? 0 : undefined}
                      onClick={() => onRowClick?.(r)}
                      onKeyDown={(e) => e.key === "Enter" && onRowClick?.(r)}
                      className={cx("absolute left-0 grid w-full items-center border-b border-line text-[12.5px] text-ink-2 transition-colors", onRowClick && "cursor-pointer hover:bg-hover")}
                      style={{ top: 0, transform: `translateY(${it.start}px)`, height: 42, gridTemplateColumns: template }}
                    >
                      {columns.map((c) => (
                        <div key={c.key} className={cx("truncate px-3", c.align === "right" && "text-right tabular")}>
                          {c.cell(r)}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
