"use client";
import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useData } from "@/lib/useData";
import { useStore } from "@/lib/store";
import { applyFilters, commissionOf, computeKpis, countBy, growth, hasCommission, ownerCategory, ownerLabel, PENDING_STATES, ranked, sum } from "@/lib/metrics";
import { addDays, addMonths, startOfMonth, startOfWeek } from "@/lib/dates";
import { fmtDec, fmtEur, fmtInt } from "@/lib/format";
import { tipoColor, STATUS } from "@/lib/palette";
import { detectIncidents, INCIDENT_META, type IncidentType } from "@/lib/incidents";
import { TimelinePanel } from "@/components/charts/TimelinePanel";
import { StatePipeline } from "@/components/charts/StatePipeline";
import { FilteredEmpty, KpiTile, NoData, RankBars } from "@/components/ui/kpi";
import { Badge, Panel } from "@/components/ui/primitives";
import { motion } from "motion/react";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.035 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } } };

export default function Overview() {
  const { all, rows, settings, ref, filters, comColors, empty } = useData();
  const toggle = useStore((s) => s.toggleFilter);

  const k = useMemo(() => computeKpis(rows, ref, settings), [rows, ref, settings]);
  const ids = useMemo(() => {
    const b = settings.dateBasis;
    const mStart = startOfMonth(ref), wStart = startOfWeek(ref);
    const pick = (fn: (c: (typeof rows)[number]) => boolean) => rows.filter(fn).map((c) => c.id);
    return {
      all: rows.map((c) => c.id),
      mes: pick((c) => !!c[b] && c[b]! >= mStart && c[b]! <= ref),
      semana: pick((c) => !!c[b] && c[b]! >= wStart && c[b]! <= ref),
      hoy: pick((c) => c[b] === ref),
      activados: pick((c) => c.estado === "activado"),
      pendientes: pick((c) => PENDING_STATES.includes(c.estado)),
      firmados: pick((c) => c.estado === "firmado"),
      tramitados: pick((c) => c.estado === "tramitado"),
      comisionados: pick((c) => c.estado === "comisionado"),
      bajas: pick((c) => c.estado === "baja" || c.estado === "anulado"),
      luz: pick((c) => c.tipo === "luz" && c.consumo !== null),
      gas: pick((c) => c.tipo === "gas" && c.consumo !== null),
      comision: pick((c) => hasCommission(c)),
      sinComision: pick((c) => !hasCommission(c)),
    };
  }, [rows, ref, settings.dateBasis]);

  // comparación del mes en curso vs mismo tramo del mes anterior (sin filtro de fecha)
  const prevMonth = useMemo(() => {
    const base = applyFilters(all, filters, settings.dateBasis, "date");
    const b = settings.dateBasis;
    const mFrom = addMonths(startOfMonth(ref), -1), mTo = addMonths(ref, -1);
    const wFrom = addDays(startOfWeek(ref), -7), wTo = addDays(ref, -7);
    const n = (from: string, to: string) => base.filter((c) => !!c[b] && c[b]! >= from && c[b]! <= to).length;
    return { mes: n(mFrom, mTo), semana: n(wFrom, wTo) };
  }, [all, filters, settings.dateBasis, ref]);

  const comRank = useMemo(() => ranked(countBy(rows, (c) => c.comercializadora)).map((r) => ({ key: r.key, label: r.key, value: r.n, color: comColors[r.key] })), [rows, comColors]);
  const ownerRank = useMemo(
    () =>
      ranked(countBy(rows, (c) => c.owners))
        .filter((r) => !(settings.excludeAdminFromRanking && ownerCategory(r.key, settings) === "administrativa"))
        .map((r) => ({ key: r.key, label: ownerLabel(r.key, settings), value: r.n, color: "var(--s1)" })),
    [rows, settings],
  );
  const tarifaRank = useMemo(() => ranked(countBy(rows, (c) => c.tarifa)).map((r) => ({ key: r.key, label: r.key, value: r.n, color: tipoColor(r.items[0].tipo, settings.theme) })), [rows, settings.theme]);
  const incidents = useMemo(() => detectIncidents(rows, ref, settings), [rows, ref, settings]);
  const incByType = useMemo(() => {
    const m = new Map<IncidentType, number>();
    for (const i of incidents) m.set(i.type, (m.get(i.type) ?? 0) + 1);
    return (Object.keys(INCIDENT_META) as IncidentType[]).filter((t) => m.get(t)).map((t) => ({ t, n: m.get(t)! }));
  }, [incidents]);

  if (empty) return <NoData />;
  if (!rows.length) return <FilteredEmpty />;

  const unitFlag = !settings.consumoConfirmed && <Badge className="text-[10.5px]">unidad supuesta</Badge>;

  return (
    <motion.div className="grid gap-4" variants={stagger} initial="hidden" animate="show">
      <div className="grid gap-4 xl:grid-cols-12">
        <motion.div variants={item} className="xl:col-span-8">
          <TimelinePanel hero />
        </motion.div>
        <div className="grid grid-cols-2 gap-4 xl:col-span-4 [&>*]:min-w-0">
          <motion.div variants={item}><KpiTile label="Total contratos" value={k.total} ids={ids.all} hint="registros" info="Cada fila de la exportación es un contrato. No equivale a clientes." className="h-full" /></motion.div>
          <motion.div variants={item}><KpiTile label="Clientes únicos" value={k.clientes} hint={`${fmtDec(k.total / Math.max(1, k.clientes))} contratos/cliente`} info="Por CIF/NIF normalizado; si falta, por nombre." className="h-full" /></motion.div>
          <motion.div variants={item}><KpiTile label="CUPS únicos" value={k.cups} hint="puntos de suministro" className="h-full" /></motion.div>
          <motion.div variants={item}>
            <KpiTile
              label="Comisión total registrada"
              value={k.comTotal}
              format={(n) => fmtEur(n)}
              ids={ids.comision}
              hint={settings.commissionMode === "sum" ? "venta + subdominio" : settings.commissionMode === "none" ? "configura el cálculo" : `solo ${settings.commissionMode}`}
              info="Importes registrados en el Excel. No indica si están cobrados. Modo de cálculo editable en Configuración."
              className="h-full"
            />
          </motion.div>
          <motion.div variants={item} className="col-span-2">
            <div className="panel grid grid-cols-2 divide-x divide-[var(--border)] p-0">
              <div className="p-4">
                <div className="text-[12.5px] font-medium text-ink-2">Comisión venta</div>
                <div className="mt-1.5 text-[20px] font-semibold tabular tracking-[-0.02em]">{fmtEur(k.comVenta)}</div>
              </div>
              <div className="p-4">
                <div className="text-[12.5px] font-medium text-ink-2">Comisión subdominio</div>
                <div className="mt-1.5 text-[20px] font-semibold tabular tracking-[-0.02em]">{fmtEur(k.comSub)}</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <motion.div variants={item} className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6 [&>*]:min-w-0">
        <KpiTile label="Nuevos este mes" value={k.nuevosMes} ids={ids.mes} delta={growth(k.nuevosMes, prevMonth.mes)} deltaLabel="vs mes ant." info="Contratos cuya fecha base (tramitación por defecto) cae en el mes en curso." />
        <KpiTile label="Esta semana" value={k.semana} ids={ids.semana} delta={growth(k.semana, prevMonth.semana)} deltaLabel="vs sem. ant." />
        <KpiTile label="Hoy" value={k.hoy} ids={ids.hoy} hint={ref.split("-").reverse().join("/")} />
        <KpiTile label="Firmados" value={k.firmados} ids={ids.firmados} hint="estado actual" info="Firmado no implica activado." />
        <KpiTile label="Tramitados" value={k.tramitados} ids={ids.tramitados} hint="estado actual" />
        <KpiTile label="Activados" value={k.activados} ids={ids.activados} hint={`${fmtInt(k.conFechaActivacion)} con fecha de activación`} info="Estado actual «Activado». Muchos comisionados también tienen fecha de activación: se muestran aparte." />
        <KpiTile label="Comisionados" value={k.comisionados} ids={ids.comisionados} hint="estado actual" info="Estado del CRM. No equivale a comisión cobrada." />
        <KpiTile label="Pendientes" value={k.pendientes} ids={ids.pendientes} hint="incl. pdte. activación" />
        <KpiTile label="Bajas y anulados" value={k.bajas + k.anulados} ids={ids.bajas} hint={`${fmtInt(k.bajas)} bajas · ${fmtInt(k.anulados)} anulados`} />
        <KpiTile label="Electricidad gestionada" value={k.consumoLuz} format={(n) => `${fmtInt(n)} MWh`} ids={ids.luz} hint={`${fmtInt(k.consumoLuzN)} contratos con consumo`} flag={unitFlag} info={`Suma del campo Consumo en contratos de luz, convertido de ${settings.consumoUnit} a MWh. ${settings.consumoConfirmed ? "Unidad confirmada." : "Unidad no confirmada: revisa Configuración."}`} />
        <KpiTile label="Gas gestionado" value={k.consumoGas} format={(n) => `${fmtInt(n)} MWh`} ids={ids.gas} hint={`${fmtInt(k.consumoGasN)} contratos con consumo`} flag={unitFlag} info="Se suma por separado de la electricidad." />
        <KpiTile label="Sin comisión registrada" value={k.sinComision} ids={ids.sinComision} hint={`${fmtInt(rows.length ? (k.sinComision / rows.length) * 100 : 0)} % del total`} />
      </motion.div>

      <div className="grid gap-4 xl:grid-cols-12">
        <motion.div variants={item} className="xl:col-span-7">
          <Panel title="Estado actual de la cartera" subtitle="Clic en la barra para filtrar; en la leyenda para ver los contratos" className="h-full">
            <StatePipeline />
          </Panel>
        </motion.div>
        <motion.div variants={item} className="xl:col-span-5">
          <Panel title="Pendientes e incidencias" subtitle={`${fmtInt(incidents.length)} avisos sobre ${fmtInt(rows.length)} contratos`} actions={<Link href="/incidencias" className="inline-flex items-center gap-1 text-[12.5px] text-ink-2 hover:text-ink">Abrir centro <ArrowRight size={13} /></Link>} className="h-full">
            <ul className="grid gap-0.5">
              {incByType.slice(0, 7).map(({ t, n }) => {
                const p = INCIDENT_META[t].priority;
                return (
                  <li key={t}>
                    <Link href={`/incidencias?tipo=${t}`} className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 text-[12.5px] transition-colors hover:bg-hover">
                      <span className="h-2 w-2 rounded-full" style={{ background: p === "alta" ? STATUS.critical : p === "media" ? STATUS.serious : STATUS.warning }} aria-hidden />
                      <span className="flex-1 text-ink-2">{INCIDENT_META[t].label}</span>
                      <span className="text-[11px] text-ink-3">{p}</span>
                      <span className="w-12 text-right font-semibold tabular">{fmtInt(n)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </motion.div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div variants={item}>
          <Panel title="Distribución por comercializadora" subtitle="Clic para filtrar todo el panel" actions={<Link href="/comercializadoras" className="text-[12.5px] text-ink-2 hover:text-ink">Ranking</Link>} className="h-full">
            <RankBars items={comRank} max={8} onSelect={(key) => toggle("comercializadoras", key)} selected={filters.comercializadoras} />
          </Panel>
        </motion.div>
        <motion.div variants={item}>
          <Panel title="Ranking comercial" subtitle="Contratos aportados por usuario propietario" actions={<Link href="/comerciales" className="text-[12.5px] text-ink-2 hover:text-ink">Leaderboard</Link>} className="h-full">
            <RankBars items={ownerRank} max={8} onSelect={(key) => toggle("owners", key)} selected={filters.owners} />
          </Panel>
        </motion.div>
        <motion.div variants={item}>
          <Panel title="Mix por tarifa" subtitle="Electricidad, gas y telecomunicaciones" actions={<Link href="/energia" className="text-[12.5px] text-ink-2 hover:text-ink">Energía</Link>} className="h-full">
            <RankBars items={tarifaRank} max={8} onSelect={(key) => toggle("tarifas", key)} selected={filters.tarifas} />
            <div className="mt-3 flex flex-wrap gap-3 border-t border-line pt-3 text-[11.5px] text-ink-3">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: tipoColor("luz", settings.theme) }} />Electricidad</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: tipoColor("gas", settings.theme) }} />Gas</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: tipoColor("telefonia", settings.theme) }} />Telecomunicaciones</span>
            </div>
          </Panel>
        </motion.div>
      </div>
      <p className="text-[11.5px] text-ink-3">
        Total comisiones ({settings.commissionMode === "sum" ? "venta + subdominio" : settings.commissionMode}): {fmtEur(sum(rows, (c) => commissionOf(c, settings.commissionMode)))} sobre {fmtInt(ids.comision.length)} contratos con importe. Fecha de referencia {ref.split("-").reverse().join("/")}.
      </p>
    </motion.div>
  );
}
