import type { EstadoKey, ProductType } from "./types";

export type Mode = "dark" | "light";

/** Paleta categórica validada (orden fijo, nunca ciclado). */
export const SERIES: Record<Mode, string[]> = {
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"],
};
export const OTHER: Record<Mode, string> = { dark: "#5c616b", light: "#a3a8b1" };

/** Rampa secuencial azul (100→700) */
export const SEQ_BLUE = ["#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#2a78d6", "#256abf", "#1c5cab", "#184f95", "#104281", "#0d366b"];

export const STATUS = { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b" };

export function tipoColor(t: ProductType, m: Mode): string {
  const s = SERIES[m];
  return { luz: s[3], gas: s[0], telefonia: s[6], dual: s[2], otro: OTHER[m] }[t];
}

export function estadoColor(e: EstadoKey, m: Mode): string {
  const s = SERIES[m];
  const map: Record<EstadoKey, string> = {
    borrador: OTHER[m],
    pendiente: STATUS.warning,
    pendiente_activacion: STATUS.serious,
    firmado: s[6],
    tramitado: s[0],
    activado: STATUS.good,
    comisionado: s[2],
    incidencia: STATUS.critical,
    baja: s[7],
    anulado: m === "dark" ? "#3d4149" : "#c7cad0",
    otro: OTHER[m],
  };
  return map[e];
}

export interface ChartTokens {
  mode: Mode;
  text: string;
  text2: string;
  text3: string;
  grid: string;
  axis: string;
  surface: string;
  surface2: string;
  border: string;
  brand: string;
  series: string[];
  other: string;
}

export function chartTokens(m: Mode): ChartTokens {
  return m === "dark"
    ? { mode: m, text: "#eceef1", text2: "#a4a9b4", text3: "#6d7380", grid: "rgba(255,255,255,0.06)", axis: "rgba(255,255,255,0.14)", surface: "#13151a", surface2: "#1c1f25", border: "rgba(255,255,255,0.1)", brand: "#e9b44c", series: SERIES.dark, other: OTHER.dark }
    : { mode: m, text: "#0f1115", text2: "#4b515c", text3: "#858b96", grid: "rgba(15,17,21,0.07)", axis: "rgba(15,17,21,0.18)", surface: "#ffffff", surface2: "#f7f8fa", border: "rgba(15,17,21,0.1)", brand: "#a8740f", series: SERIES.light, other: OTHER.light };
}

/** Color estable por entidad (según ranking del conjunto completo, no del filtrado). */
export function entityColorMap(keysByGlobalRank: string[], m: Mode, max = 7): Record<string, string> {
  const out: Record<string, string> = {};
  keysByGlobalRank.forEach((k, i) => (out[k] = i < max ? SERIES[m][i] : OTHER[m]));
  return out;
}
