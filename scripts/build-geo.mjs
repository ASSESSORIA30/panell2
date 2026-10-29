// Genera src/data/spain-provinces.json (GeoJSON) a partir de es-atlas (IGN).
// Canarias se desplaza junto a la península para una visualización compacta.
import { readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";
const topo = JSON.parse(readFileSync(new URL("../node_modules/es-atlas/es/provinces.json", import.meta.url)));
const fc = feature(topo, topo.objects.provinces);
const shift = (c) => (typeof c[0] === "number" ? [+(c[0] + 6.5).toFixed(4), +(c[1] + 7.2).toFixed(4)] : c.map(shift));
const round = (c) => (typeof c[0] === "number" ? [+c[0].toFixed(4), +c[1].toFixed(4)] : c.map(round));
fc.features = fc.features
  .filter((f) => f.id !== "54")
  .map((f) => ({
    type: "Feature",
    id: f.id,
    properties: { code: f.id, name: f.properties.name },
    geometry: { ...f.geometry, coordinates: ["35", "38"].includes(f.id) ? shift(f.geometry.coordinates) : round(f.geometry.coordinates) },
  }));
writeFileSync(new URL("../src/data/spain-provinces.json", import.meta.url), JSON.stringify(fc));
console.log("features", fc.features.length);
