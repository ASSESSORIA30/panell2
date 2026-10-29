import type { Contract, EstadoKey, IssueCode, ProductType } from "./types";
import { normalizeCP, resolveProvince } from "./provinces";

export const ESTADOS: { key: EstadoKey; label: string; order: number }[] = [
  { key: "borrador", label: "Borrador", order: 0 },
  { key: "pendiente", label: "Pendiente", order: 1 },
  { key: "firmado", label: "Firmado", order: 2 },
  { key: "tramitado", label: "Tramitado", order: 3 },
  { key: "pendiente_activacion", label: "Pendiente de activación", order: 4 },
  { key: "activado", label: "Activado", order: 5 },
  { key: "comisionado", label: "Comisionado", order: 6 },
  { key: "incidencia", label: "Incidencia", order: 7 },
  { key: "baja", label: "Baja", order: 8 },
  { key: "anulado", label: "Anulado", order: 9 },
  { key: "otro", label: "Otro", order: 10 },
];
export const ESTADO_LABEL = Object.fromEntries(ESTADOS.map((e) => [e.key, e.label])) as Record<EstadoKey, string>;

export const TIPO_LABEL: Record<ProductType, string> = {
  luz: "Electricidad",
  gas: "Gas",
  telefonia: "Telecomunicaciones",
  dual: "Dual luz + gas",
  otro: "Otros servicios",
};

const deaccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
export const keyText = (s: string) => deaccent(s).toLowerCase().replace(/\s+/g, " ").trim();

export function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/ /g, " ").trim();
  return s === "" || s.toLowerCase() === "nan" ? null : s;
}

/** Acepta dd/mm/aaaa, d-m-aa, ISO, serial Excel o Date. */
export function parseDate(v: unknown): { value: string | null; invalid: boolean } {
  if (v === null || v === undefined || v === "") return { value: null, invalid: false };
  const pad = (n: number) => String(n).padStart(2, "0");
  const fromParts = (y: number, m: number, d: number) => {
    if (y < 100) y += 2000;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d || y < 1990 || y > 2100)
      return { value: null, invalid: true };
    return { value: `${y}-${pad(m)}-${pad(d)}`, invalid: false };
  };
  if (v instanceof Date && !isNaN(v.getTime())) return fromParts(v.getFullYear(), v.getMonth() + 1, v.getDate());
  if (typeof v === "number") {
    // serial Excel (días desde 1899-12-30)
    if (v > 20000 && v < 80000) {
      const dt = new Date(Math.round((v - 25569) * 86400000));
      return fromParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    }
    return { value: null, invalid: true };
  }
  const s = String(v).trim();
  if (!s) return { value: null, invalid: false };
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:\s.*)?$/);
  if (m) return fromParts(+m[3], +m[2], +m[1]);
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return fromParts(+m[1], +m[2], +m[3]);
  if (/^\d{5}(\.\d+)?$/.test(s)) return parseDate(Number(s));
  return { value: null, invalid: true };
}

/** Números con coma o punto decimal, € y separadores de miles. */
export function parseNumber(v: unknown): { value: number | null; invalid: boolean } {
  if (v === null || v === undefined || v === "") return { value: null, invalid: false };
  if (typeof v === "number") return Number.isFinite(v) ? { value: v, invalid: false } : { value: null, invalid: true };
  let s = String(v).replace(/[€\s]|kwh|kw|mwh/gi, "").trim();
  if (!s) return { value: null, invalid: false };
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
  else s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? { value: n, invalid: false } : { value: null, invalid: true };
}

export function normalizeEstado(raw: string | null): EstadoKey {
  const s = keyText(raw ?? "");
  if (!s) return "otro";
  if (s.startsWith("pendiente de activ") || s === "pendiente activacion") return "pendiente_activacion";
  if (s.startsWith("pendiente")) return "pendiente";
  if (s.startsWith("firmad")) return "firmado";
  if (s.startsWith("tramitad")) return "tramitado";
  if (s.startsWith("activad")) return "activado";
  if (s.startsWith("comisionad")) return "comisionado";
  if (s.startsWith("incidenc")) return "incidencia";
  if (s.startsWith("baja")) return "baja";
  if (s.startsWith("anulad") || s.startsWith("cancelad")) return "anulado";
  if (s.startsWith("borrador")) return "borrador";
  return "otro";
}

export function normalizeTipo(raw: string | null, tarifa: string | null): ProductType {
  const s = keyText(raw ?? "");
  if (s.includes("dual")) return "dual";
  if (s.includes("luz") || s.includes("electric")) return "luz";
  if (s.includes("gas")) return "gas";
  if (s.includes("telefon") || s.includes("fibra") || s.includes("movil") || s.includes("telecom")) return "telefonia";
  const t = keyText(tarifa ?? "");
  if (/td$/.test(t)) return "luz";
  if (/rl\d/.test(t)) return "gas";
  return "otro";
}

/** Tarifa canónica: "2.0TD", "RL1", "Fibra", "Móvil", "Fibra + móvil", "Sin tarifa". */
export function normalizeTarifa(raw: string | null, tipo: ProductType, producto: string | null): string {
  const s = keyText(raw ?? "");
  const td = s.match(/(\d)[.,]?(\d)\s*td/);
  if (td) return `${td[1]}.${td[2]}TD`;
  const rl = s.match(/rl\s*\.?\s*(\d)/);
  if (rl) return `RL${rl[1]}`;
  const telco = (x: string) => {
    const f = x.includes("fibra"), m = x.includes("movil") || x.includes("mobil") || x.includes("linea");
    if (f && m) return "Fibra + móvil";
    if (f) return "Fibra";
    if (m) return "Móvil";
    return null;
  };
  const fromRaw = telco(s);
  if (fromRaw) return fromRaw;
  if (tipo === "telefonia") {
    const fromProd = telco(keyText(producto ?? ""));
    if (fromProd) return fromProd;
  }
  return raw ? raw.trim() : "Sin tarifa";
}

export const DEFAULT_COMERCIALIZADORA_ALIASES: Record<string, string> = {
  "electrica serosense": "Serosense",
  serosense: "Serosense",
  niba: "NIBA",
  chc: "CHC",
  digi: "DIGI",
  o2: "O2",
  "ab energia": "AB Energía",
  "factor energia": "Factor Energía",
  novaluz: "Novaluz",
  visalia: "Visalia",
  "apolo energies": "Apolo Energies",
  orange: "Orange",
  plenitude: "Plenitude",
};

export function normalizeComercializadora(raw: string | null, aliases: Record<string, string>): string {
  if (!raw) return "Sin comercializadora";
  const k = keyText(raw);
  if (aliases[k]) return aliases[k];
  if (DEFAULT_COMERCIALIZADORA_ALIASES[k]) return DEFAULT_COMERCIALIZADORA_ALIASES[k];
  // Title case, respetando siglas cortas
  return raw
    .trim()
    .split(/\s+/)
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

export function titleCase(s: string | null): string | null {
  if (!s) return null;
  const small = new Set(["de", "del", "la", "les", "el", "els", "d", "l", "i", "y"]);
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w, i) =>
      i > 0 && small.has(w)
        ? w
        : w.replace(/(^|[-'’])(\p{L})/gu, (_, p, c) => p + c.toUpperCase()),
    )
    .join(" ");
}

export const normCif = (s: string | null) => (s ? s.toUpperCase().replace(/[^A-Z0-9]/g, "") || null : null);

const bool = (v: unknown) => /^(s|si|sí|yes|true|1|x)$/i.test(String(v ?? "").trim());

export interface NormalizeContext {
  fileName: string;
  importedAt: string;
  aliases: Record<string, string>;
  dedupeFields: string[];
}

/** Convierte una fila (ya mapeada a campos canónicos) en un Contract normalizado. */
export function normalizeRow(r: Record<string, unknown>, rowIndex: number, ctx: NormalizeContext): { c: Omit<Contract, "id">; invalidDates: number; invalidNumbers: number } {
  const issues: IssueCode[] = [];
  let invalidDates = 0, invalidNumbers = 0;
  const d = (k: string) => {
    const p = parseDate(r[k]);
    if (p.invalid) invalidDates++;
    return p.value;
  };
  const n = (k: string) => {
    const p = parseNumber(r[k]);
    if (p.invalid) invalidNumbers++;
    return p.value;
  };

  const cif = clean(r.cif);
  const producto = clean(r.producto);
  const tarifaRaw = clean(r.tarifa);
  const tipoRaw = clean(r.tipo);
  const tipo = normalizeTipo(tipoRaw, tarifaRaw);
  const tarifa = normalizeTarifa(tarifaRaw, tipo, producto);
  const comercializadoraRaw = clean(r.comercializadora);
  const comercializadora = normalizeComercializadora(comercializadoraRaw, ctx.aliases);
  const cpRaw = clean(r.cp);
  const cp = normalizeCP(cpRaw);
  const provinciaRaw = clean(r.provincia);
  const prov = resolveProvince(cp, provinciaRaw);
  const estadoRaw = clean(r.estado) ?? "";
  const estado = normalizeEstado(estadoRaw);
  const ownersRaw = clean(r.owner) ?? "";
  const owners = Array.from(new Set(ownersRaw.split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@"))));
  const nombre = clean(r.nombre) ?? "(sin nombre)";

  const c: Omit<Contract, "id"> = {
    baseKey: "",
    sourceFile: ctx.fileName,
    sourceRow: rowIndex + 2,
    importedAt: ctx.importedAt,
    updatedAt: ctx.importedAt,
    cif,
    cifNorm: normCif(cif),
    nombre,
    direccion: clean(r.direccion),
    poblacion: titleCase(clean(r.poblacion)),
    provinciaRaw,
    provinciaCode: prov.code,
    provincia: prov.name,
    cp,
    iban: clean(r.iban),
    tipo,
    tipoRaw,
    comercializadora,
    comercializadoraRaw,
    tarifa,
    tarifaRaw,
    producto,
    cups: clean(r.cups)?.toUpperCase().replace(/\s/g, "") ?? null,
    consumo: n("consumo"),
    potencia: n("potencia"),
    potenciaActual: n("potenciaActual"),
    potenciaSolicitada: n("potenciaSolicitada"),
    pContratada: [1, 2, 3, 4, 5, 6].map((i) => n(`p${i}Contratada`)),
    fCarterizacion: d("fCarterizacion"),
    fTramitacion: d("fTramitacion"),
    fActivacion: d("fActivacion"),
    fBaja: d("fBaja"),
    fTraspaso: d("fTraspaso"),
    comisionVenta: n("comisionVenta"),
    comisionSubdominio: n("comisionSubdominio"),
    estado,
    estadoRaw,
    observaciones: clean(r.observaciones),
    altaNueva: bool(r.altaNueva),
    cambioPotencia: bool(r.cambioPotencia),
    cambioTitularidad: bool(r.cambioTitularidad),
    bateriaVirtual: bool(r.bateriaVirtual),
    cambioComercializadora: bool(r.cambioComercializadora),
    telefono: clean(r.telefono)?.replace(/\.0$/, "") ?? null,
    email: clean(r.email),
    owners: owners.length ? owners : ["(sin propietario)"],
    ownerPrimary: owners[0] ?? "(sin propietario)",
    issues,
  };

  if (invalidDates) issues.push("fecha_invalida");
  if (invalidNumbers) issues.push("numero_invalido");
  if (cpRaw && !cp) issues.push("cp_invalido");
  if (!prov.code) issues.push("provincia_no_reconocida");
  if (!comercializadoraRaw) issues.push("sin_comercializadora");
  if (!tarifaRaw && tarifa === "Sin tarifa") issues.push("sin_tarifa");
  if (!c.cups && (tipo === "luz" || tipo === "gas" || tipo === "dual")) issues.push("sin_cups");
  if (!c.cifNorm) issues.push("sin_cif");
  if (/\bcopia\b/i.test(nombre)) issues.push("nombre_copia");
  if (c.fBaja && estado !== "baja" && estado !== "anulado") issues.push("baja_inconsistente");
  if (c.fActivacion && ["pendiente", "borrador", "firmado"].includes(estado)) issues.push("activacion_inconsistente");
  if (owners.length > 1) issues.push("propietario_compartido");

  c.baseKey = buildBaseKey(c, ctx.dedupeFields);
  return { c, invalidDates, invalidNumbers };
}

export const DEDUPE_FIELD_OPTIONS: { key: string; label: string }[] = [
  { key: "cifNorm", label: "CIF/NIF" },
  { key: "cups", label: "CUPS" },
  { key: "tipo", label: "Tipo de producto" },
  { key: "comercializadora", label: "Comercializadora" },
  { key: "tarifa", label: "Tarifa" },
  { key: "producto", label: "Producto" },
  { key: "fTramitacion", label: "Fecha tramitación" },
  { key: "nombre", label: "Nombre" },
];
export const DEFAULT_DEDUPE_FIELDS = ["cifNorm", "cups", "tipo", "comercializadora", "tarifa", "producto"];

export function buildBaseKey(c: Partial<Contract>, fields: string[]): string {
  return fields
    .map((f) => {
      const v = (c as Record<string, unknown>)[f];
      return v === null || v === undefined ? "" : keyText(String(v));
    })
    .join("|");
}

/** Hash FNV-1a 53 bits para claves compactas. */
export function hashKey(s: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Asigna id = hash(baseKey) + nº de aparición dentro del archivo, y marca posibles duplicados. */
export function assignIds(rows: Omit<Contract, "id">[]): Contract[] {
  const seen = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.baseKey, (counts.get(r.baseKey) ?? 0) + 1);
  // posibles duplicados semánticos: mismo CUPS + comercializadora + producto
  const sem = new Map<string, number>();
  const semKey = (r: Omit<Contract, "id">) => (r.cups ? `${r.cups}|${keyText(r.comercializadora)}|${keyText(r.producto ?? "")}` : null);
  for (const r of rows) {
    const k = semKey(r);
    if (k) sem.set(k, (sem.get(k) ?? 0) + 1);
  }
  return rows.map((r) => {
    const n = (seen.get(r.baseKey) ?? 0) + 1;
    seen.set(r.baseKey, n);
    const sk = semKey(r);
    const dup = (counts.get(r.baseKey) ?? 0) > 1 || (sk !== null && (sem.get(sk) ?? 0) > 1);
    const issues = dup && !r.issues.includes("posible_duplicado") ? [...r.issues, "posible_duplicado" as const] : r.issues;
    return { ...r, issues, id: `${hashKey(r.baseKey)}-${n}` };
  });
}
