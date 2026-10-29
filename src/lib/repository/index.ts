/**
 * Capa de repositorio. Hoy: almacenamiento local (IndexedDB, ver store.ts).
 * Para centralizar en Supabase, implementar `SupabaseRepository` con esta misma
 * interfaz usando supabase/schema.sql, y separar los campos sensibles en la tabla
 * contract_pii (solo legible por el rol admin mediante RLS).
 *
 * Requisito previo: autenticación (Supabase Auth) y perfiles con rol.
 */
import type { Contract, ImportRecord } from "../types";

export interface ContractRepository {
  loadContracts(): Promise<Contract[]>;
  saveContracts(contracts: Contract[], record: ImportRecord): Promise<void>;
  loadImports(): Promise<ImportRecord[]>;
  clear(): Promise<void>;
}

export const SENSITIVE_FIELDS: (keyof Contract)[] = ["cif", "direccion", "iban", "telefono", "email"];

/** Divide un contrato en parte pública y parte sensible (para contract_pii). */
export function splitSensitive(c: Contract) {
  const pii: Partial<Contract> = {};
  const pub: Partial<Contract> = { ...c };
  for (const k of SENSITIVE_FIELDS) {
    (pii as Record<string, unknown>)[k] = c[k];
    delete (pub as Record<string, unknown>)[k];
  }
  return { pub, pii };
}
