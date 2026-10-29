/**
 * Esquema canónico del CRM. Cada campo interno tiene alias de cabecera
 * para reconocer futuras exportaciones aunque cambien mayúsculas, asteriscos
 * o espacios. El usuario puede corregir la correspondencia en la importación.
 */
export interface FieldDef {
  key: string;
  label: string;
  aliases: string[];
  required?: boolean;
  kind: "text" | "date" | "number" | "money" | "bool" | "email" | "catalog";
  sensitive?: boolean;
  group: "Cliente" | "Contrato" | "Energía" | "Fechas" | "Comisiones" | "Gestión";
}

export const FIELDS: FieldDef[] = [
  { key: "cif", label: "CIF/NIF", aliases: ["cif cuenta", "cif", "nif", "cif nif", "dni"], kind: "text", sensitive: true, group: "Cliente" },
  { key: "nombre", label: "Nombre", aliases: ["nombre", "razon social", "cliente", "titular"], required: true, kind: "text", group: "Cliente" },
  { key: "direccion", label: "Dirección", aliases: ["direccion", "domicilio"], kind: "text", sensitive: true, group: "Cliente" },
  { key: "poblacion", label: "Población", aliases: ["poblacion", "municipio", "localidad"], kind: "text", group: "Cliente" },
  { key: "provincia", label: "Provincia", aliases: ["provincia"], kind: "text", group: "Cliente" },
  { key: "cp", label: "Código postal", aliases: ["codigo postal", "cp", "c p"], kind: "text", group: "Cliente" },
  { key: "iban", label: "IBAN", aliases: ["iban", "cuenta bancaria"], kind: "text", sensitive: true, group: "Cliente" },
  { key: "telefono", label: "Teléfono", aliases: ["n telefono", "no telefono", "telefono", "movil cliente"], kind: "text", sensitive: true, group: "Cliente" },
  { key: "email", label: "Correo electrónico", aliases: ["correo electronico", "email cliente", "correo"], kind: "email", sensitive: true, group: "Cliente" },

  { key: "tipo", label: "Tipo de producto", aliases: ["tipo de producto", "tipo producto", "tipo"], required: true, kind: "catalog", group: "Contrato" },
  { key: "comercializadora", label: "Comercializadora", aliases: ["comercializadora", "compania", "proveedor"], required: true, kind: "catalog", group: "Contrato" },
  { key: "tarifa", label: "Tarifa", aliases: ["tarifa", "peaje", "tarifa acceso"], kind: "catalog", group: "Contrato" },
  { key: "producto", label: "Producto", aliases: ["producto", "producto comercial"], kind: "text", group: "Contrato" },
  { key: "cups", label: "CUPS", aliases: ["cups"], kind: "text", group: "Contrato" },
  { key: "estado", label: "Estado", aliases: ["estado", "situacion"], required: true, kind: "catalog", group: "Contrato" },
  { key: "observaciones", label: "Observaciones", aliases: ["observaciones", "notas", "comentarios"], kind: "text", group: "Contrato" },

  { key: "consumo", label: "Consumo", aliases: ["consumo", "consumo anual", "consumo kwh"], kind: "number", group: "Energía" },
  { key: "potencia", label: "Potencia", aliases: ["potencia"], kind: "number", group: "Energía" },
  { key: "potenciaActual", label: "Potencia actual", aliases: ["potencia actual"], kind: "number", group: "Energía" },
  { key: "potenciaSolicitada", label: "Potencia solicitada", aliases: ["potencia solicitada"], kind: "number", group: "Energía" },
  ...[1, 2, 3, 4, 5, 6].map((n) => ({
    key: `p${n}Contratada`,
    label: `P${n} contratada`,
    aliases: [`p${n} contratada`],
    kind: "number" as const,
    group: "Energía" as const,
  })),
  { key: "tarifaGas", label: "Tarifa gas (dual)", aliases: ["tarifa gas"], kind: "catalog", group: "Energía" },
  { key: "productoGas", label: "Producto gas (dual)", aliases: ["producto gas"], kind: "text", group: "Energía" },
  { key: "cupsGas", label: "CUPS gas (dual)", aliases: ["cups gas"], kind: "text", group: "Energía" },
  { key: "consumoGas", label: "Consumo gas (dual)", aliases: ["consumo gas"], kind: "number", group: "Energía" },

  { key: "fCarterizacion", label: "Fecha carterización", aliases: ["fecha carterizacion"], kind: "date", group: "Fechas" },
  { key: "fTramitacion", label: "Fecha tramitación", aliases: ["fecha tramitacion", "fecha de tramitacion"], kind: "date", group: "Fechas" },
  { key: "fActivacion", label: "Fecha activación", aliases: ["fecha activacion", "fecha de activacion"], kind: "date", group: "Fechas" },
  { key: "fBaja", label: "Fecha de baja", aliases: ["fecha de baja", "fecha baja"], kind: "date", group: "Fechas" },
  { key: "fTraspaso", label: "Fecha traspaso", aliases: ["fecha traspaso", "fecha de traspaso"], kind: "date", group: "Fechas" },

  { key: "comisionVenta", label: "Comisión venta", aliases: ["comision venta", "comision de venta"], kind: "money", group: "Comisiones" },
  { key: "comisionSubdominio", label: "Comisión subdominio", aliases: ["comision subdominio", "comision de subdominio"], kind: "money", group: "Comisiones" },

  { key: "owner", label: "Usuario propietario", aliases: ["usuario propietario email", "usuario propietario", "propietario", "comercial"], required: true, kind: "email", group: "Gestión" },
  { key: "altaNueva", label: "Alta nueva", aliases: ["alta nueva"], kind: "bool", group: "Gestión" },
  { key: "cambioPotencia", label: "Cambio de potencia", aliases: ["cambio de potencia"], kind: "bool", group: "Gestión" },
  { key: "cambioTitularidad", label: "Cambio titularidad", aliases: ["cambio titularidad", "cambio de titularidad"], kind: "bool", group: "Gestión" },
  { key: "bateriaVirtual", label: "Batería virtual", aliases: ["bateria virtual"], kind: "bool", group: "Gestión" },
  { key: "cambioComercializadora", label: "Cambio comercializadora", aliases: ["cambio comercializadora", "cambio de comercializadora"], kind: "bool", group: "Gestión" },
];

export const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((f) => [f.key, f]));

export function normHeader(h: string): string {
  return String(h ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/º|ª/g, "o")
    .replace(/[*().,:;/\\_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Asigna columnas del archivo a campos canónicos. Devuelve mapping y puntuación 0-1. */
export function autoMap(headers: string[]): { mapping: Record<string, string | null>; score: number; unmapped: string[] } {
  const normed = headers.map((h) => ({ raw: h, n: normHeader(h) }));
  const used = new Set<string>();
  const mapping: Record<string, string | null> = {};
  // primero coincidencias exactas, luego "empieza por"
  for (const pass of ["exact", "prefix"] as const) {
    for (const f of FIELDS) {
      if (mapping[f.key]) continue;
      const hit = normed.find(
        (c) =>
          !used.has(c.raw) &&
          f.aliases.some((a) => (pass === "exact" ? c.n === a : c.n.startsWith(a + " ") || c.n === a)),
      );
      if (hit) {
        mapping[f.key] = hit.raw;
        used.add(hit.raw);
      }
    }
  }
  for (const f of FIELDS) if (!(f.key in mapping)) mapping[f.key] = null;
  const req = FIELDS.filter((f) => f.required);
  const reqHit = req.filter((f) => mapping[f.key]).length;
  const allHit = FIELDS.filter((f) => mapping[f.key]).length;
  const score = 0.6 * (reqHit / req.length) + 0.4 * (allHit / FIELDS.length);
  return { mapping, score, unmapped: headers.filter((h) => !used.has(h)) };
}
