"use client";
import type { EChartsOption } from "echarts";
import type { Contract, Settings, ISODate } from "./types";
import { chartTokens } from "./palette";
import { addMonths, fmtDate, fmtMonth, fmtMonthLong, monthRange, endOfMonth } from "./dates";
import { fmtEur, fmtInt, fmtShare } from "./format";
import { clientKeyOf, commissionOf, computeKpis, countBy, hasCommission, ownerLabel, PENDING_STATES, ranked, sum } from "./metrics";
import { ESTADO_LABEL, ESTADOS } from "./normalize";
import { detectIncidents, INCIDENT_META, type IncidentType } from "./incidents";
import { barsOption, linesOption } from "@/components/charts/builders";

type JsPDF = import("jspdf").jsPDF;

const INK = [17, 19, 23] as const;
const MUTED = [110, 116, 128] as const;
const BRAND = [196, 140, 30] as const;
const W = 210, M = 16;

async function chartImage(option: EChartsOption, width = 900, height = 340): Promise<string> {
  const { echarts } = await import("@/components/charts/EChart");
  const div = document.createElement("div");
  div.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px`;
  document.body.appendChild(div);
  const inst = echarts.init(div, undefined, { renderer: "canvas", width, height });
  inst.setOption({ animation: false, backgroundColor: "#ffffff", ...option });
  const url = inst.getDataURL({ pixelRatio: 2, backgroundColor: "#ffffff" });
  inst.dispose();
  div.remove();
  return url;
}

class Report {
  doc!: JsPDF;
  y = 0;
  autoTable!: typeof import("jspdf-autotable").default;
  constructor(public title: string, public subtitle: string, public filters: string[]) {}

  async init() {
    const { jsPDF } = await import("jspdf");
    this.autoTable = (await import("jspdf-autotable")).default;
    this.doc = new jsPDF({ unit: "mm", format: "a4" });
    this.cover();
    return this;
  }

  cover() {
    const d = this.doc;
    d.setFillColor(17, 19, 23);
    d.rect(0, 0, W, 46, "F");
    d.setFillColor(...BRAND);
    d.roundedRect(M, 12, 9, 9, 2, 2, "F");
    d.setDrawColor(17, 19, 23);
    d.setLineWidth(0.8);
    d.lines([[2.2, -3], [1.8, 1.6], [3, -4]], M + 1.6, 18.6);
    d.setTextColor(255, 255, 255);
    d.setFont("helvetica", "bold");
    d.setFontSize(11);
    d.text("Assessoria 3.0", M + 12, 16.2);
    d.setFont("helvetica", "normal");
    d.setFontSize(8);
    d.setTextColor(170, 176, 186);
    d.text("Intelligence", M + 12, 20.2);
    d.setFontSize(19);
    d.setFont("helvetica", "bold");
    d.setTextColor(255, 255, 255);
    d.text(this.title, M, 34);
    d.setFontSize(9);
    d.setFont("helvetica", "normal");
    d.setTextColor(190, 195, 204);
    d.text(this.subtitle, M, 40.5);
    d.text(`Generado el ${new Date().toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" })}`, W - M, 16.2, { align: "right" });
    this.y = 54;
    d.setTextColor(...MUTED);
    d.setFontSize(8);
    const f = this.filters.length ? `Filtros aplicados: ${this.filters.join(" · ")}` : "Sin filtros: todos los contratos cargados.";
    const lines = d.splitTextToSize(f, W - 2 * M);
    d.text(lines, M, this.y);
    this.y += lines.length * 3.6 + 4;
  }

  ensure(h: number) {
    if (this.y + h > 280) {
      this.doc.addPage();
      this.y = 18;
    }
  }

  section(title: string, note?: string) {
    this.ensure(18);
    const d = this.doc;
    d.setFillColor(...BRAND);
    d.rect(M, this.y - 3.2, 1.2, 4.4, "F");
    d.setTextColor(...INK);
    d.setFont("helvetica", "bold");
    d.setFontSize(11.5);
    d.text(title, M + 3.5, this.y);
    this.y += 5;
    if (note) {
      d.setFont("helvetica", "normal");
      d.setFontSize(8);
      d.setTextColor(...MUTED);
      const l = d.splitTextToSize(note, W - 2 * M);
      d.text(l, M, this.y);
      this.y += l.length * 3.5 + 1.5;
    }
    this.y += 1.5;
  }

  kpis(items: { label: string; value: string; hint?: string }[]) {
    const d = this.doc;
    const cols = Math.min(4, items.length);
    const gap = 3;
    const w = (W - 2 * M - gap * (cols - 1)) / cols;
    const h = 20;
    items.forEach((it, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      if (c === 0) this.ensure(h + 3);
      const x = M + c * (w + gap), y = this.y + r * 0; // filas gestionadas abajo
      d.setDrawColor(226, 229, 234);
      d.setFillColor(248, 249, 251);
      d.roundedRect(x, y, w, h, 2, 2, "FD");
      d.setFont("helvetica", "normal");
      d.setFontSize(7.5);
      d.setTextColor(...MUTED);
      d.text(it.label, x + 3, y + 5.5);
      d.setFont("helvetica", "bold");
      d.setFontSize(13);
      d.setTextColor(...INK);
      d.text(it.value, x + 3, y + 12.5);
      if (it.hint) {
        d.setFont("helvetica", "normal");
        d.setFontSize(6.8);
        d.setTextColor(...MUTED);
        d.text(d.splitTextToSize(it.hint, w - 6)[0], x + 3, y + 17);
      }
      if (c === cols - 1 || i === items.length - 1) this.y += h + 3;
    });
    this.y += 2;
  }

  async chart(option: EChartsOption, hMm = 62) {
    this.ensure(hMm + 4);
    const img = await chartImage(option, 900, Math.round((hMm / (W - 2 * M)) * 900));
    this.doc.addImage(img, "PNG", M, this.y, W - 2 * M, hMm);
    this.y += hMm + 5;
  }

  table(head: string[], body: (string | number)[][], align: ("left" | "right")[] = []) {
    this.ensure(20);
    this.autoTable(this.doc, {
      startY: this.y,
      head: [head],
      body: body.map((r) => r.map(String)),
      margin: { left: M, right: M },
      styles: { font: "helvetica", fontSize: 8, cellPadding: 1.8, textColor: [40, 44, 52], lineColor: [232, 234, 238], lineWidth: 0.1 },
      headStyles: { fillColor: [17, 19, 23], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 249, 251] },
      columnStyles: Object.fromEntries(align.map((a, i) => [i, { halign: a }])),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.y = (this.doc as any).lastAutoTable.finalY + 7;
  }

  paragraph(text: string) {
    const d = this.doc;
    d.setFont("helvetica", "normal");
    d.setFontSize(8.5);
    d.setTextColor(60, 64, 72);
    const l = d.splitTextToSize(text, W - 2 * M);
    this.ensure(l.length * 4 + 2);
    d.text(l, M, this.y);
    this.y += l.length * 4 + 3;
  }

  save(name: string) {
    const d = this.doc;
    const n = d.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      d.setPage(i);
      d.setFont("helvetica", "normal");
      d.setFontSize(7);
      d.setTextColor(...MUTED);
      d.text("Assessoria 3.0 · Documento confidencial de uso interno · Importes de comisión registrados, no cobros confirmados", M, 290);
      d.text(`${i} / ${n}`, W - M, 290, { align: "right" });
    }
    d.save(`Assessoria30_${name}_${new Date().toISOString().slice(0, 10)}.pdf`);
  }
}

export interface ReportCtx {
  rows: Contract[];
  settings: Settings;
  ref: ISODate;
  filters: string[];
  comColors: Record<string, string>;
}

const light = chartTokens("light");
const mwh = (rows: Contract[], tipo: "luz" | "gas", s: Settings) => sum(rows.filter((c) => c.tipo === tipo), (c) => c.consumo) * (s.consumoUnit === "kWh" ? 1 / 1000 : 1);
const comm = (c: Contract, s: Settings) => commissionOf(c, s.commissionMode === "none" ? "sum" : s.commissionMode);
const unitNote = (s: Settings) => (s.consumoConfirmed ? "" : ` Unidad de consumo supuesta (${s.consumoUnit}${s.consumoPeriod === "anual" ? "/año" : ""}), pendiente de confirmar.`);

function companyTable(rows: Contract[], s: Settings, top = 12) {
  return ranked(countBy(rows, (c) => c.comercializadora)).slice(0, top).map((r) => [
    r.key,
    fmtInt(r.n),
    fmtShare((r.n / rows.length) * 100),
    fmtInt(r.items.filter((c) => c.estado === "activado").length),
    fmtInt(r.items.filter((c) => PENDING_STATES.includes(c.estado)).length),
    fmtInt(mwh(r.items, "luz", s)),
    fmtInt(mwh(r.items, "gas", s)),
    fmtEur(sum(r.items, (c) => comm(c, s))),
  ]);
}
const COMPANY_HEAD = ["Comercializadora", "Contratos", "Cuota", "Activados", "Pendientes", "Luz MWh", "Gas MWh", "Comisiones"];
const R8: ("left" | "right")[] = ["left", "right", "right", "right", "right", "right", "right", "right"];

function ownerTable(rows: Contract[], s: Settings, top = 20) {
  return ranked(countBy(rows, (c) => c.owners)).slice(0, top).map((r, i) => [
    String(i + 1),
    ownerLabel(r.key, s),
    fmtInt(r.n),
    fmtInt(r.items.filter((c) => c.estado === "activado" || c.estado === "comisionado").length),
    fmtInt(r.items.filter((c) => PENDING_STATES.includes(c.estado)).length),
    fmtInt(r.items.filter((c) => c.estado === "baja" || c.estado === "anulado").length),
    fmtInt(mwh(r.items, "luz", s) + mwh(r.items, "gas", s)),
    fmtEur(sum(r.items, (c) => comm(c, s))),
  ]);
}

function monthlyAltas(rows: Contract[], ref: ISODate, months = 12) {
  const ms = monthRange(addMonths(ref, -(months - 1)), ref);
  return barsOption(light, ms.map(fmtMonth), [
    { name: "Altas (tramitación)", color: light.series[0], data: ms.map((m) => rows.filter((c) => c.fTramitacion?.startsWith(m)).length) },
    { name: "Activaciones", color: light.series[2], data: ms.map((m) => rows.filter((c) => c.fActivacion?.startsWith(m)).length) },
    { name: "Bajas", color: light.series[7], data: ms.map((m) => rows.filter((c) => c.fBaja?.startsWith(m)).length) },
  ]);
}

export async function executiveReport(ctx: ReportCtx) {
  const { rows, settings: s, ref } = ctx;
  const k = computeKpis(rows, ref, s);
  const r = await new Report("Informe ejecutivo", `Situación de la cartera a ${fmtDate(ref)} · ${fmtInt(rows.length)} contratos`, ctx.filters).init();
  r.kpis([
    { label: "Contratos", value: fmtInt(k.total), hint: `${fmtInt(k.clientes)} clientes únicos` },
    { label: "Nuevos este mes", value: fmtInt(k.nuevosMes), hint: "por fecha de tramitación" },
    { label: "Activados (estado)", value: fmtInt(k.activados), hint: `${fmtInt(k.conFechaActivacion)} con fecha de activación` },
    { label: "Pendientes", value: fmtInt(k.pendientes), hint: "incluye pendiente de activación" },
    { label: "Electricidad", value: `${fmtInt(k.consumoLuz)} MWh`, hint: `${fmtInt(k.consumoLuzN)} contratos con consumo` },
    { label: "Gas", value: `${fmtInt(k.consumoGas)} MWh`, hint: `${fmtInt(k.consumoGasN)} contratos con consumo` },
    { label: "Comisión venta", value: fmtEur(k.comVenta), hint: "importes registrados" },
    { label: "Comisión subdominio", value: fmtEur(k.comSub), hint: "importes registrados" },
  ]);
  r.section("Actividad de los últimos 12 meses", "Altas por fecha de tramitación, activaciones por fecha de activación y bajas por fecha de baja.");
  await r.chart(monthlyAltas(rows, ref));
  r.section("Estado actual de la cartera");
  r.table(["Estado", "Contratos", "Cuota"], ESTADOS.map((e) => ({ e, n: rows.filter((c) => c.estado === e.key).length })).filter((x) => x.n).map((x) => [x.e.label, fmtInt(x.n), fmtShare((x.n / rows.length) * 100)]), ["left", "right", "right"]);
  r.section("Comercializadoras", `Ranking por número de contratos.${unitNote(s)}`);
  r.table(COMPANY_HEAD, companyTable(rows, s, 10), R8);
  r.section("Comerciales y colaboradores", "Usuario propietario del CRM. Un contrato con dos propietarios cuenta para ambos.");
  r.table(["#", "Usuario", "Contratos", "Act./com.", "Pendientes", "Bajas/anul.", "MWh", "Comisiones"], ownerTable(rows, s, 10), ["right", "left", "right", "right", "right", "right", "right", "right"]);
  const inc = detectIncidents(rows, ref, s);
  const byT = new Map<IncidentType, number>();
  inc.forEach((i) => byT.set(i.type, (byT.get(i.type) ?? 0) + 1));
  r.section("Pendientes e incidencias", `Regla de antigüedad: ${s.ageRuleEnabled ? `más de ${s.ageThresholdDays} días sin activar` : "desactivada"}.`);
  r.table(["Aviso", "Prioridad", "Contratos"], [...byT.entries()].map(([t, n]) => [INCIDENT_META[t].label, INCIDENT_META[t].priority, fmtInt(n)]), ["left", "left", "right"]);
  r.save("Informe_ejecutivo");
}

export async function monthlyReport(ctx: ReportCtx, month: string) {
  const { rows, settings: s } = ctx;
  const from = `${month}-01`, to = endOfMonth(from);
  const pf = addMonths(from, -1).slice(0, 7);
  const inM = (d: string | null, m: string) => !!d && d.startsWith(m);
  const altas = rows.filter((c) => inM(c.fTramitacion, month));
  const prev = rows.filter((c) => inM(c.fTramitacion, pf));
  const act = rows.filter((c) => inM(c.fActivacion, month));
  const bajas = rows.filter((c) => inM(c.fBaja, month));
  const r = await new Report("Informe mensual", `${fmtMonthLong(month)} · ${fmtDate(from)} – ${fmtDate(to)}`, ctx.filters).init();
  const g = prev.length ? ((altas.length - prev.length) / prev.length) * 100 : null;
  r.kpis([
    { label: "Altas comerciales", value: fmtInt(altas.length), hint: g === null ? "sin base el mes anterior" : `${g > 0 ? "+" : ""}${g.toFixed(1).replace(".", ",")} % vs ${fmtMonthLong(pf)}` },
    { label: "Activaciones", value: fmtInt(act.length), hint: "por fecha de activación" },
    { label: "Bajas", value: fmtInt(bajas.length), hint: "por fecha de baja" },
    { label: "Clientes nuevos o recurrentes", value: fmtInt(new Set(altas.map(clientKeyOf)).size) },
    { label: "Electricidad (altas)", value: `${fmtInt(mwh(altas, "luz", s))} MWh` },
    { label: "Gas (altas)", value: `${fmtInt(mwh(altas, "gas", s))} MWh` },
    { label: "Comisiones de las altas", value: fmtEur(sum(altas, (c) => comm(c, s))), hint: "importes registrados" },
    { label: "Altas sin comisión", value: fmtInt(altas.filter((c) => !hasCommission(c)).length) },
  ]);
  const days = Array.from({ length: +to.slice(8) }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
  r.section("Altas por día");
  await r.chart(barsOption(light, days.map((d) => String(+d.slice(8))), [{ name: "Altas", color: light.series[0], data: days.map((d) => altas.filter((c) => c.fTramitacion === d).length) }], { legend: false }), 52);
  r.section("Altas por comercializadora", unitNote(s).trim() || undefined);
  r.table(COMPANY_HEAD, companyTable(altas, s), R8);
  r.section("Altas por tarifa");
  r.table(["Tarifa", "Altas", "Cuota"], ranked(countBy(altas, (c) => c.tarifa)).map((x) => [x.key, fmtInt(x.n), fmtShare((x.n / Math.max(1, altas.length)) * 100)]), ["left", "right", "right"]);
  r.section("Altas por comercial");
  r.table(["#", "Usuario", "Altas", "Act./com.", "Pendientes", "Bajas/anul.", "MWh", "Comisiones"], ownerTable(altas, s, 15), ["right", "left", "right", "right", "right", "right", "right", "right"]);
  r.save(`Informe_mensual_${month}`);
}

export async function commercialsReport(ctx: ReportCtx) {
  const { rows, settings: s, ref } = ctx;
  const r = await new Report("Informe de comerciales", `Rendimiento por usuario propietario · ${fmtInt(rows.length)} contratos`, ctx.filters).init();
  const top = ranked(countBy(rows, (c) => c.owners)).slice(0, 6);
  const ms = monthRange(addMonths(ref, -11), ref);
  r.section("Evolución de altas · top 6", "Altas mensuales por fecha de tramitación, últimos 12 meses.");
  await r.chart(linesOption(light, ms.map(fmtMonth), top.map((o, i) => ({ name: ownerLabel(o.key, s).slice(0, 28), color: light.series[i], data: ms.map((m) => o.items.filter((c) => c.fTramitacion?.startsWith(m)).length) }))), 70);
  r.section("Clasificación", "Un contrato con dos propietarios cuenta para ambos. Comisiones = importes registrados.");
  r.table(["#", "Usuario", "Contratos", "Act./com.", "Pendientes", "Bajas/anul.", "MWh", "Comisiones"], ownerTable(rows, s, 60), ["right", "left", "right", "right", "right", "right", "right", "right"]);
  r.save("Informe_comerciales");
}

export async function commissionsReport(ctx: ReportCtx) {
  const { rows, settings: s, ref } = ctx;
  const v = sum(rows, (c) => c.comisionVenta), sd = sum(rows, (c) => c.comisionSubdominio);
  const r = await new Report("Informe de comisiones", "Importes registrados en el CRM · no incluye cobros, costes ni márgenes", ctx.filters).init();
  r.kpis([
    { label: "Comisión venta", value: fmtEur(v), hint: `${fmtInt(rows.filter((c) => c.comisionVenta !== null).length)} contratos` },
    { label: "Comisión subdominio", value: fmtEur(sd), hint: `${fmtInt(rows.filter((c) => c.comisionSubdominio !== null).length)} contratos` },
    { label: "Total registrado", value: s.commissionMode === "none" ? "—" : fmtEur(sum(rows, (c) => commissionOf(c, s.commissionMode))), hint: s.commissionMode === "sum" ? "venta + subdominio" : s.commissionMode },
    { label: "Sin comisión registrada", value: fmtInt(rows.filter((c) => !hasCommission(c)).length) },
  ]);
  const ms = monthRange(addMonths(ref, -11), ref);
  r.section("Evolución mensual", "Imputado al mes de tramitación.");
  await r.chart(barsOption(light, ms.map(fmtMonth), [
    { name: "Venta", color: light.series[0], data: ms.map((m) => Math.round(sum(rows.filter((c) => c.fTramitacion?.startsWith(m)), (c) => c.comisionVenta))) },
    { name: "Subdominio", color: light.series[2], data: ms.map((m) => Math.round(sum(rows.filter((c) => c.fTramitacion?.startsWith(m)), (c) => c.comisionSubdominio))) },
  ], { stack: true, fmt: (n) => fmtEur(n) }));
  const grp = (m: Map<string, Contract[]>, label: (k: string) => string = (k) => k) =>
    [...m.entries()].map(([k, items]) => ({ k, items, v: sum(items, (c) => c.comisionVenta), s: sum(items, (c) => c.comisionSubdominio) })).sort((a, b) => b.v + b.s - (a.v + a.s)).slice(0, 25).map((x) => [label(x.k), fmtInt(x.items.filter(hasCommission).length), fmtEur(x.v), fmtEur(x.s), fmtEur(x.v + x.s)]);
  const head = ["", "Con importe", "Venta", "Subdominio", "Venta + sub."];
  const al: ("left" | "right")[] = ["left", "right", "right", "right", "right"];
  r.section("Por comercializadora");
  r.table(["Comercializadora", ...head.slice(1)], grp(countBy(rows, (c) => c.comercializadora)), al);
  r.section("Por colaborador");
  r.table(["Usuario", ...head.slice(1)], grp(countBy(rows, (c) => c.owners), (k) => ownerLabel(k, s)), al);
  r.section("Por tarifa");
  r.table(["Tarifa", ...head.slice(1)], grp(countBy(rows, (c) => c.tarifa)), al);
  r.section("Por estado del contrato", "«Comisionado» es un estado del CRM, no un cobro confirmado.");
  r.table(["Estado", ...head.slice(1)], grp(countBy(rows, (c) => ESTADO_LABEL[c.estado])), al);
  r.save("Informe_comisiones");
}

export async function companyReport(ctx: ReportCtx, company: string) {
  const { settings: s, ref } = ctx;
  const rows = ctx.rows.filter((c) => c.comercializadora === company);
  const r = await new Report(`Informe · ${company}`, `${fmtInt(rows.length)} contratos · ${fmtShare((rows.length / Math.max(1, ctx.rows.length)) * 100)} del total filtrado`, ctx.filters).init();
  const k = computeKpis(rows, ref, s);
  r.kpis([
    { label: "Contratos", value: fmtInt(k.total), hint: `${fmtInt(k.clientes)} clientes` },
    { label: "Activados (estado)", value: fmtInt(k.activados) },
    { label: "Pendientes", value: fmtInt(k.pendientes) },
    { label: "Comisionados (estado)", value: fmtInt(k.comisionados) },
    { label: "Electricidad", value: `${fmtInt(k.consumoLuz)} MWh` },
    { label: "Gas", value: `${fmtInt(k.consumoGas)} MWh` },
    { label: "Comisión venta", value: fmtEur(k.comVenta) },
    { label: "Comisión subdominio", value: fmtEur(k.comSub) },
  ]);
  r.section("Evolución mensual");
  await r.chart(monthlyAltas(rows, ref));
  r.section("Tarifas");
  r.table(["Tarifa", "Contratos", "Cuota", "MWh"], ranked(countBy(rows, (c) => c.tarifa)).map((x) => [x.key, fmtInt(x.n), fmtShare((x.n / rows.length) * 100), x.items[0].tipo === "telefonia" ? "—" : fmtInt(mwh(x.items, x.items[0].tipo === "gas" ? "gas" : "luz", s))]), ["left", "right", "right", "right"]);
  r.section("Estados");
  r.table(["Estado", "Contratos", "Cuota"], ESTADOS.map((e) => ({ e, n: rows.filter((c) => c.estado === e.key).length })).filter((x) => x.n).map((x) => [x.e.label, fmtInt(x.n), fmtShare((x.n / rows.length) * 100)]), ["left", "right", "right"]);
  r.section("Comerciales");
  r.table(["#", "Usuario", "Contratos", "Act./com.", "Pendientes", "Bajas/anul.", "MWh", "Comisiones"], ownerTable(rows, s, 20), ["right", "left", "right", "right", "right", "right", "right", "right"]);
  r.save(`Informe_${company.replace(/\s+/g, "_")}`);
}
