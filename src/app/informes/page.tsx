"use client";
import { useMemo, useState } from "react";
import { FileText, CalendarDays, Users, Coins, Building2, FileSpreadsheet, Loader2, Download, Table2 } from "lucide-react";
import { useData } from "@/lib/useData";
import { useStore } from "@/lib/store";
import { describeFilters } from "@/lib/describe";
import { commercialsReport, commissionsReport, companyReport, executiveReport, monthlyReport, type ReportCtx } from "@/lib/pdf";
import { exportContracts, exportTable } from "@/lib/export";
import { countBy, ownerLabel, PENDING_STATES, ranked, sum } from "@/lib/metrics";
import { fmtMonthLong, monthRange, addMonths } from "@/lib/dates";
import { fmtInt } from "@/lib/format";
import { NoData, PageIntro } from "@/components/ui/kpi";
import { Button, Notice, cx } from "@/components/ui/primitives";

function Card({ icon: Icon, title, desc, children }: { icon: typeof FileText; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="panel flex flex-col p-5">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand"><Icon size={17} /></div>
      <h3 className="mt-3 text-[15px] font-semibold tracking-[-0.01em]">{title}</h3>
      <p className="mt-1 flex-1 text-[13px] leading-relaxed text-ink-3">{desc}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export default function InformesPage() {
  const { rows, settings, ref, filters, comColors, empty } = useData();
  const unlocked = useStore((s) => s.sensitiveUnlocked);
  const notify = useStore((s) => s.notify);
  const [busy, setBusy] = useState<string | null>(null);
  const months = useMemo(() => monthRange(addMonths(ref, -23), ref).reverse(), [ref]);
  const [month, setMonth] = useState(ref.slice(0, 7));
  const companies = useMemo(() => ranked(countBy(rows, (c) => c.comercializadora)).map((r) => r.key), [rows]);
  const [company, setCompany] = useState("");
  const ctx: ReportCtx = { rows, settings, ref, filters: describeFilters(filters, settings).map((x) => x.replace("Filtro global · ", "")), comColors };
  const sensitive = unlocked && settings.role === "admin";

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
      notify("Informe generado y descargado.");
    } catch (e) {
      notify(`No se pudo generar el informe: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };
  const Spin = ({ k }: { k: string }) => (busy === k ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />);

  if (empty) return <NoData />;

  const summarySheets = () => [
    { name: "Comercializadoras", rows: ranked(countBy(rows, (c) => c.comercializadora)).map((r) => ({ Comercializadora: r.key, Contratos: r.n, Activados: r.items.filter((c) => c.estado === "activado").length, Pendientes: r.items.filter((c) => PENDING_STATES.includes(c.estado)).length, "Comisión venta": sum(r.items, (c) => c.comisionVenta), "Comisión subdominio": sum(r.items, (c) => c.comisionSubdominio) })) },
    { name: "Comerciales", rows: ranked(countBy(rows, (c) => c.owners)).map((r) => ({ Usuario: ownerLabel(r.key, settings), Correo: r.key, Contratos: r.n, "Activados o comisionados": r.items.filter((c) => c.estado === "activado" || c.estado === "comisionado").length, Pendientes: r.items.filter((c) => PENDING_STATES.includes(c.estado)).length, "Comisión venta": sum(r.items, (c) => c.comisionVenta), "Comisión subdominio": sum(r.items, (c) => c.comisionSubdominio) })) },
    { name: "Tarifas", rows: ranked(countBy(rows, (c) => c.tarifa)).map((r) => ({ Tarifa: r.key, Contratos: r.n, [`Consumo (${settings.consumoUnit})`]: sum(r.items, (c) => c.consumo) })) },
    { name: "Provincias", rows: ranked(countBy(rows, (c) => c.provincia ?? "Sin provincia")).map((r) => ({ Provincia: r.key, Contratos: r.n })) },
  ];

  return (
    <div className="grid gap-5">
      <PageIntro title="Informes y exportaciones">
        Todos los informes respetan los filtros activos ({fmtInt(rows.length)} contratos). Los PDF tienen formato corporativo y se generan en el navegador.
      </PageIntro>
      {ctx.filters.length > 0 && <Notice>Filtros incluidos: {ctx.filters.join(" · ")}</Notice>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card icon={FileText} title="Informe ejecutivo" desc="KPIs principales, actividad de 12 meses, estados, comercializadoras, comerciales e incidencias.">
          <Button variant="primary" size="sm" disabled={!!busy} onClick={() => run("exec", () => executiveReport(ctx))}><Spin k="exec" /> Descargar PDF</Button>
        </Card>
        <Card icon={CalendarDays} title="Informe mensual" desc="Altas, activaciones y bajas del mes elegido con comparación frente al mes anterior.">
          <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mes del informe" className="h-7 rounded-md border border-line bg-surface-2 px-2 text-[12.5px] text-ink outline-none">
            {months.map((m) => <option key={m} value={m}>{fmtMonthLong(m)}</option>)}
          </select>
          <Button variant="primary" size="sm" disabled={!!busy} onClick={() => run("month", () => monthlyReport(ctx, month))}><Spin k="month" /> PDF</Button>
        </Card>
        <Card icon={Users} title="Informe de comerciales" desc="Clasificación completa por usuario propietario y evolución de los seis primeros.">
          <Button variant="primary" size="sm" disabled={!!busy} onClick={() => run("com", () => commercialsReport(ctx))}><Spin k="com" /> Descargar PDF</Button>
        </Card>
        <Card icon={Coins} title="Informe de comisiones" desc="Importes registrados por comercializadora, colaborador, tarifa y estado. Sin cobros ni márgenes.">
          <Button variant="primary" size="sm" disabled={!!busy} onClick={() => run("comm", () => commissionsReport(ctx))}><Spin k="comm" /> Descargar PDF</Button>
        </Card>
        <Card icon={Building2} title="Informe por comercializadora" desc="Ficha completa de una compañía: evolución, tarifas, estados y comerciales.">
          <select value={company} onChange={(e) => setCompany(e.target.value)} aria-label="Comercializadora del informe" className={cx("h-7 max-w-[160px] rounded-md border border-line bg-surface-2 px-2 text-[12.5px] outline-none", company ? "text-ink" : "text-ink-3")}>
            <option value="">Elige compañía</option>
            {companies.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <Button variant="primary" size="sm" disabled={!!busy || !company} onClick={() => run("co", () => companyReport(ctx, company))}><Spin k="co" /> PDF</Button>
        </Card>
        <Card icon={FileSpreadsheet} title="Exportar contratos" desc={`Listado de ${fmtInt(rows.length)} contratos filtrados. ${sensitive ? "Incluye datos sensibles (desbloqueados)." : "CIF, teléfono, correo e IBAN enmascarados."}`}>
          <Button size="sm" disabled={!!busy} onClick={() => run("xlsx", () => exportContracts(rows, settings, "xlsx", "contratos", sensitive))}><Spin k="xlsx" /> Excel</Button>
          <Button size="sm" disabled={!!busy} onClick={() => run("csv", () => exportContracts(rows, settings, "csv", "contratos", sensitive))}><Spin k="csv" /> CSV</Button>
        </Card>
        <Card icon={Table2} title="Resumen agregado en Excel" desc="Un libro con hojas de comercializadoras, comerciales, tarifas y provincias. Sin datos personales de clientes.">
          <Button size="sm" disabled={!!busy} onClick={() => run("sum", () => exportTable(summarySheets(), "resumen"))}><Spin k="sum" /> Excel</Button>
        </Card>
      </div>
    </div>
  );
}
