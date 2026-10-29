"use client";
import { create } from "zustand";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
import type { Contract, Filters, ImportRecord, Settings } from "./types";
import { EMPTY_FILTERS } from "./types";
import { DEFAULT_DEDUPE_FIELDS } from "./normalize";

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  role: "gestor",
  adminPin: null,
  consumoUnit: "kWh",
  consumoPeriod: "anual",
  consumoConfirmed: false,
  commissionMode: "sum",
  dateBasis: "fTramitacion",
  referenceDate: "hoy",
  ageThresholdDays: 30,
  ageRuleEnabled: true,
  dedupeFields: DEFAULT_DEDUPE_FIELDS,
  comercializadoraAliases: {},
  owners: {},
  excludeAdminFromRanking: false,
  persistLocally: true,
};

const SETTINGS_KEY = "a30.settings.v1";
const DATA_KEY = "a30.contracts.v1";
const IMPORTS_KEY = "a30.imports.v1";

interface State {
  hydrated: boolean;
  contracts: Contract[];
  imports: ImportRecord[];
  settings: Settings;
  filters: Filters;
  /** Revelado temporal de datos sensibles (solo admin, se pierde al recargar) */
  sensitiveUnlocked: boolean;
  drawer: { title: string; subtitle?: string; ids: string[] } | null;
  clientKey: string | null;
  contractId: string | null;
  unlockPrompt: boolean;
  toast: { id: number; text: string } | null;

  hydrate: () => Promise<void>;
  setContracts: (c: Contract[], record: ImportRecord) => Promise<void>;
  clearData: () => Promise<void>;
  updateSettings: (p: Partial<Settings>) => void;
  setFilter: <K extends keyof Filters>(k: K, v: Filters[K]) => void;
  toggleFilter: <K extends keyof Filters>(k: K, v: Filters[K] extends (infer U)[] ? U : never) => void;
  clearFilters: () => void;
  setSensitiveUnlocked: (v: boolean) => void;
  openDrawer: (title: string, ids: string[], subtitle?: string) => void;
  closeDrawer: () => void;
  openClient: (key: string | null) => void;
  openContract: (id: string | null) => void;
  requestUnlock: () => void;
  closeUnlock: () => void;
  notify: (text: string) => void;
}

function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* almacenamiento no disponible */
  }
}

export const useStore = create<State>((set, get) => ({
  hydrated: false,
  contracts: [],
  imports: [],
  settings: DEFAULT_SETTINGS,
  filters: EMPTY_FILTERS,
  sensitiveUnlocked: false,
  drawer: null,
  clientKey: null,
  contractId: null,
  unlockPrompt: false,
  toast: null,

  hydrate: async () => {
    let settings = DEFAULT_SETTINGS;
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      /* noop */
    }
    let contracts: Contract[] = [];
    let imports: ImportRecord[] = [];
    try {
      contracts = ((await idbGet(DATA_KEY)) as Contract[] | undefined) ?? [];
      imports = ((await idbGet(IMPORTS_KEY)) as ImportRecord[] | undefined) ?? [];
    } catch {
      /* IndexedDB no disponible: la sesión funciona en memoria */
    }
    document.documentElement.dataset.theme = settings.theme;
    set({ settings, contracts, imports, hydrated: true });
  },

  setContracts: async (contracts, record) => {
    const imports = [record, ...get().imports].slice(0, 100);
    set({ contracts, imports, filters: EMPTY_FILTERS });
    try {
      await idbSet(IMPORTS_KEY, imports);
      if (get().settings.persistLocally) await idbSet(DATA_KEY, contracts);
    } catch {
      /* noop */
    }
  },

  clearData: async () => {
    set({ contracts: [], imports: [], filters: EMPTY_FILTERS });
    try {
      await idbDel(DATA_KEY);
      await idbDel(IMPORTS_KEY);
    } catch {
      /* noop */
    }
  },

  updateSettings: (p) => {
    const settings = { ...get().settings, ...p };
    if (p.theme) document.documentElement.dataset.theme = p.theme;
    if (p.role && p.role !== "admin") set({ sensitiveUnlocked: false });
    if (p.persistLocally === false) idbDel(DATA_KEY).catch(() => {});
    if (p.persistLocally === true) idbSet(DATA_KEY, get().contracts).catch(() => {});
    saveSettings(settings);
    set({ settings });
  },

  setFilter: (k, v) => set({ filters: { ...get().filters, [k]: v } }),
  toggleFilter: (k, v) => {
    const cur = get().filters[k] as unknown[];
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    set({ filters: { ...get().filters, [k]: next } });
  },
  clearFilters: () => set({ filters: EMPTY_FILTERS }),
  setSensitiveUnlocked: (v) => set({ sensitiveUnlocked: v }),
  openDrawer: (title, ids, subtitle) => set({ drawer: { title, ids, subtitle } }),
  closeDrawer: () => set({ drawer: null }),
  openClient: (key) => set({ clientKey: key }),
  openContract: (id) => set({ contractId: id }),
  requestUnlock: () => {
    const { settings, notify } = get();
    if (settings.role !== "admin") {
      notify("Los datos sensibles solo pueden mostrarse con el rol Administrador (Configuración → Acceso).");
      return;
    }
    if (!settings.adminPin) {
      set({ sensitiveUnlocked: true });
      return;
    }
    set({ unlockPrompt: true });
  },
  closeUnlock: () => set({ unlockPrompt: false }),
  notify: (text) => {
    const id = Date.now();
    set({ toast: { id, text } });
    setTimeout(() => get().toast?.id === id && set({ toast: null }), 4200);
  },
}));
