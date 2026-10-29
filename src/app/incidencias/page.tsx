"use client";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Download } from "lucide-react";
import { useData } from "@/lib/useData";
import { useStore } from "@/lib/store";
import { detectIncidents, INCIDENT_META, type Incident, type IncidentType, type Priority } from "@/lib/incidents";
import { fmtInt } from "@/lib/format";
import { fmtDate } from "@/lib/dates";
import { estadoColor, STATUS } from "@/lib/palette";
import { ESTADO_LABEL } from "@/lib/normalize";
import { ownerLabel } from "@/lib/metrics";
import { EChart } from "@/components/charts/EChart";
import { barsOption } from "@/components/charts/builders";
import { FilteredEmpty, NoData, PageIntro } from "@/components/ui/kpi";
import { Badge, Button, cx, Notice, Panel } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { exportTable } from "@/lib/export";

const PCOLOR: Record<Priority, string> = { alta: STATUS.critical, media: STATUS.serious, baja: STATUS.warning };
const AGE = [
  { label: "≤ 7 días", max: 7 },
  { label: "8–30", max: 30 },
  { label: "31–60", max: 60 },
  { label: "61–90", max: 90 },
  { label: "91–180", max: 180 },
  { label: "> 180", max: Infinity },
];

export default function IncidenciasPage() {
  const { rows, settings, tokens: t, ref, comColors, empty } = useData();
  const openContract = useStore((s) => s.openContract);
  const [types, setTypes] = useState<IncidentType[]>([]);
  const [prio, setPrio] = useState<Priority | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("tipo") as IncidentType | null;
    if (q && INCIDENT_META[q]) setTypes([q]);
  }, []);

  const all = useMemo(() => detectIncidents(rows, ref, settings), [rows, ref, settings]);
  const counts = useMemo(() => {
    const byType = new Map<IncidentType, number>();
    const byPrio: Record<Priority, number> = { alta: 0, media: 0, baja: 0 };
    const contractsByPrio: Record<Priority, Set<string>> = { alta: new Set(), media: new Set(), baja: new Set() };
    for (const i of all) {
      byType.set(i.type, (byType.get(i.type) ?? 0) + 1);
      byPrio[i.priority]++;
      contractsByPrio[i.priority].add(i.c.id);
    }
    return { byType, byPrio, contractsByPrio };
  }, [all]);
  const list = useMemo(() => all.filter((i) => (!types.length || types.includes(i.type)) && (!prio || i.priority === prio)), [all, types, prio]);
  const ageChart = useMemo(() => {
    const prios: Priority[] = ["alta", "media", "baja"];
    return barsOption(t, AGE.map((a) => a.label), prios.map((p) => ({ name: `Prioridad ${p}`, color: PCOLOR[p], data: AGE.map((a, i) => list.filter((x) => x.priority === p && x.age !== null && x.age <= a.max && (i === 0 || x.age > AGE[i - 1].max)).length) })), { stack: true });
  }, [list, t]);

  const cols: Column<Incident>[] = [
    { key: "prio", header: "Prioridad", width: 100, cell: (i) => <span className="inline-flex items-center gap-1.5 text-ink"><span className="h-2 w-2 rounded-full" style={{ background: PCOLOR[i.priority] }} />{i.priority}</span>, sort: (i) => ({ alta: 0, media: 1, baja: 2 })[i.priority] },
    { key: "type", header: "Incidencia", width: 180, cell: (i) => INCIDENT_META[i.type].label, sort: (i) => i.type, search: (i) => INCIDENT_META[i.type].label },
    { key: "nombre", header: "Cliente", width: "minmax(190px,1.5fr)", cell: (i) => <span className="font-medium text-ink">{i.c.nombre}</span>, sort: (i) => i.c.nombre, search: (i) => `${i.c.nombre} ${i.c.cups ?? ""} ${i.c.poblacion ?? ""}` },
    { key: "estado", header: "Estado", width: 150, cell: (i) => <Badge color={estadoColor(i.c.estado, settings.theme)}>{ESTADO_LABEL[i.c.estado]}</Badge>, sort: (i) => i.c.estado, search: (i) => ESTADO_LABEL[i.c.estado] },
    { key: "com", header: "Comercializadora", width: 140, cell: (i) => <Badge color={comColors[i.c.comercializadora]}>{i.c.comercializadora}</Badge>, sort: (i) => i.c.comercializadora, search: (i) => i.c.comercializadora },
    { key: "age", header: "Antigüedad", width: 116, align: "right", cell: (i) => (i.age === null ? "—" : <span title={`desde ${i.ageFrom}`}>{fmtInt(i.age)} días</span>), sort: (i) => i.age },
    { key: "fTramitacion", header: "Tramitación", width: 104, cell: (i) => fmtDate(i.c.fTramitacion), sort: (i) => i.c.fTramitacion },
    { key: "owner", header: "Propietario", width: "minmax(140px,1fr)", cell: (i) => <span className="text-ink-3">{ownerLabel(i.c.ownerPrimary, settings)}</span>, sort: (i) => i.c.ownerPrimary, search: (i) => ownerLabel(i.c.ownerPrimary, settings) },
  ];

  if (empty) return <NoData />;
  if (!rows.length) return <FilteredEmpty />;

  const toggleType = (tp: IncidentType) => setTypes((cur) => (cur.includes(tp) ? cur.filter((x) => x !== tp) : [...cur, tp]));

  return (
    <div className="grid gap-4">
      <PageIntro
        title="Pendientes e incidencias"
        actions={
          <Button size="sm" onClick={() => exportTable([{ name: "Incidencias", rows: list.map((i) => ({ Prioridad: i.priority, Incidencia: INCIDENT_META[i.type].label, Cliente: i.c.nombre, Estado: ESTADO_LABEL[i.c.estado], Comercializadora: i.c.comercializadora, Tarifa: i.c.tarifa, CUPS: i.c.cups ?? "", "Antigüedad (días)": i.age ?? "", "Desde": i.ageFrom ?? "", Tramitación: i.c.fTramitacion ?? "", Activación: i.c.fActivacion ?? "", Propietario: ownerLabel(i.c.ownerPrimary, settings), "Fila original": i.c.sourceRow })) }], "incidencias")}>
            <Download size={13} /> Excel
          </Button>
        }
      >
        Centro operativo. La antigüedad se mide desde la tramitación (o desde el traspaso al CRM si no hay tramitación). El umbral de «antigüedad elevada» es una regla configurable: {settings.ageRuleEnabled ? `${settings.ageThresholdDays} días` : "desactivada"}.
      </PageIntro>

      <div className="grid gap-4 md:grid-cols-3">
        {(["alta", "media", "baja"] as Priority[]).map((p, i) => (
          <motion.button
            key={p}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.35 }}
            onClick={() => setPrio(prio === p ? null : p)}
            aria-pressed={prio === p}
            className={cx("panel relative overflow-hidden p-5 text-left transition-[border-color]", prio === p ? "border-line-strong" : "hover:border-line-strong")}
          >
            <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: PCOLOR[p] }} />
            <div className="text-[13px] font-medium capitalize text-ink-2">Prioridad {p}</div>
            <div className="mt-2 text-[32px] font-semibold leading-none tracking-[-0.04em] tabular">{fmtInt(counts.byPrio[p])}</div>
            <div className="mt-2 text-[12px] text-ink-3">avisos en {fmtInt(counts.contractsByPrio[p].size)} contratos</div>
          </motion.button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(INCIDENT_META) as IncidentType[]).filter((tp) => counts.byType.get(tp)).map((tp) => {
          const on = types.includes(tp);
          return (
            <button key={tp} onClick={() => toggleType(tp)} title={INCIDENT_META[tp].description} aria-pressed={on} className={cx("inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12.5px] transition-colors", on ? "border-brand bg-brand-soft text-ink" : "border-line bg-surface text-ink-2 hover:text-ink")}>
              <span className="h-2 w-2 rounded-full" style={{ background: PCOLOR[INCIDENT_META[tp].priority] }} />
              {INCIDENT_META[tp].label}
              <span className="tabular text-ink-3">{fmtInt(counts.byType.get(tp))}</span>
            </button>
          );
        })}
        {(types.length > 0 || prio) && <Button size="sm" variant="ghost" onClick={() => { setTypes([]); setPrio(null); }}>Ver todas</Button>}
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Panel title="Antigüedad de los avisos" subtitle="Días desde tramitación o traspaso" className="xl:col-span-4">
          <EChart option={ageChart} height={300} ariaLabel="Avisos por antigüedad y prioridad" />
        </Panel>
        <Panel title="Qué significa cada aviso" className="xl:col-span-8">
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {(Object.keys(INCIDENT_META) as IncidentType[]).map((tp) => (
              <div key={tp} className="flex gap-2 text-[12.5px]">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: PCOLOR[INCIDENT_META[tp].priority] }} />
                <p><span className="font-medium text-ink">{INCIDENT_META[tp].label}.</span> <span className="text-ink-3">{INCIDENT_META[tp].description}</span></p>
              </div>
            ))}
          </div>
          <div className="mt-4"><Notice>Ningún contrato se marca como «retrasado» por defecto: solo se aplica la regla de antigüedad que definas en Configuración. Un mismo contrato puede tener varios avisos.</Notice></div>
        </Panel>
      </div>

      <Panel title="Avisos" subtitle="Ordenados por prioridad y antigüedad · clic para abrir la ficha">
        <DataTable rows={list} columns={cols} rowKey={(i) => i.key} onRowClick={(i) => openContract(i.c.id)} placeholder="Buscar cliente, CUPS, estado, comercial…" height={640} />
      </Panel>
    </div>
  );
}
