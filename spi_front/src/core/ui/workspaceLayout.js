/**
 * FamSPI — Norma de layout para workspaces operativos
 *
 * Problema raíz que esta norma previene:
 *   `h-screen overflow-hidden` dentro de DashboardLayout (que ya provee
 *   `flex-1 overflow-y-auto`) crea doble scroll. Los tres síntomas
 *   más comunes son scroll doble, contenido cortado en mobile y overflow
 *   horizontal no controlado.
 *
 * Regla de uso:
 *   1. Importa la clase correspondiente según el tipo de workspace.
 *   2. Aplícala al nodo raíz del componente, no a un wrapper interno.
 *   3. NUNCA añadas `h-screen`, `min-h-screen` ni `overflow-y-auto` al
 *      nodo raíz dentro de DashboardLayout — el layout ya los gestiona.
 *   4. Las columnas / paneles internos del workspace SÍ pueden tener
 *      `lg:overflow-y-auto` para scroll individual en desktop.
 */

/**
 * Workspace de página completa sin columnas (página simple).
 * Equivale al patrón incorrecto `min-h-screen bg-gray-50` que
 * usaban los CA0xxx workspaces.
 *
 * Uso:
 *   <div className={WORKSPACE_PAGE_CLASS}>...</div>
 */
export const WORKSPACE_PAGE_CLASS = "flex min-w-0 flex-col";

/**
 * Workspace con 3 paneles (sidebar — main — context panel).
 * Rompe el padding del contenedor DashboardLayout (sm:p-6) con
 * márgenes negativos para que los paneles extiendan hasta los
 * bordes del contenedor. En mobile apila los paneles verticalmente
 * con separadores de borde. En desktop activa el grid y fija la
 * altura al viewport disponible (evita doble scroll).
 *
 * Columnas sugeridas:
 *   sidebar  → col-span-12 lg:col-span-3
 *   main     → col-span-12 lg:col-span-6
 *   context  → col-span-12 lg:col-span-3
 *
 * Uso:
 *   <div className={WORKSPACE_3COL_CLASS}>
 *     <aside className={WORKSPACE_SIDEBAR_CLASS}>…</aside>
 *     <main  className={WORKSPACE_MAIN_CLASS}>…</main>
 *     <aside className={WORKSPACE_CONTEXT_CLASS}>…</aside>
 *   </div>
 */
export const WORKSPACE_3COL_CLASS =
  "flex min-w-0 flex-col sm:-mx-6 sm:-mb-6 sm:-mt-6 lg:grid lg:grid-cols-12 lg:h-[calc(100dvh-11rem)] lg:overflow-hidden";

/** Sidebar izquierdo del workspace de 3 columnas */
export const WORKSPACE_SIDEBAR_CLASS =
  "col-span-12 min-w-0 border-b border-slate-200 bg-white lg:col-span-3 lg:border-b-0 lg:border-r lg:overflow-y-auto";

/** Panel principal central del workspace de 3 columnas */
export const WORKSPACE_MAIN_CLASS =
  "col-span-12 min-w-0 bg-slate-50 lg:col-span-6 lg:overflow-y-auto";

/** Panel contextual derecho del workspace de 3 columnas */
export const WORKSPACE_CONTEXT_CLASS =
  "col-span-12 min-w-0 border-t border-slate-200 bg-white lg:col-span-3 lg:border-l lg:border-t-0 lg:overflow-y-auto";

/**
 * Workspace con 2 columnas (sidebar — main).
 * Para workspaces sin panel contextual derecho.
 *
 * Columnas sugeridas:
 *   sidebar → col-span-12 lg:col-span-4
 *   main    → col-span-12 lg:col-span-8
 */
export const WORKSPACE_2COL_CLASS =
  "flex min-w-0 flex-col sm:-mx-6 sm:-mb-6 sm:-mt-6 lg:grid lg:grid-cols-12 lg:h-[calc(100dvh-11rem)] lg:overflow-hidden";

/**
 * Padding interno estándar para paneles de workspace.
 * Usa p-4 en mobile, p-5 en desktop. Reemplaza el incorrecto
 * `p-6` fijo que generaba exceso visual en mobile.
 */
export const WORKSPACE_PANEL_PADDING = "p-4 lg:p-5";

/**
 * Norma para modales dentro de workspaces:
 *   - Siempre usar el componente Modal de core/ui/components/Modal.jsx
 *   - NUNCA crear divs fixed inset-0 ad-hoc (DIY modals)
 *   - El Modal ya maneja: z-index, backdrop, scroll único, safe areas,
 *     max-height con calc(92dvh), overscroll-contain
 *
 * Importar así:
 *   import Modal from '../../core/ui/components/Modal';
 */

/**
 * Norma para botones de acción en workspaces / widgets:
 *   - Usar Button de core/ui/components/Button.jsx con variant prop
 *   - Usar actionBtnClass para layout full-width
 *   - NUNCA sobrescribir bg-* en className (el variant lo gestiona)
 *
 * Importar así:
 *   import Button, { actionBtnClass } from '../../core/ui/components/Button';
 */
