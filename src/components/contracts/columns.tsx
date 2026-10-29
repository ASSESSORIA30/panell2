"use client";
import type { Contract, Settings } from "@/lib/types";
import type { Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/primitives";
import { ESTADO_LABEL, TIPO_LABEL } from "@/lib/normalize";
import { estadoColor, tipoColor, type Mode } from "@/lib/palette";
import { fmtDate } from "@/lib/dates";
import { fmtEur, fmtInt } from "@/lib/format";
import { commissionOf, ownerLabel } from "@/lib/metrics";

export function contractColumns(settings: Settings, comColors: Record<string, string>, opts: { compact?: boolean } = {}): Column<Contract>[] {
  const m: Mode = settings.theme;
  const cols: Column<Contract>[] = [
    {
      key: "nombre",
      header: "Cliente",
      width: "minmax(200px,1.6fr)",
      cell: (c) => <span className="font-medium text-ink">{c.nombre}</span>,
      sort: (c) => c.nombre.toLowerCase(),
      search: (c) => `${c.nombre} ${c.cups ?? ""} ${c.poblacion ?? ""} ${c.producto ?? ""} ${c.cifNorm ?? ""}`,
    },
    {
      key: "tipo",
      header: "Producto",
      width: 140,
      cell: (c) => <Badge color={tipoColor(c.tipo, m)}>{c.tarifa}</Badge>,
      sort: (c) => `${c.tipo}${c.tarifa}`,
      search: (c) => `${TIPO_LABEL[c.tipo]} ${c.tarifa}`,
    },
    {
      key: "comercializadora",
      header: "Comercializadora",
      width: 150,
      cell: (c) => <Badge color={comColors[c.comercializadora]}>{c.comercializadora}</Badge>,
      sort: (c) => c.comercializadora,
      search: (c) => c.comercializadora,
    },
    {
      key: "estado",
      header: "Estado",
      width: 150,
      cell: (c) => <Badge color={estadoColor(c.estado, m)}>{ESTADO_LABEL[c.estado]}</Badge>,
      sort: (c) => c.estado,
      search: (c) => ESTADO_LABEL[c.estado],
    },
    { key: "fTramitacion", header: "Tramitación", width: 104, cell: (c) => fmtDate(c.fTramitacion), sort: (c) => c.fTramitacion },
    { key: "fActivacion", header: "Activación", width: 104, cell: (c) => fmtDate(c.fActivacion), sort: (c) => c.fActivacion },
  ];
  if (!opts.compact) {
    cols.push(
      {
        key: "consumo",
        header: `Consumo (${settings.consumoUnit})`,
        width: 120,
        align: "right",
        cell: (c) => (c.tipo === "luz" || c.tipo === "gas" ? fmtInt(c.consumo) : "—"),
        sort: (c) => (c.tipo === "luz" || c.tipo === "gas" ? c.consumo : null),
      },
      {
        key: "comision",
        header: "Comisión",
        width: 104,
        align: "right",
        cell: (c) => fmtEur(commissionOf(c, settings.commissionMode === "none" ? "sum" : settings.commissionMode), true),
        sort: (c) => commissionOf(c, "sum"),
      },
      {
        key: "owner",
        header: "Propietario",
        width: "minmax(150px,1fr)",
        cell: (c) => <span className="text-ink-3">{c.owners.map((o) => ownerLabel(o, settings)).join(", ")}</span>,
        sort: (c) => ownerLabel(c.ownerPrimary, settings),
        search: (c) => c.owners.map((o) => ownerLabel(o, settings)).join(" "),
      },
      {
        key: "poblacion",
        header: "Municipio",
        width: 130,
        cell: (c) => c.poblacion ?? "—",
        sort: (c) => c.poblacion,
        search: (c) => `${c.poblacion ?? ""} ${c.provincia ?? ""}`,
      },
    );
  }
  return cols;
}
