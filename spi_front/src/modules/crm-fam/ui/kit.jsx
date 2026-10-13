// Kit de interfaz del CRM, construido sobre los roles semánticos de DESIGN.md (clases fam-*).
// Reglas que encarna: radios por función (6px etiqueta, 8px control, 12px panel), paneles planos
// sin sombra, una acción primaria por zona, foco visible y estados que no dependen solo del color.
import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FiAlertCircle, FiArrowDown, FiArrowUp, FiChevronDown, FiSearch, FiX } from "react-icons/fi";
import Modal from "../../../core/ui/components/Modal";

export const cx = (...parts) => parts.filter(Boolean).join(" ");

// ─── Botón ───────────────────────────────────────────────────────────────────
const BTN_VARIANT = {
  primary: "bg-fam-action text-fam-on-action hover:bg-fam-action-hover",
  secondary: "border border-fam-control bg-fam-surface text-fam-text hover:bg-fam-subtle",
  ghost: "text-fam-muted hover:bg-fam-subtle hover:text-fam-text",
  danger: "bg-fam-danger-solid text-white hover:opacity-90",
  link: "text-fam-action underline underline-offset-2 hover:text-fam-action-hover",
};
const BTN_SIZE = {
  md: "min-h-[36px] px-3.5 text-sm",
  sm: "min-h-[32px] px-2.5 text-[13px]",
};

export function Btn({ variant = "secondary", size = "md", icon: Icon, to, loading = false, disabled, className, children, ...rest }) {
  const cls = cx(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-100",
    "disabled:cursor-not-allowed disabled:opacity-60",
    variant === "link" ? "text-sm" : BTN_SIZE[size] || BTN_SIZE.md,
    BTN_VARIANT[variant] || BTN_VARIANT.secondary,
    className,
  );
  const content = (
    <>
      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
      {children}
    </>
  );
  if (to) return <Link to={to} className={cls} {...rest}>{content}</Link>;
  return (
    <button type="button" className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  );
}

// Botón solo-icono con nombre accesible obligatorio.
export function IconBtn({ icon: Icon, label, className, ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-fam-muted transition-colors duration-100 hover:bg-fam-subtle hover:text-fam-text disabled:opacity-50", className)}
      {...rest}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

// ─── Badge de estado ─────────────────────────────────────────────────────────
const BADGE_TONE = {
  neutral: "bg-fam-subtle text-fam-muted",
  info: "bg-fam-info-bg text-fam-info",
  success: "bg-fam-success-bg text-fam-success",
  warning: "bg-fam-warning-bg text-fam-warning",
  danger: "bg-fam-danger-bg text-fam-danger",
};

export function Badge({ tone = "neutral", children, className }) {
  return (
    <span className={cx("inline-flex max-w-full items-center truncate rounded-md px-[7px] py-0.5 text-xs font-medium", BADGE_TONE[tone] || BADGE_TONE.neutral, className)}>
      {children}
    </span>
  );
}

// Badge a partir de un resolvedor de status.js: <StatusBadge of={leadStatus} value={lead.status} />
export function StatusBadge({ of: resolve, value }) {
  const s = resolve(value);
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

// ─── Estructura de página ────────────────────────────────────────────────────
// Cabecera abierta sobre el lienzo (sin tarjeta): contexto arriba; título, vistas y acciones debajo.
export function PageHeader({ title, count, context, actions, children }) {
  return (
    <header className="mb-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {context && <div className="mb-1 text-[13px] text-fam-muted">{context}</div>}
          <h1 className="text-2xl font-semibold tracking-tight text-fam-text">
            {title}
            {count !== undefined && count !== null && <span className="fam-numeric ml-2 text-base font-normal text-fam-muted">{count}</span>}
          </h1>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </header>
  );
}

export function Panel({ title, hint, actions, children, flush = false, className, as: Tag = "section" }) {
  return (
    <Tag className={cx("rounded-xl border border-fam-border bg-fam-surface", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-fam-border px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-fam-text">{title}</h2>}
            {hint && <p className="text-[13px] text-fam-muted">{hint}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={flush ? "" : "p-4 sm:p-5"}>{children}</div>
    </Tag>
  );
}

// Franja de indicadores: sin tarjetas ni iconos decorativos; cada uno puede llevar al detalle.
export function StatStrip({ items, className, plain = false }) {
  return (
    <div className={className}>
    <dl className={cx("mb-0 grid grid-cols-2 gap-x-6 gap-y-4 sm:flex sm:flex-wrap sm:gap-x-10", !plain && "border-b border-fam-border pb-4")}>
      {items.map((it) => {
        const body = (
          <>
            <dt className="text-[13px] font-normal text-fam-muted">{it.label}</dt>
            <dd className={cx("fam-numeric mb-0 text-2xl font-semibold tracking-tight", it.tone === "danger" ? "text-fam-danger" : "text-fam-text")}>{it.value}</dd>
            {it.hint && <dd className="mb-0 text-xs text-fam-muted">{it.hint}</dd>}
          </>
        );
        return it.to
          ? <Link key={it.label} to={it.to} className="-m-1 block rounded-lg p-1 transition-colors duration-100 hover:bg-fam-subtle">{body}</Link>
          : <div key={it.label}>{body}</div>;
      })}
    </dl>
    </div>
  );
}

// ─── Vistas / pestañas ───────────────────────────────────────────────────────
export function Tabs({ tabs, value, onChange, label = "Vistas" }) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-x-1 border-b border-fam-border">
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cx(
              "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors duration-100",
              active ? "border-fam-action font-semibold text-fam-text" : "border-transparent text-fam-muted hover:text-fam-text",
            )}
          >
            {t.label}
            {t.count !== undefined && t.count !== null && (
              <span className={cx("fam-numeric rounded-md px-1.5 text-xs", active ? "bg-fam-selected text-fam-info" : "bg-fam-subtle text-fam-muted")}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Campos ──────────────────────────────────────────────────────────────────
const CONTROL = "w-full rounded-lg border border-fam-control bg-fam-surface px-3 text-sm text-fam-text placeholder:text-fam-muted disabled:bg-fam-subtle disabled:text-fam-muted min-h-[var(--control-height)]";

export function Field({ label, hint, error, optional, children }) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-[13px] font-medium text-fam-text">
        {label}{optional && <span className="ml-1 font-normal text-fam-muted">(opcional)</span>}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-fam-muted">{hint}</p>}
      {error && <p id={`${id}-err`} className="mt-1 text-xs text-fam-danger">{error}</p>}
    </div>
  );
}

export const TextInput = ({ className, ...props }) => <input className={cx(CONTROL, className)} {...props} />;
export const TextArea = ({ className, rows = 3, ...props }) => <textarea rows={rows} className={cx(CONTROL, "py-2 leading-relaxed", className)} {...props} />;
export function SelectInput({ className, children, ...props }) {
  return (
    <div className="relative">
      <select className={cx(CONTROL, "appearance-none pr-8", className)} {...props}>{children}</select>
      <FiChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fam-muted" aria-hidden="true" />
    </div>
  );
}

// El icono va fuera del <input> (el contenedor es el control): una regla global fija con !important
// el padding de los inputs, así que no se puede reservar espacio dentro del campo.
export function SearchInput({ value, onChange, placeholder = "Buscar…", label = "Buscar", className }) {
  return (
    <div className={cx("flex min-h-[var(--control-height)] items-center rounded-lg border border-fam-control bg-fam-surface pl-3 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--focus)]", className)}>
      <FiSearch className="h-4 w-4 shrink-0 text-fam-muted" aria-hidden="true" />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-fam-text outline-none placeholder:text-fam-muted focus:border-0 focus:outline-none focus:ring-0"
      />
    </div>
  );
}

// Filtro activo, removible (se distingue de un badge informativo por su botón).
export function FilterChip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-fam-border bg-fam-surface py-0.5 pl-2.5 pr-1 text-[13px] text-fam-text">
      {label}
      <button type="button" onClick={onRemove} aria-label={`Quitar filtro ${label}`} className="inline-flex h-5 w-5 items-center justify-center rounded-full text-fam-muted hover:bg-fam-subtle hover:text-fam-text">
        <FiX className="h-3 w-3" aria-hidden="true" />
      </button>
    </span>
  );
}

// ─── Estados: carga, vacío, error ────────────────────────────────────────────
export function Skeleton({ className }) {
  return <div className={cx("animate-pulse rounded-md bg-fam-subtle", className)} aria-hidden="true" />;
}

export function SkeletonRows({ rows = 6 }) {
  return (
    <div className="divide-y divide-fam-border" role="status" aria-label="Cargando">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="hidden h-4 w-1/5 sm:block" />
          <Skeleton className="ml-auto h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

// Distingue "aún no hay registros" de "los filtros no coinciden": cada uno con su acción.
export function EmptyState({ title, hint, action }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-base font-semibold text-fam-text">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-md text-sm text-fam-muted">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorNote({ message, onRetry, className }) {
  if (!message) return null;
  return (
    <div role="alert" className={cx("flex flex-wrap items-center gap-3 rounded-lg bg-fam-danger-bg px-4 py-3 text-sm text-fam-danger", className)}>
      <FiAlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{message}</span>
      {onRetry && <Btn size="sm" onClick={onRetry}>Reintentar</Btn>}
    </div>
  );
}

// ─── Tabla ───────────────────────────────────────────────────────────────────
// columns: [{ key, header, align: "right", sortable, render(row), className, hideBelow: "sm"|"md"|"lg" }]
// La celda principal debe traer su propio botón/enlace; el click en la fila es solo un atajo.
const HIDE = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell", xl: "hidden xl:table-cell" };

export function DataTable({ columns, rows, rowKey = "id", sort, onSort, selectedId, onRowClick, selection, caption }) {
  const allSelected = selection && rows.length > 0 && rows.every((r) => selection.ids.has(r[rowKey]));
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-fam-border text-left">
            {selection && (
              <th scope="col" className="w-10 px-4 py-2.5">
                <input type="checkbox" aria-label="Seleccionar todo" checked={allSelected} onChange={() => selection.onToggleAll(rows, !allSelected)} />
              </th>
            )}
            {columns.map((c) => {
              const active = sort?.key === c.key;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={c.sortable ? (active ? (sort.dir === "asc" ? "ascending" : "descending") : "none") : undefined}
                  className={cx("whitespace-nowrap px-4 py-2.5 text-[13px] font-medium text-fam-muted", c.align === "right" && "text-right", c.hideBelow && HIDE[c.hideBelow])}
                >
                  {c.sortable ? (
                    <button type="button" onClick={() => onSort(c.key)} className={cx("inline-flex items-center gap-1 rounded hover:text-fam-text", active && "text-fam-text")}>
                      {c.header}
                      {active && (sort.dir === "asc" ? <FiArrowUp className="h-3 w-3" aria-hidden="true" /> : <FiArrowDown className="h-3 w-3" aria-hidden="true" />)}
                    </button>
                  ) : c.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = row[rowKey];
            const selected = selectedId === id || selection?.ids.has(id);
            return (
              <tr
                key={id}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                aria-selected={selectedId === id || undefined}
                className={cx(
                  "border-b border-fam-border last:border-0",
                  onRowClick && "cursor-pointer",
                  selected ? "bg-fam-selected" : "hover:bg-fam-subtle",
                )}
                style={{ height: "var(--row-height)" }}
              >
                {selection && (
                  <td className="px-4" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" aria-label="Seleccionar fila" checked={selection.ids.has(id)} onChange={() => selection.onToggle(id)} />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.key} className={cx("px-4 py-2 text-fam-text", c.align === "right" && "fam-numeric text-right", c.hideBelow && HIDE[c.hideBelow], c.className)}>
                    {c.render ? c.render(row) : (row[c.key] ?? "—")}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Orden en cliente sobre las filas cargadas. accessor opcional por columna.
export function sortRows(rows, sort, accessors = {}) {
  if (!sort?.key) return rows;
  const get = accessors[sort.key] || ((r) => r[sort.key]);
  const dir = sort.dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = get(a), y = get(b);
    if (x === null || x === undefined || x === "") return 1;
    if (y === null || y === undefined || y === "") return -1;
    if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
    return String(x).localeCompare(String(y), "es", { numeric: true, sensitivity: "base" }) * dir;
  });
}

// ─── Inspector contextual ────────────────────────────────────────────────────
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => (typeof window !== "undefined" ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return matches;
}

// Panel de detalle junto a la lista (≥1280px); en pantallas menores se abre como diálogo del sistema.
// No es navegación: conserva filtros, selección y posición de la lista (DESIGN.md §9).
export function Inspector({ open, title, onClose, children, footer }) {
  const wide = useMediaQuery("(min-width: 1280px)");
  if (!open) return null;
  if (!wide) {
    return (
      <Modal open title={title} onClose={onClose} closeOnBackdrop maxWidth="max-w-xl">
        {children}
        {footer && <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-fam-border pt-4">{footer}</div>}
      </Modal>
    );
  }
  return (
    <aside aria-label={title} className="sticky top-4 flex max-h-[calc(100dvh-2rem)] flex-col rounded-xl border border-fam-border bg-fam-surface">
      <div className="flex items-start justify-between gap-3 border-b border-fam-border px-5 py-3">
        <h2 className="min-w-0 text-base font-semibold text-fam-text">{title}</h2>
        <IconBtn icon={FiX} label="Cerrar detalle" onClick={onClose} className="-mr-2 -mt-1" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-fam-border px-5 py-3">{footer}</div>}
    </aside>
  );
}

// Par etiqueta/valor para paneles de detalle.
export function DefList({ items, columns = 1 }) {
  return (
    <dl className={cx("mb-0 grid gap-x-6 gap-y-3", columns === 2 && "sm:grid-cols-2")}>
      {items.filter(Boolean).map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-[13px] font-normal text-fam-muted">{it.label}</dt>
          <dd className={cx("mb-0 break-words text-sm text-fam-text", it.numeric && "fam-numeric")}>{it.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

// ─── Menú desplegable (disclosure accesible) ─────────────────────────────────
export function Menu({ label, icon: Icon, items, align = "right", variant = "secondary", size = "md" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") { setOpen(false); ref.current?.querySelector("button")?.focus(); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Btn variant={variant} size={size} icon={Icon} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((v) => !v)}>
        {label}
        <FiChevronDown className={cx("h-4 w-4 transition-transform duration-100", open && "rotate-180")} aria-hidden="true" />
      </Btn>
      {open && (
        <ul className={cx("absolute z-20 mt-1 min-w-[200px] rounded-xl border border-fam-border bg-fam-raised p-1 shadow-[var(--shadow-popover)]", align === "right" ? "right-0" : "left-0")}>
          {items.filter(Boolean).map((it) => (
            <li key={it.label}>
              <button
                type="button"
                disabled={it.disabled}
                onClick={() => { setOpen(false); it.onSelect(); }}
                className={cx("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-fam-subtle disabled:opacity-50", it.danger ? "text-fam-danger" : "text-fam-text")}
              >
                {it.icon && <it.icon className="h-4 w-4 shrink-0 text-fam-muted" aria-hidden="true" />}
                {it.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
