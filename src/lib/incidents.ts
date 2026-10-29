import type { Contract, ISODate, Settings } from "./types";
import { ageDays, hasCommission } from "./metrics";

export type IncidentType =
  | "incidencia"
  | "firmado_sin_activar"
  | "tramitado_sin_activar"
  | "pendiente"
  | "antiguedad"
  | "incompleto"
  | "duplicado"
  | "con_baja"
  | "sin_comision"
  | "inconsistente";

export type Priority = "alta" | "media" | "baja";

export const INCIDENT_META: Record<IncidentType, { label: string; priority: Priority; description: string }> = {
  incidencia: { label: "Estado incidencia", priority: "alta", description: "El CRM marca el contrato con estado Incidencia." },
  antiguedad: { label: "Antigüedad elevada", priority: "media", description: "Supera el umbral configurado sin activarse (regla editable en Configuración)." },
  duplicado: { label: "Posible duplicado", priority: "media", description: "Comparte clave o CUPS + comercializadora + producto con otro registro." },
  inconsistente: { label: "Datos contradictorios", priority: "alta", description: "Fecha de baja o activación que no encaja con el estado actual." },
  firmado_sin_activar: { label: "Firmado sin activar", priority: "media", description: "Estado Firmado y sin fecha de activación." },
  tramitado_sin_activar: { label: "Tramitado sin activar", priority: "media", description: "Estado Tramitado y sin fecha de activación." },
  incompleto: { label: "Datos incompletos", priority: "media", description: "Faltan comercializadora, tarifa, CUPS, CIF o provincia." },
  pendiente: { label: "Pendiente", priority: "baja", description: "Estado Pendiente o Pendiente de activación." },
  con_baja: { label: "Con fecha de baja", priority: "baja", description: "El contrato tiene fecha de baja registrada." },
  sin_comision: { label: "Sin comisión registrada", priority: "baja", description: "Activado o comisionado sin importe de comisión en el Excel." },
};

export const PRIORITY_ORDER: Record<Priority, number> = { alta: 0, media: 1, baja: 2 };

export interface Incident {
  key: string;
  type: IncidentType;
  priority: Priority;
  c: Contract;
  age: number | null;
  ageFrom: string | null;
}

export function detectIncidents(rows: Contract[], ref: ISODate, settings: Settings): Incident[] {
  const out: Incident[] = [];
  for (const c of rows) {
    const a = ageDays(c, ref);
    const push = (type: IncidentType) =>
      out.push({ key: `${c.id}:${type}`, type, priority: INCIDENT_META[type].priority, c, age: a?.days ?? null, ageFrom: a?.from ?? null });
    const open = !["activado", "comisionado", "baja", "anulado"].includes(c.estado);
    if (c.estado === "incidencia") push("incidencia");
    if (c.estado === "firmado" && !c.fActivacion) push("firmado_sin_activar");
    if (c.estado === "tramitado" && !c.fActivacion) push("tramitado_sin_activar");
    if (c.estado === "pendiente" || c.estado === "pendiente_activacion") push("pendiente");
    if (settings.ageRuleEnabled && open && a && a.days > settings.ageThresholdDays) push("antiguedad");
    if (c.issues.some((i) => ["sin_comercializadora", "sin_tarifa", "sin_cups", "sin_cif", "provincia_no_reconocida", "cp_invalido"].includes(i))) push("incompleto");
    if (c.issues.includes("posible_duplicado") || c.issues.includes("nombre_copia")) push("duplicado");
    if (c.fBaja) push("con_baja");
    if (c.issues.includes("baja_inconsistente") || c.issues.includes("activacion_inconsistente")) push("inconsistente");
    if ((c.estado === "activado" || c.estado === "comisionado") && !hasCommission(c)) push("sin_comision");
  }
  return out.sort((x, y) => PRIORITY_ORDER[x.priority] - PRIORITY_ORDER[y.priority] || (y.age ?? -1) - (x.age ?? -1));
}
