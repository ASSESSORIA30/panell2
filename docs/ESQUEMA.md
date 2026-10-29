# Esquema del Excel del CRM — análisis de `Contratos_20261026_155504.xlsx`

Análisis realizado sobre la exportación real (2.817 filas, 49 columnas en `Contratos`; hoja `Listas` con 10 filas de catálogos).

## Hoja `Contratos`

| Columna CRM | Campo interno | Tipo | Vacías | Notas |
|---|---|---|---|---|
| CIF Cuenta | `cif` | texto | 1 | 1.545 valores únicos. Dos celdas numéricas → se convierten a texto. **Sensible.** |
| Nombre * | `nombre` | texto | 0 | 1.718 únicos. 33 nombres contienen "copia" → posible duplicado. Sufijos " - NIBA" del CRM. |
| Dirección * | `direccion` | texto | 0 | **Sensible**. No se muestra ni se geocodifica. |
| Población * | `poblacion` | texto | 0 | 467 valores; mayúsculas/minúsculas mezcladas → se normaliza. |
| Provincia * | `provinciaRaw` | texto | 0 | **87 variantes** para ~30 provincias reales (LLEIDA, Lleida, lleida, LLEIFA, LELIDA, REUS, CAMBRILS…). La provincia se deduce **del código postal** (2 primeros dígitos = código INE) y solo si falla se usa el texto. |
| Código Postal * | `cp` | texto | 0 | 6 inválidos (`250173`, `0817`, `8700`, `XXXX`…). Ceros a la izquierda recuperados cuando son 4 dígitos. |
| IBAN * | `iban` | texto | 4 | **Sensible**, enmascarado siempre. |
| Tipo de producto * | `tipo` | catálogo | 0 | Luz 2.141 · Gas 543 · Telefonía 133. Catálogo `Listas` admite también dual, alarmas, autoconsumo… |
| Comercializadora * | `comercializadora` | catálogo | 59 | 20 valores. `ELECTRICA SEROSENSE` ≈ `SEROSENSE` (alias configurable). 59 vacías (telefonía). |
| Tarifa * | `tarifa` | catálogo | 60 | 2.0TD, 3.0TD, 6.1TD, RL1–RL5, Fibra, Móvil, Fibra + móvil. 59 telefonías sin tarifa → se infiere del nombre de producto. |
| Producto * | `producto` | texto | 1 | 138 nombres comerciales. |
| CUPS * | `cups` | texto | 132 | 20 caracteres. Vacío solo en telefonía. |
| Consumo | `consumo` | número | 1.009 | **Unidad no indicada**. Medianas: luz 3.064, gas 4.530 → compatible con **kWh/año**. Se muestra como "kWh/año (supuesto)" hasta confirmarlo en Configuración. |
| Potencia | `potencia` | número | 1.307 | kW. Solo luz (1 gas). |
| Fecha carterización | `fCarterizacion` | fecha dd/mm/aaaa (texto) | 670 | **Idéntica a Fecha tramitación en el 100 % de filas**. |
| Comisión venta | `comisionVenta` | € | 2.324 | 493 importes, media 70 €. |
| Comisión subdominio | `comisionSubdominio` | € | 1.103 | 1.714 importes, media 181 €. 489 filas tienen ambas y solo 5 son iguales → parecen **conceptos distintos**. Modo de cálculo del total configurable. |
| Estado | `estado` | catálogo | 0 | Comisionado 1.104 · Pendiente 749 · Tramitado 495 · Activado 232 · Firmado 169 · Baja 50 · Pendiente de activación 14 · Anulado 2 · Incidencia 1 · Borrador 1. |
| Fecha activación | `fActivacion` | fecha | 2.129 | 688 con fecha: 384 de ellas en estado *Comisionado* → "activado" como estado ≠ "con fecha de activación". |
| Fecha de baja | `fBaja` | fecha | 2.762 | 55 con fecha (5 en estados distintos de Baja → inconsistencia). |
| Observaciones | `observaciones` | texto libre | 1.586 | |
| Alta nueva / Cambio de potencia / Cambio titularidad / Batería Virtual / Cambio comercializadora | `flags.*` | Si/No | 0 | |
| P1–P6 | `pPeriodo[]` | número | ~2.755 | Hay decimales con coma (`5,7`). |
| Potencia actual / solicitada | | número | 2.776 | Cambios de potencia. |
| Fecha  tramitación (doble espacio) | `fTramitacion` | fecha | 670 | **Fecha comercial de alta**. 663 de las vacías son *Pendiente*. Rango 18/07/2023 – 23/10/2026. |
| Fecha traspaso | `fTraspaso` | fecha | 0 | Rango 15/05/2025 – 26/10/2026; 1.834 en 2025. Parece la fecha de registro/traspaso al CRM, **no** una fecha comercial. |
| Usuario propietario ( email ) | `owners[]` | email(s) | 0 | 29 valores; 10 filas tienen **dos correos separados por coma** (propiedad compartida). info@assessoria30.com = 2.222 filas. |
| Tarifa gas / Producto gas / CUPS gas / Consumo gas | — | — | 2.817 | **Columnas siempre vacías** (previstas para contratos duales). Se mapean si en el futuro llegan datos. |
| Nº teléfono / Correo electrónico | `telefono`, `email` | texto | 1 | **Sensibles.** |
| P1–P6 contratada | `pContratada[]` | kW | 1.323–2.557 | |

## Hoja `Listas`

Catálogos: tipos de producto (10), tarifas luz (2.0TD/3.0TD/6.1TD), tarifas gas (RL1–RL6), telefonía (Fibra, Movil, Fibra + movil), tarifas autoconsumo y una tabla `Producto → Regla` (LUZ/GAS/DUAL/TELEFONIA/AUTOCONSUMO/NINGUNA). La app la usa para reconocer el tipo de producto si aparece en futuras exportaciones.

## Decisiones de modelado

- **Sin identificador de contrato** en la exportación. Clave de deduplicación por defecto: `CIF normalizado + CUPS + tipo + comercializadora + tarifa + producto` + nº de aparición dentro del archivo. Reimportar el mismo archivo da exactamente las mismas claves (0 duplicados); 21 filas comparten clave base dentro del archivo (incluidas 2 filas idénticas) y se conservan marcadas como *posible duplicado*. Los campos de la clave son configurables.
- **Fechas**: se guardan como `AAAA-MM-DD`; acepta texto dd/mm/aaaa, serial Excel y ISO. Nunca se descarta un registro por fecha inválida: se marca la incidencia.
- **Altas comerciales** = fecha de tramitación (igual a carterización). **Activaciones** = fecha de activación. **Bajas** = fecha de baja. La fecha usada por los filtros es configurable.
- **Activado (estado)** ≠ **con fecha de activación** ≠ **firmado** ≠ **comisionado**: todas se muestran por separado.
- **Comisiones**: importes *registrados*; nunca se interpretan como cobrados.
- **Consumo**: sumado por separado para luz y gas. Telefonía se excluye.
