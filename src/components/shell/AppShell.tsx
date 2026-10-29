"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  LayoutDashboard, FileText, Zap, Building2, Users, Map, Coins, TriangleAlert, Contact, Sparkles, FileBarChart, Upload, Settings, Menu, X, Sun, Moon, ShieldCheck, Shield,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useData } from "@/lib/useData";
import { cx, Skeleton } from "@/components/ui/primitives";
import { FilterBar } from "./FilterBar";
import { ClientSheet, ContractDetail, ContractsDrawer, Toast, UnlockDialog } from "@/components/overlays/Overlays";
import { detectIncidents, PRIORITY_ORDER } from "@/lib/incidents";
import { fmtInt } from "@/lib/format";
import { fmtDate } from "@/lib/dates";

export const NAV = [
  { group: "Análisis", items: [
    { href: "/", label: "Overview", icon: LayoutDashboard },
    { href: "/contratos", label: "Contratos", icon: FileText },
    { href: "/energia", label: "Energía y consumo", icon: Zap },
    { href: "/comercializadoras", label: "Comercializadoras", icon: Building2 },
    { href: "/comerciales", label: "Comerciales y colaboradores", icon: Users },
    { href: "/mapa", label: "Mapa de negocio", icon: Map },
    { href: "/comisiones", label: "Comisiones", icon: Coins },
  ]},
  { group: "Operación", items: [
    { href: "/incidencias", label: "Pendientes e incidencias", icon: TriangleAlert },
    { href: "/clientes", label: "Clientes", icon: Contact },
    { href: "/ia", label: "Pregunta a tus datos", icon: Sparkles },
    { href: "/informes", label: "Informes", icon: FileBarChart },
  ]},
  { group: "Datos", items: [
    { href: "/importar", label: "Importar datos", icon: Upload },
    { href: "/configuracion", label: "Configuración", icon: Settings },
  ]},
];

const NO_FILTERS = ["/importar", "/configuracion"];

function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill="var(--brand)" />
        <path d="M7 22.5 L12.5 15 L17 19 L25 9" stroke="var(--brand-ink)" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="25" cy="9" r="2.3" fill="var(--brand-ink)" />
      </svg>
      {!compact && (
        <div className="leading-none">
          <div className="text-[14px] font-bold tracking-[-0.02em]">Assessoria 3.0</div>
          <div className="mt-1 text-[11px] font-medium text-ink-3">Intelligence</div>
        </div>
      )}
    </div>
  );
}

function NavList({ onNavigate, alerts }: { onNavigate?: () => void; alerts: number }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-5" aria-label="Secciones">
      {NAV.map((g) => (
        <div key={g.group}>
          <p className="mb-1.5 px-3 text-[11px] font-medium text-ink-3">{g.group}</p>
          <ul className="flex flex-col gap-0.5">
            {g.items.map((it) => {
              const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
              const Icon = it.icon;
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cx("group relative flex h-8 items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium transition-colors", active ? "text-ink" : "text-ink-2 hover:bg-hover hover:text-ink")}
                  >
                    {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-lg border border-line bg-surface-2" transition={{ type: "spring", duration: 0.35, bounce: 0.1 }} />}
                    {active && <motion.span layoutId="nav-bar" className="absolute -left-3 top-1.5 h-5 w-[3px] rounded-r bg-brand" transition={{ type: "spring", duration: 0.35, bounce: 0.1 }} />}
                    <Icon size={15} className={cx("relative transition-colors", active ? "text-brand" : "text-ink-3 group-hover:text-ink-2")} />
                    <span className="relative flex-1 truncate">{it.label}</span>
                    {it.href === "/incidencias" && alerts > 0 && (
                      <span className="relative rounded-md bg-[color-mix(in_oklab,var(--critical)_16%,transparent)] px-1.5 text-[10.5px] font-semibold tabular text-critical">{fmtInt(alerts)}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function titleFor(path: string) {
  for (const g of NAV) for (const it of g.items) if (it.href === "/" ? path === "/" : path.startsWith(it.href)) return it.label;
  return "Assessoria 3.0";
}

export function AppShell({ children }: { children: ReactNode }) {
  const hydrate = useStore((s) => s.hydrate);
  const updateSettings = useStore((s) => s.updateSettings);
  const imports = useStore((s) => s.imports);
  const unlocked = useStore((s) => s.sensitiveUnlocked);
  const { hydrated, settings, all, ref } = useData();
  const path = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const alerts = useMemo(() => (all.length ? detectIncidents(all, ref, settings).filter((i) => PRIORITY_ORDER[i.priority] === 0).length : 0), [all, ref, settings]);
  const last = imports[0];

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar escritorio */}
      <aside className="sticky top-0 hidden h-dvh w-[252px] shrink-0 flex-col border-r border-line bg-[color-mix(in_oklab,var(--bg)_70%,var(--surface))] px-3 py-5 lg:flex">
        <div className="px-3"><Logo /></div>
        <div className="mt-7 flex-1 overflow-y-auto scroll-thin"><NavList alerts={alerts} /></div>
        <div className="mt-4 rounded-xl border border-line bg-surface p-3 text-[11.5px] leading-relaxed text-ink-3">
          {last ? (
            <>
              <div className="font-medium text-ink-2">{fmtInt(all.length)} contratos cargados</div>
              <div className="truncate" title={last.fileName}>{last.fileName}</div>
              <div>Importado el {fmtDate(last.date.slice(0, 10))}</div>
            </>
          ) : (
            <div>Sin datos. Importa una exportación del CRM para empezar.</div>
          )}
        </div>
      </aside>

      {/* Sidebar móvil */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-[70] lg:hidden">
            <motion.div className="absolute inset-0 bg-black/55" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ duration: 0.26, ease: [0.23, 1, 0.32, 1] }} className="absolute bottom-0 left-0 top-0 w-[272px] overflow-y-auto border-r border-line bg-surface px-3 py-5">
              <div className="mb-6 flex items-center justify-between px-3">
                <Logo />
                <button onClick={() => setMobileOpen(false)} aria-label="Cerrar menú" className="text-ink-3"><X size={18} /></button>
              </div>
              <NavList alerts={alerts} onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-40 border-b lg:sticky lg:top-0 border-line bg-[color-mix(in_oklab,var(--bg)_82%,transparent)] backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-[1600px] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <button className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menú"><Menu size={20} /></button>
            <div className="lg:hidden"><Logo compact /></div>
            <h1 className="min-w-0 truncate text-[15px] font-semibold tracking-[-0.015em]">{titleFor(path)}</h1>
            <div className="ml-auto flex items-center gap-1.5">
              <span
                title={settings.role === "admin" ? (unlocked ? "Datos sensibles visibles" : "Administrador: datos sensibles ocultos") : "Datos sensibles ocultos"}
                className="hidden items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-[11.5px] font-medium text-ink-2 sm:inline-flex"
              >
                {unlocked ? <ShieldCheck size={13} className="text-warning" /> : <Shield size={13} className="text-ink-3" />}
                {settings.role === "admin" ? "Administrador" : settings.role === "gestor" ? "Gestor" : "Solo lectura"}
              </span>
              <button
                onClick={() => updateSettings({ theme: settings.theme === "dark" ? "light" : "dark" })}
                className="grid h-8 w-8 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-hover hover:text-ink"
                aria-label={settings.theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span key={settings.theme} initial={{ rotate: -45, opacity: 0, scale: 0.8 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} exit={{ rotate: 45, opacity: 0, scale: 0.8 }} transition={{ duration: 0.18 }}>
                    {settings.theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                  </motion.span>
                </AnimatePresence>
              </button>
            </div>
          </div>
          {hydrated && all.length > 0 && !NO_FILTERS.includes(path) && (
            <div className="mx-auto w-full max-w-[1600px] px-4 pb-3 sm:px-6 lg:px-8">
              <FilterBar />
            </div>
          )}
        </header>
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {hydrated ? (
            children
          ) : (
            <div className="grid gap-4" aria-busy="true" aria-label="Cargando">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
              <Skeleton className="h-80" />
              <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
            </div>
          )}
        </main>
      </div>
      <ContractsDrawer />
      <ContractDetail />
      <ClientSheet />
      <UnlockDialog />
      <Toast />
    </div>
  );
}
