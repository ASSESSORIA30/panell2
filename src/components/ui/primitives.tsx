"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { animate, AnimatePresence, motion, useReducedMotion } from "motion/react";
import clsx from "clsx";
import { Info, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { fmtPct } from "@/lib/format";

export const cx = clsx;

export function Panel({
  title,
  subtitle,
  actions,
  info,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  info?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cx("panel flex min-w-0 flex-col", className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-[14px] font-semibold tracking-[-0.01em] text-ink">
              {title}
              {info && <InfoTip text={info} />}
            </h2>
            {subtitle && <p className="mt-0.5 text-[12.5px] text-ink-3">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx("min-w-0 flex-1 px-5 pb-5 pt-3", bodyClassName)}>{children}</div>
    </section>
  );
}

export function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={text}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="text-ink-3 transition-colors hover:text-ink-2"
      >
        <Info size={13} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.span
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 2 }}
            transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}
            className="absolute left-1/2 top-6 z-50 w-64 -translate-x-1/2 rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-[12px] font-normal leading-relaxed text-ink-2 shadow-xl"
            role="tooltip"
          >
            {text}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/** Contador animado: interpola desde el valor anterior, respeta reduced-motion. */
export function AnimatedNumber({ value, format, className, tabular = true }: { value: number | null; format: (n: number) => string; className?: string; tabular?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (value === null || !isFinite(value)) {
      node.textContent = "—";
      return;
    }
    if (reduce) {
      node.textContent = format(value);
      prev.current = value;
      return;
    }
    const ctrl = animate(prev.current, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => (node.textContent = format(v)),
    });
    prev.current = value;
    return () => ctrl.stop();
  }, [value, format, reduce]);
  return <span ref={ref} className={cx(tabular && "tabular", className)}>{value === null ? "—" : format(0)}</span>;
}

export function Delta({ value, label, invert }: { value: number | null; label?: string; invert?: boolean }) {
  if (value === null || !isFinite(value))
    return <span className="text-[12px] text-ink-3">{label ? `sin base ${label}` : "sin base de comparación"}</span>;
  const up = value > 0.05, down = value < -0.05;
  const good = invert ? down : up;
  const bad = invert ? up : down;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-[12px]">
      <span
        className={cx(
          "inline-flex items-center gap-0.5 whitespace-nowrap rounded-md px-1.5 py-0.5 font-medium tabular",
          good && "bg-[color-mix(in_oklab,var(--good)_14%,transparent)] text-good",
          bad && "bg-[color-mix(in_oklab,var(--critical)_14%,transparent)] text-critical",
          !good && !bad && "bg-surface-3 text-ink-2",
        )}
      >
        <Icon size={12} strokeWidth={2.4} />
        {fmtPct(value)}
      </span>
      {label && <span className="whitespace-nowrap text-ink-3">{label}</span>}
    </span>
  );
}

export function Badge({ children, color, className }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[11.5px] font-medium text-ink-2", className)}>
      {color && <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: color }} />}
      {children}
    </span>
  );
}

export function Segmented<T extends string>({ value, options, onChange, size = "md", ariaLabel }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; size?: "sm" | "md"; ariaLabel: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="relative inline-flex rounded-lg border border-line bg-surface-2 p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx("relative z-10 rounded-md font-medium transition-colors", size === "sm" ? "px-2 py-1 text-[11.5px]" : "px-2.5 py-1 text-[12.5px]", active ? "text-ink" : "text-ink-3 hover:text-ink-2")}
          >
            {active && (
              <motion.span layoutId={`seg-${ariaLabel}`} className="absolute inset-0 -z-10 rounded-md border border-line-strong bg-surface-3 shadow-sm" transition={{ type: "spring", duration: 0.32, bounce: 0.12 }} />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "secondary",
  size = "md",
  disabled,
  className,
  type = "button",
  ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
  ariaLabel?: string;
}) {
  return (
    <button
      type={type}
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex select-none items-center justify-center gap-1.5 rounded-lg font-medium transition-[background,color,transform,border-color] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45",
        size === "sm" ? "h-7 px-2.5 text-[12px]" : "h-9 px-3.5 text-[13px]",
        variant === "primary" && "bg-brand text-brand-ink hover:brightness-110",
        variant === "secondary" && "border border-line-strong bg-surface-2 text-ink hover:bg-surface-3",
        variant === "ghost" && "text-ink-2 hover:bg-hover hover:text-ink",
        variant === "danger" && "border border-[color-mix(in_oklab,var(--critical)_40%,transparent)] text-critical hover:bg-[color-mix(in_oklab,var(--critical)_10%,transparent)]",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton", className)} />;
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl border border-line bg-surface-2 text-ink-2">{icon}</div>}
      <p className="text-[14px] font-semibold text-ink">{title}</p>
      {children && <div className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-3">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Popover simple: clic fuera y Escape cierran. */
export function Popover({ trigger, children, align = "start", width = 280, open: openProp, onOpenChange }: { trigger: (open: boolean) => ReactNode; children: ReactNode | ((close: () => void) => ReactNode); align?: "start" | "end"; width?: number; open?: boolean; onOpenChange?: (o: boolean) => void }) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (o: boolean) => (onOpenChange ? onOpenChange(o) : setOpenState(o));
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  });
  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen(!open)}>{trigger(open)}</div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -2, scale: 0.99 }}
            transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
            style={{ width, transformOrigin: align === "start" ? "top left" : "top right" }}
            className={cx("absolute top-[calc(100%+6px)] z-50 max-w-[calc(100vw-24px)] rounded-xl border border-line-strong bg-surface-2 p-1.5 shadow-2xl", align === "start" ? "left-0" : "right-0")}
          >
            {typeof children === "function" ? children(() => setOpen(false)) : children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Stat({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[12px] text-ink-3">{label}</div>
      <div className="mt-0.5 truncate text-[18px] font-semibold tracking-[-0.02em] tabular text-ink">{value}</div>
      {hint && <div className="text-[11.5px] text-ink-3">{hint}</div>}
    </div>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" }) {
  return (
    <div className={cx("flex items-start gap-2 rounded-lg border px-3 py-2 text-[12.5px] leading-relaxed", tone === "warn" ? "border-[color-mix(in_oklab,var(--warning)_35%,transparent)] bg-[color-mix(in_oklab,var(--warning)_8%,transparent)] text-ink-2" : "border-line bg-surface-2 text-ink-2")}>
      <Info size={14} className="mt-0.5 shrink-0 text-ink-3" />
      <div>{children}</div>
    </div>
  );
}
