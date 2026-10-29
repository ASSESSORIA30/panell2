const nf0 = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const eur0 = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

// es-ES no agrupa miles en números de 4 cifras; forzamos agrupación coherente
const group = (s: string) => s.replace(/^(-?\d)(\d{3})(?=,|$|\s)/, "$1.$2");

export const fmtInt = (n: number | null | undefined) => (n === null || n === undefined || !isFinite(n) ? "—" : group(nf0.format(n)));
export const fmtDec = (n: number | null | undefined) => (n === null || n === undefined || !isFinite(n) ? "—" : group(nf1.format(n)));
export const fmtDec2 = (n: number | null | undefined) => (n === null || n === undefined || !isFinite(n) ? "—" : group(nf2.format(n)));
export const fmtEur = (n: number | null | undefined, decimals = false) =>
  n === null || n === undefined || !isFinite(n) ? "—" : group((decimals ? eur2 : eur0).format(n).replace(/ /g, " "));
export const fmtPct = (n: number | null | undefined, digits = 1) =>
  n === null || n === undefined || !isFinite(n) ? "—" : Math.abs(n) < 0.05 ? "0 %" : `${n > 0 ? "+" : ""}${n.toFixed(digits).replace(".", ",")} %`;
export const fmtShare = (n: number | null | undefined, digits = 1) =>
  n === null || n === undefined || !isFinite(n) ? "—" : `${n.toFixed(digits).replace(".", ",")} %`;

export function fmtCompact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return `${fmtDec(n / 1e6)} M`;
  if (a >= 1e4) return `${fmtDec(n / 1e3)} mil`;
  return fmtInt(n);
}

/** Enmascarado de datos sensibles */
export function mask(value: string | null, kind: "cif" | "iban" | "tel" | "email" | "text" = "text"): string {
  if (!value) return "—";
  const v = value.trim();
  if (kind === "email") {
    const [u, d] = v.split("@");
    return `${u.slice(0, 1)}•••@${d ?? "•••"}`;
  }
  if (kind === "iban") return `${v.slice(0, 4)} •••• •••• ${v.replace(/\s/g, "").slice(-4)}`;
  if (kind === "tel") return `••• ••• ${v.replace(/\s/g, "").slice(-3)}`;
  if (kind === "cif") return `•••••${v.slice(-3)}`;
  return "•••••";
}
