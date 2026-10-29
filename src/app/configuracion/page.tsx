"use client";
import { useMemo, useState, type ReactNode } from "react";
import { Trash2, Database } from "lucide-react";
import { useStore } from "@/lib/store";
import { useData } from "@/lib/useData";
import { DEDUPE_FIELD_OPTIONS, keyText, normalizeComercializadora } from "@/lib/normalize";
import { countBy, OWNER_CATEGORY_LABEL, ranked } from "@/lib/metrics";
import { fmtInt } from "@/lib/format";
import { Button, cx, Notice, Panel, Segmented } from "@/components/ui/primitives";
import type { OwnerProfile, Settings } from "@/lib/types";

function Row({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-line py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="max-w-xl">
        <div className="text-[13.5px] font-medium">{label}</div>
        {hint && <div className="mt-0.5 text-[12.5px] leading-relaxed text-ink-3">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cx("relative h-6 w-10 rounded-full transition-colors duration-200", on ? "bg-brand" : "bg-surface-3 border border-line-strong")}>
      <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200", on ? "translate-x-[18px]" : "translate-x-0.5")} />
    </button>
  );
}

export default function ConfigPage() {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const clearData = useStore((s) => s.clearData);
  const notify = useStore((s) => s.notify);
  const unlocked = useStore((s) => s.sensitiveUnlocked);
  const setUnlocked = useStore((s) => s.setSensitiveUnlocked);
  const { all } = useData();
  const [pin, setPin] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => update({ [k]: v } as Partial<Settings>);

  const rawComs = useMemo(() => ranked(countBy(all, (c) => c.comercializadoraRaw ?? "(vacío)")).map((r) => ({ raw: r.key, n: r.n, current: r.items[0].comercializadora })), [all]);
  const both = useMemo(() => {
    const b = all.filter((c) => c.comisionVenta !== null && c.comisionSubdominio !== null);
    return { n: b.length, eq: b.filter((c) => c.comisionVenta === c.comisionSubdominio).length };
  }, [all]);
  const owners = useMemo(() => ranked(countBy(all, (c) => c.owners)).map((r) => ({ email: r.key, n: r.n })), [all]);

  const setOwner = (email: string, p: Partial<OwnerProfile>) => {
    const cur = settings.owners[email] ?? { name: "", category: "sin_clasificar" as const };
    update({ owners: { ...settings.owners, [email]: { ...cur, ...p } } });
  };

  return (
    <div className="mx-auto grid max-w-4xl gap-5">
      <div>
        <h2 className="text-[22px] font-semibold tracking-[-0.03em]">Configuración</h2>
        <p className="mt-1 text-[13.5px] text-ink-3">Los ajustes se guardan en este navegador y se aplican al instante en todos los módulos.</p>
      </div>

      <Panel title="Apariencia">
        <Row label="Tema">
          <Segmented ariaLabel="Tema" value={settings.theme} onChange={(v) => set("theme", v)} options={[{ value: "dark", label: "Oscuro" }, { value: "light", label: "Claro" }]} />
        </Row>
      </Panel>

      <Panel title="Acceso y privacidad" subtitle="Modo local: los datos no salen del navegador. Antes de centralizarlos en Supabase hay que activar la autenticación con roles (ver README).">
        <Row label="Rol en esta sesión" hint="Solo Administrador puede mostrar CIF, IBAN, teléfono y correo, buscar por ellos y exportarlos sin enmascarar.">
          <Segmented ariaLabel="Rol" value={settings.role} onChange={(v) => set("role", v)} options={[{ value: "admin", label: "Administrador" }, { value: "gestor", label: "Gestor" }, { value: "lectura", label: "Solo lectura" }]} />
        </Row>
        <Row label="PIN de administrador" hint={settings.adminPin ? "Hay un PIN definido. Se pedirá para mostrar datos sensibles." : "Sin PIN, el administrador puede mostrar datos sensibles con un clic."}>
          <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (pin.length >= 4) { set("adminPin", pin); setPin(""); notify("PIN guardado."); } }}>
            <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="4+ dígitos" aria-label="Nuevo PIN" className="h-8 w-28 rounded-md border border-line bg-surface-2 px-2 text-[13px] outline-none" />
            <Button size="sm" type="submit" disabled={pin.length < 4}>Guardar</Button>
            {settings.adminPin && <Button size="sm" variant="ghost" onClick={() => set("adminPin", null)}>Quitar</Button>}
          </form>
        </Row>
        <Row label="Datos sensibles visibles ahora" hint="Se vuelven a ocultar al recargar la página.">
          <Toggle label="Datos sensibles visibles" on={unlocked && settings.role === "admin"} onChange={(v) => (v ? useStore.getState().requestUnlock() : setUnlocked(false))} />
        </Row>
        <Row label="Guardar los contratos en este navegador" hint="Si lo desactivas, los datos solo existen hasta cerrar la pestaña.">
          <Toggle label="Guardar localmente" on={settings.persistLocally} onChange={(v) => set("persistLocally", v)} />
        </Row>
        <Row label="Borrar todos los datos" hint={`${fmtInt(all.length)} contratos y el historial de importaciones de este navegador.`}>
          {confirmClear ? (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>Cancelar</Button>
              <Button size="sm" variant="danger" onClick={async () => { await clearData(); setConfirmClear(false); notify("Datos borrados de este navegador."); }}>Confirmar borrado</Button>
            </div>
          ) : (
            <Button size="sm" variant="danger" onClick={() => setConfirmClear(true)} disabled={!all.length}><Trash2 size={13} /> Borrar</Button>
          )}
        </Row>
      </Panel>

      <Panel title="Reglas de cálculo">
        <Row label="Unidad del campo Consumo" hint="El Excel no lo indica. Los valores (mediana ≈ 3.000 en 2.0TD) encajan con kWh anuales.">
          <div className="flex flex-col items-end gap-2">
            <Segmented ariaLabel="Unidad de consumo" value={settings.consumoUnit} onChange={(v) => set("consumoUnit", v)} options={[{ value: "kWh", label: "kWh" }, { value: "MWh", label: "MWh" }]} />
            <Segmented ariaLabel="Periodicidad del consumo" value={settings.consumoPeriod} onChange={(v) => set("consumoPeriod", v)} options={[{ value: "anual", label: "Anual" }, { value: "desconocido", label: "Desconocida" }]} />
          </div>
        </Row>
        <Row label="Unidad confirmada" hint="Quita el aviso de «unidad supuesta» de indicadores e informes.">
          <Toggle label="Unidad confirmada" on={settings.consumoConfirmed} onChange={(v) => set("consumoConfirmed", v)} />
        </Row>
        <Row label="Comisión total registrada" hint={`En ${fmtInt(both.n)} contratos hay ambos importes y ${fmtInt(both.eq)} coinciden${both.n && both.eq / both.n < 0.1 ? ": parecen conceptos distintos" : ""}. Si representan lo mismo, usa solo uno.`}>
          <Segmented ariaLabel="Cálculo de comisión total" value={settings.commissionMode} onChange={(v) => set("commissionMode", v)} options={[{ value: "sum", label: "Venta + subdominio" }, { value: "venta", label: "Solo venta" }, { value: "subdominio", label: "Solo subdominio" }, { value: "none", label: "No combinar" }]} />
        </Row>
        <Row label="Fecha base de los filtros de período" hint="Las altas comerciales usan la tramitación (idéntica a la carterización en el Excel).">
          <Segmented ariaLabel="Fecha base" value={settings.dateBasis} onChange={(v) => set("dateBasis", v)} options={[{ value: "fTramitacion", label: "Tramitación" }, { value: "fActivacion", label: "Activación" }, { value: "fTraspaso", label: "Traspaso" }]} />
        </Row>
        <Row label="Fecha de referencia" hint="Para «hoy», «esta semana» y «este mes». Usa la última fecha del archivo si analizas una exportación antigua.">
          <Segmented ariaLabel="Fecha de referencia" value={settings.referenceDate} onChange={(v) => set("referenceDate", v)} options={[{ value: "hoy", label: "Hoy" }, { value: "ultima_fecha", label: "Última fecha del archivo" }]} />
        </Row>
        <Row label="Regla de antigüedad elevada" hint="Marca como aviso los contratos no activados que superen estos días desde la tramitación.">
          <div className="flex items-center gap-3">
            <Toggle label="Regla de antigüedad" on={settings.ageRuleEnabled} onChange={(v) => set("ageRuleEnabled", v)} />
            <input type="number" min={1} max={3650} value={settings.ageThresholdDays} onChange={(e) => set("ageThresholdDays", Math.max(1, +e.target.value || 30))} aria-label="Días de antigüedad" className="h-8 w-20 rounded-md border border-line bg-surface-2 px-2 text-right text-[13px] tabular outline-none" />
            <span className="text-[12.5px] text-ink-3">días</span>
          </div>
        </Row>
      </Panel>

      <Panel title="Deduplicación" subtitle="El CRM no exporta un identificador de contrato. La clave se forma con estos campos y el número de aparición dentro del archivo.">
        <div className="flex flex-wrap gap-1.5">
          {DEDUPE_FIELD_OPTIONS.map((f) => {
            const on = settings.dedupeFields.includes(f.key);
            return (
              <button key={f.key} aria-pressed={on} onClick={() => set("dedupeFields", on ? settings.dedupeFields.filter((x) => x !== f.key) : [...settings.dedupeFields, f.key])} className={cx("rounded-lg border px-2.5 py-1.5 text-[12.5px] transition-colors", on ? "border-brand bg-brand-soft text-ink" : "border-line text-ink-2 hover:text-ink")}>
                {f.label}
              </button>
            );
          })}
        </div>
        <div className="mt-3"><Notice>Cambiar la clave afecta a las próximas importaciones. Para aplicarla a los datos actuales, vuelve a importar el archivo en modo «Sustituir». Evita campos que cambian con el tiempo (estado, fechas) si vas a fusionar exportaciones sucesivas.</Notice></div>
      </Panel>

      <Panel title="Alias de comercializadoras" subtitle="Unifica nombres escritos de forma distinta. Se aplica en la próxima importación.">
        {rawComs.length === 0 ? (
          <p className="text-[13px] text-ink-3">Importa un archivo para ver los valores originales.</p>
        ) : (
          <div className="grid gap-1">
            {rawComs.map((c) => (
              <div key={c.raw} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-line py-1.5 text-[12.5px]">
                <span className="truncate text-ink-2">{c.raw} <span className="text-ink-3">· {fmtInt(c.n)}</span></span>
                <span className="text-ink-3">→</span>
                <input
                  defaultValue={settings.comercializadoraAliases[keyText(c.raw)] ?? c.current}
                  aria-label={`Alias para ${c.raw}`}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    const k = keyText(c.raw);
                    const next = { ...settings.comercializadoraAliases };
                    if (!v || v === normalizeComercializadora(c.raw === "(vacío)" ? null : c.raw, {})) delete next[k];
                    else next[k] = v;
                    set("comercializadoraAliases", next);
                  }}
                  className="h-7 rounded-md border border-line bg-surface-2 px-2 text-[12.5px] outline-none focus:border-line-strong"
                />
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Usuarios propietarios" subtitle="Asigna nombre comercial y categoría a cada correo del CRM.">
        <Row label="Excluir cuentas administrativas de los rankings" hint="Útil si la cuenta general de la empresa concentra contratos sin ser un comercial.">
          <Toggle label="Excluir administrativas" on={settings.excludeAdminFromRanking} onChange={(v) => set("excludeAdminFromRanking", v)} />
        </Row>
        <div className="mt-2 grid gap-1">
          {owners.map((o) => {
            const p = settings.owners[o.email];
            return (
              <div key={o.email} className="grid items-center gap-2 border-b border-line py-2 text-[12.5px] md:grid-cols-[1.3fr_1fr_auto]">
                <span className="truncate text-ink-2">{o.email} <span className="text-ink-3">· {fmtInt(o.n)}</span></span>
                <input defaultValue={p?.name ?? ""} placeholder="Nombre comercial" aria-label={`Nombre para ${o.email}`} onBlur={(e) => setOwner(o.email, { name: e.target.value.trim() })} className="h-7 rounded-md border border-line bg-surface-2 px-2 outline-none focus:border-line-strong" />
                <select value={p?.category ?? "sin_clasificar"} onChange={(e) => setOwner(o.email, { category: e.target.value as OwnerProfile["category"] })} aria-label={`Categoría de ${o.email}`} className="h-7 rounded-md border border-line bg-surface-2 px-1.5 text-ink outline-none">
                  {(Object.keys(OWNER_CATEGORY_LABEL) as OwnerProfile["category"][]).map((c) => <option key={c} value={c}>{OWNER_CATEGORY_LABEL[c]}</option>)}
                </select>
              </div>
            );
          })}
          {!owners.length && <p className="text-[13px] text-ink-3">Importa un archivo para ver los usuarios.</p>}
        </div>
      </Panel>

      <Panel title={<span className="flex items-center gap-2"><Database size={14} /> Almacenamiento centralizado</span>}>
        <p className="text-[13px] leading-relaxed text-ink-2">
          La aplicación funciona hoy en modo local (IndexedDB del navegador). El proyecto incluye el esquema de Supabase con seguridad a nivel de fila por rol (<code className="rounded bg-surface-2 px-1">supabase/schema.sql</code>) y una capa de repositorio preparada. No se activa el almacenamiento centralizado de datos personales hasta configurar la autenticación y los roles, tal como se describe en el README.
        </p>
      </Panel>
    </div>
  );
}
