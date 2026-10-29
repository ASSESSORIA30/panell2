"use client";
import { useMemo, useState } from "react";
import { Search, Lock } from "lucide-react";
import { useData } from "@/lib/useData";
import { useStore } from "@/lib/store";
import { clientKeyOf, sum } from "@/lib/metrics";
import { keyText } from "@/lib/normalize";
import { fmtInt } from "@/lib/format";
import { fmtDate } from "@/lib/dates";
import { tipoColor } from "@/lib/palette";
import { FilteredEmpty, NoData, PageIntro } from "@/components/ui/kpi";
import { Badge, Notice, Panel } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/DataTable";
import type { Contract, ProductType } from "@/lib/types";

interface Client {
  key: string;
  nombre: string;
  items: Contract[];
  municipio: string;
  comercializadoras: string[];
  tipos: ProductType[];
  activos: number;
  last: string | null;
  mwh: number;
  hay: string;
  sensitiveHay: string;
}

export default function ClientesPage() {
  const { rows, settings, comColors, empty } = useData();
  const openClient = useStore((s) => s.openClient);
  const unlocked = useStore((s) => s.sensitiveUnlocked);
  const [q, setQ] = useState("");
  const canSensitive = unlocked && settings.role === "admin";
  const factor = settings.consumoUnit === "kWh" ? 1 / 1000 : 1;

  const clients = useMemo(() => {
    const m = new Map<string, Contract[]>();
    for (const c of rows) {
      const k = clientKeyOf(c);
      const a = m.get(k);
      if (a) a.push(c);
      else m.set(k, [c]);
    }
    return [...m.entries()].map(([key, items]): Client => {
      const f = items[0];
      return {
        key,
        nombre: f.nombre,
        items,
        municipio: [f.poblacion, f.provincia].filter(Boolean).join(", "),
        comercializadoras: [...new Set(items.map((c) => c.comercializadora))],
        tipos: [...new Set(items.map((c) => c.tipo))],
        activos: items.filter((c) => (c.estado === "activado" || c.estado === "comisionado") && !c.fBaja).length,
        last: items.map((c) => c.fTramitacion ?? c.fTraspaso).filter(Boolean).sort().pop() ?? null,
        mwh: sum(items.filter((c) => c.tipo === "luz" || c.tipo === "gas"), (c) => c.consumo) * factor,
        hay: keyText(items.map((c) => `${c.nombre} ${c.cifNorm ?? ""} ${c.cups ?? ""} ${c.poblacion ?? ""} ${c.comercializadora}`).join(" ")),
        sensitiveHay: keyText(items.map((c) => `${(c.telefono ?? "").replace(/\s/g, "")} ${c.email ?? ""}`).join(" ")),
      };
    });
  }, [rows, factor]);

  const found = useMemo(() => {
    const n = keyText(q).trim();
    if (!n) return clients;
    const compact = n.replace(/\s/g, "");
    return clients.filter((c) => c.hay.includes(n) || c.hay.replace(/\s/g, "").includes(compact) || (canSensitive && c.sensitiveHay.includes(compact)));
  }, [clients, q, canSensitive]);

  const cols: Column<Client>[] = [
    { key: "nombre", header: "Cliente", width: "minmax(220px,1.6fr)", cell: (c) => <span className="font-medium text-ink">{c.nombre}</span>, sort: (c) => c.nombre.toLowerCase() },
    { key: "n", header: "Contratos", align: "right", width: 90, cell: (c) => fmtInt(c.items.length), sort: (c) => c.items.length },
    { key: "activos", header: "Activos", align: "right", width: 80, cell: (c) => fmtInt(c.activos), sort: (c) => c.activos },
    { key: "tipos", header: "Suministros", width: 170, cell: (c) => <span className="flex gap-1">{c.tipos.map((t) => <Badge key={t} color={tipoColor(t, settings.theme)}>{t === "luz" ? "Luz" : t === "gas" ? "Gas" : t === "telefonia" ? "Telco" : t}</Badge>)}</span> },
    { key: "com", header: "Comercializadoras", width: "minmax(170px,1.2fr)", cell: (c) => <span className="flex gap-1">{c.comercializadoras.slice(0, 3).map((x) => <Badge key={x} color={comColors[x]}>{x}</Badge>)}{c.comercializadoras.length > 3 && <span className="text-ink-3">+{c.comercializadoras.length - 3}</span>}</span>, sort: (c) => c.comercializadoras[0] },
    { key: "mun", header: "Municipio", width: "minmax(150px,1fr)", cell: (c) => <span className="text-ink-3">{c.municipio || "—"}</span>, sort: (c) => c.municipio },
    { key: "mwh", header: "MWh", align: "right", width: 84, cell: (c) => (c.mwh ? fmtInt(c.mwh) : "—"), sort: (c) => c.mwh },
    { key: "last", header: "Último contrato", width: 120, cell: (c) => fmtDate(c.last), sort: (c) => c.last },
  ];

  if (empty) return <NoData />;
  if (!rows.length) return <FilteredEmpty />;

  return (
    <div className="grid gap-4">
      <PageIntro title="Clientes">{fmtInt(clients.length)} clientes únicos (agrupados por CIF/NIF) con {fmtInt(rows.length)} contratos.</PageIntro>
      <label className="panel relative flex items-center px-4">
        <Search size={18} className="text-ink-3" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={canSensitive ? "Nombre, CIF/NIF, CUPS, municipio, comercializadora, teléfono o correo" : "Nombre, CIF/NIF, CUPS, municipio o comercializadora"}
          aria-label="Buscar cliente"
          className="h-14 w-full bg-transparent px-3 text-[15px] outline-none placeholder:text-ink-3"
        />
        <span className="shrink-0 text-[12px] tabular text-ink-3">{fmtInt(found.length)} resultados</span>
      </label>
      {!canSensitive && (
        <Notice>
          <span className="inline-flex items-center gap-1.5"><Lock size={12} /> La búsqueda por teléfono o correo y la visualización de CIF, IBAN, teléfono y correo requieren el rol Administrador con los datos desbloqueados.</span>
        </Notice>
      )}
      <Panel title="Resultados" subtitle="Clic en un cliente para abrir su ficha completa">
        <DataTable rows={found} columns={cols} rowKey={(c) => c.key} onRowClick={(c) => openClient(c.key)} searchable={false} initialSort={{ key: "n", dir: "desc" }} height={680} />
      </Panel>
    </div>
  );
}
