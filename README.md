# Assessoria 3.0 Intelligence

Plataforma de Business Intelligence para las exportaciones de contratos del CRM de Assessoria 3.0. Convierte el Excel en un centro de control con KPIs, analítica temporal, energía, comercializadoras, comerciales, mapa, comisiones, incidencias, fichas de cliente, consultas en lenguaje natural e informes PDF/Excel.

Todo el procesamiento ocurre **en el navegador**: el Excel no se sube a ningún servidor.

## Requisitos

- Node.js 20 o superior
- npm 10

## Instalación y ejecución

```bash
npm install
npm run dev          # http://localhost:3000
```

Producción local:

```bash
npm run build
npm start
```

Después, abre **Importar datos** y arrastra la exportación `Contratos_*.xlsx` del CRM.

## Despliegue en Vercel

1. Sube el proyecto a un repositorio de GitHub.
2. En Vercel: *Add New → Project*, importa el repositorio. El framework se detecta solo (Next.js).
3. Opcional: define `ANTHROPIC_API_KEY` (y `ANTHROPIC_MODEL`) en *Settings → Environment Variables* para activar la interpretación de preguntas con IA.
4. *Deploy*.

O desde la terminal: `npx vercel` y luego `npx vercel --prod`.

> Recomendado: protege el despliegue con *Vercel Authentication / Password Protection* mientras no esté activa la autenticación propia de la aplicación.

## Módulos

| Sección | Contenido |
|---|---|
| Overview | Gráfico temporal principal con comparación interanual, 18 indicadores interactivos, estado de la cartera, incidencias, comercializadoras, ranking comercial y mix de tarifas |
| Contratos | Altas por día/semana/mes, evolución anual, comparativa entre años, altas frente a bajas, estados, tiempo tramitación→activación, rankings y tabla completa exportable |
| Energía y consumo | Electricidad (2.0TD/3.0TD/6.1TD), gas (RL1–RL6) y telecomunicaciones por separado; MWh por comercializadora y tarifa; potencia en kW |
| Comercializadoras | Clasificación animada, evolución top 5, estados por compañía, tabla comparativa y ficha de análisis |
| Comerciales | Leaderboard con podio, 5 métricas, categorías (interno, colaborador, administrativa) y nombre editable por correo |
| Mapa de negocio | Mapa de España por provincia (código postal → INE), rankings de provincias y municipios, comparativa territorial |
| Comisiones | Venta y subdominio por período, comercializadora, colaborador, tarifa y estado; distribución; activos sin comisión |
| Pendientes e incidencias | Avisos por prioridad y antigüedad con regla configurable, tabla filtrable y exportable |
| Clientes | Búsqueda por nombre, CIF, CUPS, municipio o comercializadora (teléfono y correo solo para administrador) y ficha 360° |
| Pregunta a tus datos | Motor determinista en español; muestra respuesta, cálculo, filtros, gráfico y registros. IA opcional |
| Informes | PDF ejecutivo, mensual, de comerciales, de comisiones y por comercializadora; Excel y CSV |
| Importar datos | Arrastrar y soltar, detección de hojas y columnas, corrección de correspondencias, calidad de datos, sustituir o fusionar, historial |
| Configuración | Tema, rol y PIN, unidad de consumo, cálculo de comisiones, fecha base, regla de antigüedad, clave de deduplicación, alias y usuarios |

Todos los módulos comparten los filtros globales. Al pulsar barras, segmentos, provincias o filas se filtra el resto, y cada KPI abre los registros originales que lo componen.

## Reglas de datos aplicadas

- **Altas** = fecha de tramitación (en el Excel es idéntica a la de carterización). **Activaciones**, **bajas** y **traspaso** se tratan por separado.
- *Activado* (estado), *con fecha de activación*, *firmado* y *comisionado* son indicadores distintos.
- **Clientes únicos** por CIF/NIF normalizado. **CUPS únicos** aparte.
- **Consumo**: el Excel no indica la unidad. Por sus valores se supone kWh/año y se muestra como «unidad supuesta» hasta confirmarlo en Configuración. Luz y gas nunca se suman entre sí y telecomunicaciones se excluye.
- **Comisiones**: son importes registrados, no cobros. El total (venta + subdominio) es configurable.
- **Provincia**: se deduce del código postal porque el campo de texto tiene 87 variantes. Si falta el CP, se usa el texto con corrección de erratas.
- **Duplicados**: no hay ID de contrato en la exportación. La clave se forma con CIF + CUPS + tipo + comercializadora + tarifa + producto (es configurable) más el nº de aparición en el archivo. Reimportar el mismo archivo da 0 altas nuevas.
- Ninguna fila se descarta: los problemas quedan como avisos.

El análisis completo del esquema está en [`docs/ESQUEMA.md`](docs/ESQUEMA.md).

## Privacidad y seguridad

- El Excel se procesa en un Web Worker local. Los datos se guardan solo en el IndexedDB del navegador, y puedes desactivarlo o borrarlo desde Configuración.
- CIF, IBAN, teléfono, correo y dirección están enmascarados por defecto. Solo el rol *Administrador* puede mostrarlos, con PIN opcional, y se ocultan de nuevo al recargar. Las exportaciones también se enmascaran.
- El mapa agrega por provincia y municipio. No se geocodifican domicilios.
- La IA opcional (`/api/ask`) recibe únicamente la pregunta y los nombres de comercializadoras, provincias y tarifas. Las cifras siempre se calculan en el navegador.
- **Roles en modo local**: el selector de rol es un control de interfaz de esta sesión, no una barrera de seguridad entre personas. Para uso multiusuario, protege el despliegue y activa Supabase.

## Paso a Supabase (almacenamiento centralizado)

1. Crea un proyecto en Supabase y ejecuta `supabase/schema.sql`. Incluye roles, RLS, la tabla `contract_pii` solo para admin, y las tablas `settlements` y `costs` para liquidaciones y costes reales.
2. Activa Supabase Auth y asigna roles en `profiles`.
3. Implementa `ContractRepository` (`src/lib/repository`) con `@supabase/supabase-js` y sustitúyelo en `src/lib/store.ts`.

No cargues datos personales en Supabase antes de completar los pasos 1 y 2.

## Tecnología

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Motion · Apache ECharts · SheetJS (build oficial 0.20.3 vía `@e965/xlsx`, sin las vulnerabilidades de la 0.18 de npm) · jsPDF · TanStack Virtual · Zustand · IndexedDB · cartografía del IGN (es-atlas).

## Estructura

```
src/app/                 páginas (una por módulo) y API /api/ask
src/components/          shell, UI, gráficos, overlays (fichas, cajones)
src/lib/import/          worker de importación, calidad, fusión
src/lib/                 normalización, métricas, incidencias, IA, PDF, exportación
supabase/schema.sql      esquema y políticas RLS
docs/ESQUEMA.md          análisis del Excel real
```
