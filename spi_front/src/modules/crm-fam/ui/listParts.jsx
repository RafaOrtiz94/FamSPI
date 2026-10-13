// Piezas de bandeja que acompañan a la tabla: paginación, barra de acciones masivas y selección.
import { useCallback, useMemo, useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { Btn, IconBtn } from "./kit";
import { number } from "./format";

// Paginación de servidor: informa el rango y conserva el desplazamiento en quien la usa (URL).
export function Pagination({ offset, limit, total, shown, onChange }) {
  if (total <= limit && offset === 0) return null;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + (shown ?? limit), total);
  return (
    <nav aria-label="Paginación" className="flex items-center justify-between gap-3 border-t border-fam-border px-4 py-2.5">
      <p className="fam-numeric text-[13px] text-fam-muted">{number(from)}–{number(to)} de {number(total)}</p>
      <div className="flex gap-1">
        <IconBtn icon={FiChevronLeft} label="Página anterior" disabled={offset <= 0} onClick={() => onChange(Math.max(0, offset - limit))} />
        <IconBtn icon={FiChevronRight} label="Página siguiente" disabled={offset + limit >= total} onClick={() => onChange(offset + limit)} />
      </div>
    </nav>
  );
}

// Aparece solo al seleccionar filas (DESIGN.md §8). Las acciones van como hijos.
export function BulkBar({ count, onClear, children }) {
  if (!count) return null;
  return (
    <div role="region" aria-label="Acciones para la selección" className="flex flex-wrap items-center gap-2 border-b border-fam-border bg-fam-selected px-4 py-2">
      <p className="mr-2 text-sm font-medium text-fam-text"><span className="fam-numeric">{number(count)}</span> seleccionado{count === 1 ? "" : "s"}</p>
      {children}
      <Btn variant="ghost" size="sm" onClick={onClear} className="ml-auto">Quitar selección</Btn>
    </div>
  );
}

// Estado de selección para DataTable: { ids, onToggle, onToggleAll } + utilidades.
export function useSelection() {
  const [ids, setIds] = useState(() => new Set());
  const onToggle = useCallback((id) => setIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  }), []);
  const onToggleAll = useCallback((rows, select) => setIds((prev) => {
    const next = new Set(prev);
    rows.forEach((r) => (select ? next.add(r.id) : next.delete(r.id)));
    return next;
  }), []);
  const clear = useCallback(() => setIds(new Set()), []);
  return useMemo(() => ({ ids, onToggle, onToggleAll, clear }), [ids, onToggle, onToggleAll, clear]);
}

// Ejecuta una acción sobre varios registros, uno por uno, y resume cuántos salieron bien.
export async function runBulk(items, action) {
  const results = await Promise.allSettled(items.map((it) => action(it)));
  const failed = results.filter((r) => r.status === "rejected").length;
  return { ok: items.length - failed, failed };
}
