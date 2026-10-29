export type ProductType = "luz" | "gas" | "telefonia" | "dual" | "otro";

export type EstadoKey =
  | "borrador"
  | "pendiente"
  | "pendiente_activacion"
  | "firmado"
  | "tramitado"
  | "activado"
  | "comisionado"
  | "incidencia"
  | "baja"
  | "anulado"
  | "otro";

/** ISO date string AAAA-MM-DD */
export type ISODate = string;

export interface Contract {
  /** Clave estable de deduplicación */
  id: string;
  /** Clave base sin número de aparición (para detectar posibles duplicados) */
  baseKey: string;
  sourceFile: string;
  sourceRow: number;
  importedAt: string;
  updatedAt: string;

  cif: string | null;
  cifNorm: string | null;
  nombre: string;
  direccion: string | null;
  poblacion: string | null;
  provinciaRaw: string | null;
  provinciaCode: string | null;
  provincia: string | null;
  cp: string | null;
  iban: string | null;

  tipo: ProductType;
  tipoRaw: string | null;
  comercializadora: string;
  comercializadoraRaw: string | null;
  tarifa: string;
  tarifaRaw: string | null;
  producto: string | null;

  cups: string | null;
  consumo: number | null;
  potencia: number | null;
  potenciaActual: number | null;
  potenciaSolicitada: number | null;
  pContratada: (number | null)[];

  fCarterizacion: ISODate | null;
  fTramitacion: ISODate | null;
  fActivacion: ISODate | null;
  fBaja: ISODate | null;
  fTraspaso: ISODate | null;

  comisionVenta: number | null;
  comisionSubdominio: number | null;

  estado: EstadoKey;
  estadoRaw: string;

  observaciones: string | null;
  altaNueva: boolean;
  cambioPotencia: boolean;
  cambioTitularidad: boolean;
  bateriaVirtual: boolean;
  cambioComercializadora: boolean;

  telefono: string | null;
  email: string | null;
  owners: string[];
  ownerPrimary: string;

  /** Banderas de calidad detectadas al importar */
  issues: IssueCode[];
}

export type IssueCode =
  | "fecha_invalida"
  | "numero_invalido"
  | "cp_invalido"
  | "provincia_no_reconocida"
  | "sin_comercializadora"
  | "sin_tarifa"
  | "sin_cups"
  | "sin_cif"
  | "posible_duplicado"
  | "nombre_copia"
  | "baja_inconsistente"
  | "activacion_inconsistente"
  | "propietario_compartido";

export interface ImportRecord {
  id: string;
  fileName: string;
  date: string;
  mode: "replace" | "merge";
  rows: number;
  added: number;
  updated: number;
  unchanged: number;
  errors: number;
  warnings: number;
  sheet: string;
}

export type ColumnMapping = Record<string, string | null>; // canonicalField -> columna del archivo

export interface OwnerProfile {
  name: string;
  category: "interno" | "colaborador" | "administrativa" | "sin_clasificar";
}

export type CommissionMode = "sum" | "venta" | "subdominio" | "none";
export type DateBasis = "fTramitacion" | "fActivacion" | "fTraspaso" | "fBaja";
export type Role = "admin" | "gestor" | "lectura";

export interface Settings {
  theme: "dark" | "light";
  role: Role;
  adminPin: string | null;
  consumoUnit: "kWh" | "MWh";
  consumoPeriod: "anual" | "desconocido";
  consumoConfirmed: boolean;
  commissionMode: CommissionMode;
  dateBasis: DateBasis;
  referenceDate: "hoy" | "ultima_fecha";
  ageThresholdDays: number;
  ageRuleEnabled: boolean;
  dedupeFields: string[];
  comercializadoraAliases: Record<string, string>;
  owners: Record<string, OwnerProfile>;
  excludeAdminFromRanking: boolean;
  persistLocally: boolean;
}

export interface Filters {
  dateFrom: ISODate | null;
  dateTo: ISODate | null;
  years: number[];
  months: number[]; // 1-12
  comercializadoras: string[];
  tipos: ProductType[];
  tarifas: string[];
  estados: EstadoKey[];
  owners: string[];
  provincias: string[];
  municipios: string[];
}

export const EMPTY_FILTERS: Filters = {
  dateFrom: null,
  dateTo: null,
  years: [],
  months: [],
  comercializadoras: [],
  tipos: [],
  tarifas: [],
  estados: [],
  owners: [],
  provincias: [],
  municipios: [],
};
