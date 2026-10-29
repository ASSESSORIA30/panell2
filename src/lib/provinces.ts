/** Provincias españolas por código INE (= 2 primeros dígitos del CP). */
export const PROVINCES: Record<string, string> = {
  "01": "Álava", "02": "Albacete", "03": "Alicante", "04": "Almería", "05": "Ávila", "06": "Badajoz",
  "07": "Illes Balears", "08": "Barcelona", "09": "Burgos", "10": "Cáceres", "11": "Cádiz", "12": "Castellón",
  "13": "Ciudad Real", "14": "Córdoba", "15": "A Coruña", "16": "Cuenca", "17": "Girona", "18": "Granada",
  "19": "Guadalajara", "20": "Gipuzkoa", "21": "Huelva", "22": "Huesca", "23": "Jaén", "24": "León",
  "25": "Lleida", "26": "La Rioja", "27": "Lugo", "28": "Madrid", "29": "Málaga", "30": "Murcia",
  "31": "Navarra", "32": "Ourense", "33": "Asturias", "34": "Palencia", "35": "Las Palmas", "36": "Pontevedra",
  "37": "Salamanca", "38": "Santa Cruz de Tenerife", "39": "Cantabria", "40": "Segovia", "41": "Sevilla",
  "42": "Soria", "43": "Tarragona", "44": "Teruel", "45": "Toledo", "46": "Valencia", "47": "Valladolid",
  "48": "Bizkaia", "49": "Zamora", "50": "Zaragoza", "51": "Ceuta", "52": "Melilla",
};

const strip = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

/** Alias de texto → código. Incluye municipios que aparecen escritos en la columna Provincia. */
const NAME_ALIASES: Record<string, string> = {
  alava: "01", araba: "01", albacete: "02", alicante: "03", alacant: "03", almeria: "04", avila: "05",
  badajoz: "06", baleares: "07", "illes balears": "07", "islas baleares": "07", mallorca: "07", menorca: "07", ibiza: "07",
  barcelona: "08", burgos: "09", caceres: "10", cadiz: "11", castellon: "12", castello: "12", "ciudad real": "13",
  cordoba: "14", coruna: "15", "a coruna": "15", "la coruna": "15", cuenca: "16", girona: "17", gerona: "17",
  granada: "18", guadalajara: "19", gipuzkoa: "20", guipuzcoa: "20", huelva: "21", huesca: "22", jaen: "23",
  leon: "24", lleida: "25", lerida: "25", "la rioja": "26", rioja: "26", lugo: "27", madrid: "28", malaga: "29",
  murcia: "30", navarra: "31", ourense: "32", orense: "32", asturias: "33", palencia: "34", "las palmas": "35",
  pontevedra: "36", salamanca: "37", "santa cruz de tenerife": "38", tenerife: "38", cantabria: "39", segovia: "40",
  sevilla: "41", soria: "42", tarragona: "43", teruel: "44", toledo: "45", valencia: "46", valladolid: "47",
  bizkaia: "48", vizcaya: "48", zamora: "49", zaragoza: "50", ceuta: "51", melilla: "52",
  // municipios escritos como provincia en el CRM
  reus: "43", cambrils: "43", "miami platja": "43", mataro: "08", monzon: "22", binefar: "22", barbastro: "22",
  fraga: "22", zaidin: "22", marbella: "29", alcoletge: "25", "la granja d escarp": "25",
};

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

export function provinceFromName(raw: string | null): string | null {
  if (!raw) return null;
  const s = strip(raw);
  if (!s) return null;
  if (NAME_ALIASES[s]) return NAME_ALIASES[s];
  // "Fraga (Huesca)", "Valencia/València", "Tarragona,"
  for (const part of s.split(" ")) if (NAME_ALIASES[part] && part.length > 3) return NAME_ALIASES[part];
  for (const [k, v] of Object.entries(NAME_ALIASES)) if (s.includes(k) && k.length > 4) return v;
  // errores tipográficos: LLEIFA, LELIDA, LLEIODA, BASRBASTRO
  let best: [string, number] | null = null;
  for (const [k, v] of Object.entries(NAME_ALIASES)) {
    if (Math.abs(k.length - s.length) > 2) continue;
    const dist = levenshtein(s, k);
    if (dist <= 2 && (!best || dist < best[1])) best = [v, dist];
  }
  return best ? best[0] : null;
}

/** Normaliza el CP. Devuelve null si no es válido. */
export function normalizeCP(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim().replace(/\.0$/, "").replace(/\s/g, "");
  if (/^\d{4}$/.test(s)) s = "0" + s;
  if (!/^\d{5}$/.test(s)) return null;
  const code = s.slice(0, 2);
  return PROVINCES[code] ? s : null;
}

export function resolveProvince(cp: string | null, provinciaRaw: string | null): { code: string | null; name: string | null; source: "cp" | "texto" | null } {
  const byName = provinceFromName(provinciaRaw);
  if (cp) {
    const code = cp.slice(0, 2);
    return { code, name: PROVINCES[code], source: "cp" };
  }
  if (byName) return { code: byName, name: PROVINCES[byName], source: "texto" };
  return { code: null, name: null, source: null };
}
