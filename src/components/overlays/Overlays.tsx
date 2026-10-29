"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Eye, EyeOff, Lock, X, Download, UserRound } from "lucide-react";
import { useStore } from "@/lib/store";
import { useData } from "@/lib/useData";
import { DataTable } from "@/components/ui/DataTable";
import { Badge, Button, cx, Stat } from "@/components/ui/primitives";
import { contractColumns } from "@/components/contracts/columns";
import { ESTADO_LABEL, TIPO_LABEL } from "@/lib/normalize";
import { estadoColor, tipoColor } from "@/lib/palette";
import { fmtDate } from "@/lib/dates";
import { fmtDec, fmtEur, fmtInt, mask } from "@/lib/format";
import { clientKeyOf, ownerLabel, sum } from "@/lib/metrics";
import { ISSUE_LABEL } from "@/lib/import/quality";
import { exportContracts } from "@/lib/export";
import type { Contract } from "@/lib/types";

const ease = [0.23, 1, 0.32, 1] as const;

function Sheet({ open, onClose, children, width = 980, label }: { open: boolean; onClose: () => void; children: ReactNode; width?: number; label: string }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={label}>
          <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={onClose} />
          <motion.div
            className="absolute bottom-0 right-0 top-0 flex w-full flex-col border-l border-line-strong bg-surface shadow-2xl"
            style={{ maxWidth: width }}
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 30, opacity: 0 }}
            transition={{ duration: 0.28, ease }}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function SheetHeader({ title, subtitle, onClose, actions }: { title: ReactNode; subtitle?: ReactNode; onClose: () => void; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
      <div className="min-w-0">
        <h2 className="truncate text-[17px] font-semibold tracking-[-0.015em]">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[12.5px] text-ink-3">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <Button variant="ghost" size="sm" onClick={onClose} ariaLabel="Cerrar">
          <X size={16} />
        </Button>
      </div>
    </div>
  );
}

export function Sensitive({ value, kind }: { value: string | null; kind: "cif" | "iban" | "tel" | "email" | "text" }) {
  const unlocked = useStore((s) => s.sensitiveUnlocked);
  const role = useStore((s) => s.settings.role);
  const requestUnlock = useStore((s) => s.requestUnlock);
  const lock = useStore((s) => s.setSensitiveUnlocked);
  const show = unlocked && role === "admin";
  if (!value) return <span className="text-ink-3">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cx("tabular", !show && "text-ink-3")}>{show ? value : mask(value, kind)}</span>
      <button
        type="button"
        onClick={() => (show ? lock(false) : requestUnlock())}
        className="text-ink-3 transition-colors hover:text-ink"
        aria-label={show ? "Ocultar datos sensibles" : "Mostrar datos sensibles"}
      >
        {show ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </span>
  );
}

export function ContractsDrawer() {
  const drawer = useStore((s) => s.drawer);
  const close = useStore((s) => s.closeDrawer);
  const openContract = useStore((s) => s.openContract);
  const { byId, settings, comColors } = useData();
  const rows = useMemo(() => (drawer ? drawer.ids.map((id) => byId.get(id)).filter(Boolean) as Contract[] : []), [drawer, byId]);
  const cols = useMemo(() => contractColumns(settings, comColors), [settings, comColors]);
  const unlocked = useStore((s) => s.sensitiveUnlocked);
  return (
    <Sheet open={!!drawer} onClose={close} label={drawer?.title ?? "Contratos"} width={1180}>
      {drawer && (
        <>
          <SheetHeader
            title={drawer.title}
            subtitle={drawer.subtitle ?? `${fmtInt(rows.length)} registros originales que componen el indicador`}
            onClose={close}
            actions={
              <Button size="sm" onClick={() => exportContracts(rows, settings, "xlsx", drawer.title, unlocked && settings.role === "admin")}>
                <Download size={14} /> Excel
              </Button>
            }
          />
          <div className="min-h-0 flex-1 overflow-auto p-6 scroll-thin">
            <DataTable rows={rows} columns={cols} rowKey={(c) => c.id} onRowClick={(c) => openContract(c.id)} height={9999} placeholder="Buscar cliente, CUPS, municipio…" />
          </div>
        </>
      )}
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 text-[13px]">
      <span className="shrink-0 text-ink-3">{label}</span>
      <span className="min-w-0 text-right text-ink">{children}</span>
    </div>
  );
}

export function ContractDetail() {
  const id = useStore((s) => s.contractId);
  const close = useStore((s) => s.openContract);
  const openClient = useStore((s) => s.openClient);
  const { byId, settings } = useData();
  const c = id ? byId.get(id) : undefined;
  const m = settings.theme;
  return (
    <Sheet open={!!c} onClose={() => close(null)} label="Ficha de contrato" width={640}>
      {c && (
        <>
          <SheetHeader
            title={c.nombre}
            subtitle={`${TIPO_LABEL[c.tipo]} · fila ${c.sourceRow} de ${c.sourceFile}`}
            onClose={() => close(null)}
            actions={
              <Button size="sm" onClick={() => { close(null); openClient(clientKeyOf(c)); }}>
                <UserRound size={14} /> Ficha de cliente
              </Button>
            }
          />
          <div className="min-h-0 flex-1 overflow-auto px-6 pb-8 pt-4 scroll-thin">
            <div className="mb-4 flex flex-wrap gap-2">
              <Badge color={estadoColor(c.estado, m)}>{ESTADO_LABEL[c.estado]}</Badge>
              <Badge color={tipoColor(c.tipo, m)}>{c.tarifa}</Badge>
              <Badge>{c.comercializadora}</Badge>
              {c.issues.map((i) => (
                <Badge key={i} className="text-ink-3">{ISSUE_LABEL[i]}</Badge>
              ))}
            </div>
            <h3 className="mb-1 mt-4 text-[12px] font-semibold text-ink-3">Contrato</h3>
            <Field label="Producto">{c.producto ?? "—"}</Field>
            <Field label="CUPS"><span className="tabular">{c.cups ?? "—"}</span></Field>
            <Field label={`Consumo (${settings.consumoUnit}${settings.consumoConfirmed ? "" : ", unidad supuesta"})`}>{fmtInt(c.consumo)}</Field>
            <Field label="Potencia (kW)">{fmtDec(c.potencia)}</Field>
            <Field label="Potencias contratadas P1–P6 (kW)">{c.pContratada.some((x) => x !== null) ? c.pContratada.map((x) => (x === null ? "–" : fmtDec(x))).join(" · ") : "—"}</Field>
            <Field label="Operación">{[c.altaNueva && "Alta nueva", c.cambioComercializadora && "Cambio de comercializadora", c.cambioTitularidad && "Cambio de titularidad", c.cambioPotencia && "Cambio de potencia", c.bateriaVirtual && "Batería virtual"].filter(Boolean).join(", ") || "—"}</Field>
            <h3 className="mb-1 mt-5 text-[12px] font-semibold text-ink-3">Fechas</h3>
            <Field label="Carterización">{fmtDate(c.fCarterizacion)}</Field>
            <Field label="Tramitación">{fmtDate(c.fTramitacion)}</Field>
            <Field label="Activación">{fmtDate(c.fActivacion)}</Field>
            <Field label="Baja">{fmtDate(c.fBaja)}</Field>
            <Field label="Traspaso (CRM)">{fmtDate(c.fTraspaso)}</Field>
            <h3 className="mb-1 mt-5 text-[12px] font-semibold text-ink-3">Comisiones registradas</h3>
            <Field label="Comisión venta">{fmtEur(c.comisionVenta, true)}</Field>
            <Field label="Comisión subdominio">{fmtEur(c.comisionSubdominio, true)}</Field>
            <h3 className="mb-1 mt-5 text-[12px] font-semibold text-ink-3">Cliente</h3>
            <Field label="CIF/NIF"><Sensitive value={c.cif} kind="cif" /></Field>
            <Field label="Municipio">{[c.poblacion, c.provincia].filter(Boolean).join(", ") || "—"}</Field>
            <Field label="Código postal">{c.cp ?? "—"}</Field>
            <Field label="Dirección"><Sensitive value={c.direccion} kind="text" /></Field>
            <Field label="IBAN"><Sensitive value={c.iban} kind="iban" /></Field>
            <Field label="Teléfono"><Sensitive value={c.telefono} kind="tel" /></Field>
            <Field label="Correo"><Sensitive value={c.email} kind="email" /></Field>
            <Field label="Propietario">{c.owners.map((o) => ownerLabel(o, settings)).join(", ")}</Field>
            {c.observaciones && (
              <>
                <h3 className="mb-1 mt-5 text-[12px] font-semibold text-ink-3">Observaciones</h3>
                <p className="whitespace-pre-wrap rounded-lg border border-line bg-surface-2 p-3 text-[13px] leading-relaxed text-ink-2">{c.observaciones}</p>
              </>
            )}
            <h3 className="mb-1 mt-5 text-[12px] font-semibold text-ink-3">Valores originales del CRM</h3>
            <Field label="Estado">{c.estadoRaw || "—"}</Field>
            <Field label="Comercializadora">{c.comercializadoraRaw ?? "—"}</Field>
            <Field label="Tarifa">{c.tarifaRaw ?? "—"}</Field>
            <Field label="Provincia">{c.provinciaRaw ?? "—"}</Field>
          </div>
        </>
      )}
    </Sheet>
  );
}

export function ClientSheet() {
  const key = useStore((s) => s.clientKey);
  const close = useStore((s) => s.openClient);
  const openContract = useStore((s) => s.openContract);
  const { all, settings, comColors } = useData();
  const rows = useMemo(() => (key ? all.filter((c) => clientKeyOf(c) === key) : []), [all, key]);
  const cols = useMemo(() => contractColumns(settings, comColors, { compact: true }), [settings, comColors]);
  const first = rows[0];
  const active = rows.filter((c) => ["activado", "comisionado", "tramitado", "firmado", "pendiente_activacion"].includes(c.estado) && !c.fBaja);
  return (
    <Sheet open={!!key && rows.length > 0} onClose={() => close(null)} label="Ficha de cliente" width={1000}>
      {first && (
        <>
          <SheetHeader title={first.nombre} subtitle={[first.poblacion, first.provincia].filter(Boolean).join(", ")} onClose={() => close(null)} />
          <div className="min-h-0 flex-1 overflow-auto p-6 scroll-thin">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Contratos" value={fmtInt(rows.length)} hint={`${active.length} en vigor o en curso`} />
              <Stat label="CUPS" value={fmtInt(new Set(rows.map((r) => r.cups).filter(Boolean)).size)} />
              <Stat label={`Consumo luz + gas (${settings.consumoUnit})`} value={fmtInt(sum(rows.filter((r) => r.tipo === "luz" || r.tipo === "gas"), (r) => r.consumo))} hint="suma por separado en Energía" />
              <Stat label="Comisiones registradas" value={fmtEur(sum(rows, (r) => (r.comisionVenta ?? 0) + (r.comisionSubdominio ?? 0)))} hint="venta + subdominio" />
            </div>
            <div className="mt-5 grid gap-x-8 sm:grid-cols-2">
              <Field label="CIF/NIF"><Sensitive value={first.cif} kind="cif" /></Field>
              <Field label="Teléfono"><Sensitive value={first.telefono} kind="tel" /></Field>
              <Field label="Correo"><Sensitive value={first.email} kind="email" /></Field>
              <Field label="IBAN"><Sensitive value={first.iban} kind="iban" /></Field>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[...new Set(rows.map((r) => r.comercializadora))].map((x) => <Badge key={x} color={comColors[x]}>{x}</Badge>)}
              {[...new Set(rows.map((r) => r.tipo))].map((t) => <Badge key={t} color={tipoColor(t, settings.theme)}>{TIPO_LABEL[t]}</Badge>)}
            </div>
            <h3 className="mb-2 mt-6 text-[13px] font-semibold">Historial de contratos</h3>
            <DataTable rows={[...rows].sort((a, b) => (b.fTramitacion ?? b.fTraspaso ?? "").localeCompare(a.fTramitacion ?? a.fTraspaso ?? ""))} columns={cols} rowKey={(c) => c.id} onRowClick={(c) => openContract(c.id)} searchable={false} height={9999} />
            {rows.some((r) => r.observaciones) && (
              <>
                <h3 className="mb-2 mt-6 text-[13px] font-semibold">Observaciones</h3>
                <div className="space-y-2">
                  {rows.filter((r) => r.observaciones).map((r) => (
                    <div key={r.id} className="rounded-lg border border-line bg-surface-2 p-3 text-[12.5px] text-ink-2">
                      <div className="mb-1 text-[11.5px] text-ink-3">{r.comercializadora} · {r.tarifa} · {fmtDate(r.fTramitacion ?? r.fTraspaso)}</div>
                      <p className="whitespace-pre-wrap">{r.observaciones}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}

export function UnlockDialog() {
  const open = useStore((s) => s.unlockPrompt);
  const close = useStore((s) => s.closeUnlock);
  const pin = useStore((s) => s.settings.adminPin);
  const unlock = useStore((s) => s.setSensitiveUnlocked);
  const [v, setV] = useState("");
  const [err, setErr] = useState(false);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Desbloquear datos sensibles">
          <motion.div className="absolute inset-0 bg-black/55" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
          <motion.form
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2, ease }}
            className="panel relative w-full max-w-sm p-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (v === pin) {
                unlock(true);
                setV("");
                setErr(false);
                close();
              } else setErr(true);
            }}
          >
            <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand"><Lock size={18} /></div>
            <h2 className="text-[15px] font-semibold">Mostrar datos sensibles</h2>
            <p className="mt-1 text-[13px] text-ink-3">Introduce el PIN de administrador. Los datos se volverán a ocultar al recargar la página.</p>
            <input autoFocus type="password" inputMode="numeric" value={v} onChange={(e) => { setV(e.target.value); setErr(false); }} aria-label="PIN" className="mt-4 h-10 w-full rounded-lg border border-line-strong bg-surface-2 px-3 text-[14px] tracking-[0.3em] outline-none focus:border-brand" />
            {err && <p className="mt-2 text-[12.5px] text-critical">El PIN no coincide.</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={close}>Cancelar</Button>
              <Button variant="primary" type="submit">Desbloquear</Button>
            </div>
          </motion.form>
        </div>
      )}
    </AnimatePresence>
  );
}

export function Toast() {
  const toast = useStore((s) => s.toast);
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[90] -translate-x-1/2" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div key={toast.id} initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.22, ease }} className="max-w-md rounded-xl border border-line-strong bg-surface-3 px-4 py-2.5 text-[13px] text-ink shadow-2xl">
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
