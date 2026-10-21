/**
 * WorkflowStep
 *
 * Envuelve un bloque de acción dentro de un tab y le asigna uno de cuatro estados:
 *   • completed — ya fue realizado; encabezado verde, contenido colapsado y opaco
 *   • active    — es el paso del usuario actual; borde azul, contenido siempre visible
 *   • waiting   — es el paso de otro rol; borde ámbar, contenido visible pero sin acciones propias
 *   • pending   — prerrequisitos incompletos; gris, sin contenido
 *
 * Props:
 *   stepNumber      int      — número visible del paso (1, 2, 3…)
 *   title           string   — etiqueta del paso
 *   actor           string   — rol responsable (ej. "Jefe Técnico")
 *   status          string   — 'completed' | 'active' | 'waiting' | 'pending'
 *   completedAt     string   — ISO timestamp opcional; se muestra formateado
 *   children        node     — contenido del paso (formularios, FileUploadZone, etc.)
 *   defaultExpanded bool     — si el paso completado comienza expandido (default false)
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCheck, FiCheckCircle, FiChevronDown, FiClock, FiLock } from 'react-icons/fi';

const EASE = [0.23, 1, 0.32, 1];

const formatTS = (iso) => {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat('es-EC', {
      day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return null;
  }
};

const WorkflowStep = ({
  stepNumber,
  title,
  actor,
  status = 'pending',   // 'completed' | 'active' | 'waiting' | 'pending'
  completedAt,
  children,
  defaultExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const isDone    = status === 'completed';
  const isActive  = status === 'active';
  const isWaiting = status === 'waiting';
  const isPending = status === 'pending';

  const ts = formatTS(completedAt);

  /* ─── contenedor externo ─────────────────────────────────────────── */
  const containerClass = [
    'rounded-xl border transition-all duration-200 overflow-hidden',
    isDone    ? 'bg-slate-50 border-slate-200'
    : isActive  ? 'bg-white border-action-blue shadow-[0_0_0_3px_rgba(59,130,246,0.08)] shadow-ambient'
    : isWaiting ? 'bg-amber-50/60 border-caution-amber shadow-[0_0_0_2px_rgba(217,119,6,0.06)]'
    : /* pending */ 'bg-slate-50/70 border-slate-200 opacity-50',
  ].join(' ');

  /* ─── burbuja numérica ───────────────────────────────────────────── */
  const bubbleClass = [
    'w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-colors duration-200',
    isDone    ? 'bg-operative-green text-white'
    : isActive  ? 'bg-action-blue text-white'
    : isWaiting ? 'bg-caution-amber text-white'
    : /* pending */ 'bg-slate-300 text-slate-500',
  ].join(' ');

  const isExpandable = isDone || isWaiting;

  return (
    <div className={containerClass}>

      {/* ── Encabezado del paso ──────────────────────────────────────── */}
      <div
        role={isExpandable ? 'button' : undefined}
        tabIndex={isExpandable ? 0 : undefined}
        aria-expanded={isExpandable ? expanded : undefined}
        onClick={isExpandable ? () => setExpanded((v) => !v) : undefined}
        onKeyDown={isExpandable ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        } : undefined}
        className={[
          'flex items-center gap-3 px-5 py-3.5',
          isExpandable ? 'cursor-pointer select-none' : 'cursor-default',
        ].join(' ')}
      >
        {/* Burbuja */}
        <div className={bubbleClass}>
          {isDone ? <FiCheck size={13} /> : isWaiting ? <FiClock size={12} /> : stepNumber}
        </div>

        {/* Título + actor */}
        <div className="flex-1 min-w-0">
          <p className={[
            'text-sm font-semibold leading-tight',
            isDone    ? 'text-slate-400'
            : isActive  ? 'text-ink-slate'
            : isWaiting ? 'text-amber-800'
            : 'text-slate-400',
          ].join(' ')}>
            {title}
          </p>
          {actor && (
            <p className={`text-xs mt-0.5 ${isDone ? 'text-slate-400' : isWaiting ? 'text-amber-600' : 'text-warm-ash'}`}>
              {actor}
            </p>
          )}
        </div>

        {/* Badge de estado + flecha */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isDone ? (
            <>
              {ts && (
                <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">{ts}</span>
              )}
              <span className="inline-flex items-center gap-1 text-[11px] text-operative-green font-semibold px-2 py-0.5 rounded-full bg-green-50 border border-green-200">
                <FiCheckCircle size={10} /> Realizado
              </span>
              <FiChevronDown
                size={14}
                className={`text-slate-400 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
              />
            </>
          ) : isActive ? (
            <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full bg-action-blue/10 text-action-blue border border-action-blue/20">
              En curso
            </span>
          ) : isWaiting ? (
            <>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-caution-amber border border-amber-200">
                <FiClock size={10} /> Esperando
              </span>
              <FiChevronDown
                size={14}
                className={`text-amber-400 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
              />
            </>
          ) : (
            /* pending */
            <FiLock size={12} className="text-slate-400 mr-0.5" />
          )}
        </div>
      </div>

      {/* ── Contenido del paso ───────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {(isActive || (isExpandable && expanded)) && (
          <motion.div
            key="step-body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="overflow-hidden"
          >
            <div className={[
              'px-5 pb-5 border-t',
              isDone    ? 'border-slate-100 opacity-60'
              : isWaiting ? 'border-amber-100'
              : 'border-slate-100',
            ].join(' ')}>
              {/* Banner "en manos de otro rol" para waiting */}
              {isWaiting && (
                <div className="mt-3 mb-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <FiClock size={12} className="shrink-0 text-caution-amber" />
                  <span>
                    Este paso está en manos de <strong>{actor}</strong>. Podés seguir el avance aquí.
                  </span>
                </div>
              )}
              <div className="mt-4">
                {children}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mensaje de paso pendiente ─────────────────────────────────── */}
      {isPending && (
        <div className="px-5 pb-3.5">
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <FiLock size={11} />
            Disponible cuando los pasos anteriores estén completados
          </p>
        </div>
      )}
    </div>
  );
};

export default WorkflowStep;
