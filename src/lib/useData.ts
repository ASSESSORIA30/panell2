"use client";
import { useMemo } from "react";
import { useStore } from "./store";
import { applyFilters, countBy, ranked, referenceDate } from "./metrics";
import { chartTokens, entityColorMap } from "./palette";

/** Datos filtrados + contexto compartido por todos los módulos. */
export function useData() {
  const contracts = useStore((s) => s.contracts);
  const filters = useStore((s) => s.filters);
  const settings = useStore((s) => s.settings);
  const hydrated = useStore((s) => s.hydrated);

  const ref = useMemo(() => referenceDate(contracts, settings), [contracts, settings]);
  const rows = useMemo(() => applyFilters(contracts, filters, settings.dateBasis), [contracts, filters, settings.dateBasis]);
  const tokens = useMemo(() => chartTokens(settings.theme), [settings.theme]);
  const comColors = useMemo(() => {
    const order = ranked(countBy(contracts, (c) => c.comercializadora)).map((r) => r.key);
    return entityColorMap(order, settings.theme);
  }, [contracts, settings.theme]);
  const byId = useMemo(() => new Map(contracts.map((c) => [c.id, c])), [contracts]);

  return { all: contracts, rows, filters, settings, ref, tokens, comColors, byId, hydrated, empty: hydrated && contracts.length === 0 };
}
