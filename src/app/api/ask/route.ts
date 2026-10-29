/**
 * Interpretación opcional de preguntas con un modelo de IA (Claude).
 * Solo se envía la pregunta y el vocabulario no personal (nombres de comercializadoras,
 * provincias y tarifas). El modelo devuelve una consulta estructurada que el navegador
 * ejecuta sobre los datos reales: la IA nunca ve contratos ni calcula cifras.
 * Se activa definiendo ANTHROPIC_API_KEY en el entorno (p. ej., en Vercel).
 */
import { NextResponse } from "next/server";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

export async function GET() {
  return NextResponse.json({ enabled: !!process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_API_KEY ? MODEL : null });
}

const SYSTEM = `Eres un traductor de preguntas de negocio en español a una consulta JSON para un panel de contratos energéticos.
Devuelve SOLO un objeto JSON con estas claves:
{"metric":"contratos"|"clientes"|"consumo"|"comision"|"conversion"|"antiguedad",
 "groupBy":"comercializadora"|"owner"|"municipio"|"provincia"|"tarifa"|"estado"|"tipo"|"mes"|null,
 "period":{"from":"AAAA-MM-DD","to":"AAAA-MM-DD","label":"texto breve"}|null,
 "dateField":"fTramitacion"|"fActivacion"|"fBaja",
 "comercializadoras":[], "tipos":[ "luz"|"gas"|"telefonia" ], "tarifas":[], "estados":[ "pendiente"|"pendiente_activacion"|"firmado"|"tramitado"|"activado"|"comisionado"|"incidencia"|"baja"|"anulado" ], "provincias":[], "minDays": número opcional}
Reglas: altas = fTramitacion; activaciones = fActivacion; bajas = fBaja. "owner" = comercial/colaborador. Usa solo nombres del vocabulario dado. No inventes cifras.`;

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "IA no configurada" }, { status: 501 });
  const { question, today, vocab } = (await req.json()) as { question: string; today: string; vocab: { comercializadoras: string[]; provincias: string[]; tarifas: string[] } };
  if (!question || question.length > 500) return NextResponse.json({ error: "Pregunta no válida" }, { status: 400 });
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Fecha de hoy: ${today}\nVocabulario: ${JSON.stringify({ comercializadoras: vocab.comercializadoras.slice(0, 80), provincias: vocab.provincias.slice(0, 60), tarifas: vocab.tarifas.slice(0, 40) })}\nPregunta: ${question}`,
        },
      ],
    }),
  });
  if (!res.ok) return NextResponse.json({ error: `Error del modelo (${res.status})` }, { status: 502 });
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.find((c) => c.type === "text")?.text ?? "";
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return NextResponse.json({ error: "Respuesta no interpretable" }, { status: 502 });
  try {
    return NextResponse.json({ query: JSON.parse(json) });
  } catch {
    return NextResponse.json({ error: "Respuesta no interpretable" }, { status: 502 });
  }
}
