import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiChevronLeft, FiChevronRight, FiZoomIn, FiZoomOut } from "react-icons/fi";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

const BASE_SCALE = 1.4;
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.25;

// Fase 1 del plan de mejoras de firma: en listados densos (20-30 filas) es
// facil clicar la fila de al lado sin zoom -- este control es la mitigacion
// mas simple y de menor riesgo para ese error real reportado por usuarios.
export default function PdfSignerViewer({
  pdfArrayBuffer,
  signatureB64,
  placement,
  onPlacement,
  readOnly = false,
  highlight = null,
  candidates = null,
  onSelectCandidate,
}) {
  const [pdf, setPdf] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [rendering, setRendering] = useState(false);
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);

  const scale = BASE_SCALE * zoom;

  useEffect(() => {
    if (!pdfArrayBuffer) return;
    let cancelled = false;
    pdfjsLib.getDocument({ data: pdfArrayBuffer.slice(0) }).promise.then((doc) => {
      if (cancelled) return;
      setPdf(doc);
      setTotalPages(doc.numPages);
      setCurrentPage(1);
    });
    return () => { cancelled = true; };
  }, [pdfArrayBuffer]);

  // Si llega un placement/highlight en otra pagina (ej. deteccion automatica
  // en la pagina 3 de un documento de 5), saltamos ahi solos -- el firmante
  // no deberia tener que adivinar en que pagina buscar.
  useEffect(() => {
    const targetPage = highlight?.page_number || placement?.page_number;
    if (targetPage && targetPage !== currentPage && targetPage >= 1 && (!totalPages || targetPage <= totalPages)) {
      setCurrentPage(targetPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight?.page_number]);

  const renderPage = useCallback(async (pageNum) => {
    if (!pdf || !canvasRef.current) return;
    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch {}
    }
    setRendering(true);
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const task = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      await task.promise;
    } catch (err) {
      if (err?.name !== "RenderingCancelledException") console.error("PDF render:", err);
    } finally {
      setRendering(false);
    }
  }, [pdf, scale]);

  useEffect(() => { renderPage(currentPage); }, [pdf, currentPage, renderPage]);

  const handleCanvasClick = (e) => {
    if (readOnly || typeof onPlacement !== "function") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x_pct = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0.01), 0.99);
    const y_pct = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0.01), 0.99);
    onPlacement({ page_number: currentPage, x_pct, y_pct });
  };

  const isPlacedOnThisPage = placement && placement.page_number === currentPage;
  const isHighlightOnThisPage = highlight && highlight.page_number === currentPage;
  const pageCandidates = useMemo(
    () => (Array.isArray(candidates) ? candidates.filter((c) => c.page_number === currentPage) : []),
    [candidates, currentPage],
  );

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1 || rendering || !pdf}
            className="cursor-pointer rounded-xl border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <FiChevronLeft size={13} />
          </button>
          <span className="text-xs text-slate-500 tabular-nums">
            {currentPage} / {totalPages || "—"}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || rendering || !pdf}
            className="cursor-pointer rounded-xl border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <FiChevronRight size={13} />
          </button>
          <div className="ml-1.5 flex items-center gap-1 border-l border-slate-200 pl-1.5">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)))}
              disabled={zoom <= MIN_ZOOM || rendering || !pdf}
              title="Alejar"
              className="cursor-pointer rounded-xl border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <FiZoomOut size={13} />
            </button>
            <span className="w-9 text-center text-[11px] tabular-nums text-slate-500">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)))}
              disabled={zoom >= MAX_ZOOM || rendering || !pdf}
              title="Acercar"
              className="cursor-pointer rounded-xl border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <FiZoomIn size={13} />
            </button>
          </div>
        </div>
        <span className="min-w-0 text-right text-[11px] text-slate-400 italic">
          {readOnly ? "Vista del documento" : (
            isPlacedOnThisPage ? "Firma ubicada - haz clic para mover" : "Haz clic en el documento para ubicar tu firma"
          )}
        </span>
      </div>

      <div
        className="relative max-w-full overflow-auto rounded-xl border border-slate-200 bg-slate-100 shadow-inner"
        style={{ maxHeight: "min(62vh, 620px)", cursor: readOnly ? "default" : "crosshair" }}
      >
        {rendering && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          </div>
        )}
        {!pdf && !rendering && (
          <div className="flex h-40 items-center justify-center text-sm text-slate-400">
            Cargando documento…
          </div>
        )}
        <div className="relative inline-block w-full">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            style={{ display: "block", width: "100%", height: "auto" }}
          />
          {/* Resalta la fila que la deteccion automatica identifico, para que el
              firmante CONFIRME visualmente "esta es mi fila" en vez de confiar
              a ciegas en el sello ya puesto (ver signatureAutoPlacement.service.js). */}
          {isHighlightOnThisPage && (
            <div
              style={{
                position: "absolute",
                left: `${highlight.x_min_pct * 100}%`,
                top: `${highlight.y_pct * 100}%`,
                width: `${Math.max(0, (highlight.x_max_pct - highlight.x_min_pct) * 100)}%`,
                height: `${highlight.height_pct * 100}%`,
                background: "rgba(16,185,129,0.12)",
                border: "1.5px dashed rgba(16,185,129,0.65)",
                borderRadius: 4,
                pointerEvents: "none",
              }}
            />
          )}
          {isPlacedOnThisPage && signatureB64 && (
            <img
              src={signatureB64}
              alt="Firma"
              draggable={false}
              style={{
                position: "absolute",
                left: `${placement.x_pct * 100}%`,
                top: `${placement.y_pct * 100}%`,
                transform: "translate(-50%, -50%)",
                maxHeight: 32,
                pointerEvents: "none",
                opacity: 0.85,
                border: "1.5px dashed #1e3a5f",
                borderRadius: 4,
                background: "rgba(255,255,255,0.78)",
                padding: "2px 8px",
              }}
            />
          )}
          {/* Filas candidatas cuando el nombre matcheo mas de una linea (ej.
              nombre repetido en el listado) -- el firmante elige entre pocas
              opciones en vez de buscar a ciegas en todo el documento. */}
          {!readOnly && pageCandidates.map((c, idx) => (
            <button
              key={`${c.x_pct}-${c.y_pct}-${idx}`}
              type="button"
              onClick={() => onSelectCandidate && onSelectCandidate(c)}
              title={c.line_preview || `Candidata ${idx + 1}`}
              style={{
                position: "absolute",
                left: `${c.highlight ? c.highlight.x_min_pct * 100 : c.x_pct * 100}%`,
                top: `${c.highlight ? c.highlight.y_pct * 100 : c.y_pct * 100}%`,
                width: c.highlight ? `${Math.max(0, (c.highlight.x_max_pct - c.highlight.x_min_pct) * 100)}%` : "auto",
                height: c.highlight ? `${c.highlight.height_pct * 100}%` : "auto",
                background: "rgba(37,99,235,0.10)",
                border: "1.5px dashed rgba(37,99,235,0.6)",
                borderRadius: 4,
                cursor: "pointer",
              }}
            />
          ))}
        </div>
      </div>

      {!readOnly && (isPlacedOnThisPage ? (
        <p className="text-[11px] font-medium text-green-700">
          Firma posicionada en página {placement.page_number}
        </p>
      ) : placement ? (
        <p className="text-[11px] text-slate-400">
          Firma en página {placement.page_number} — navega a esa página para verla
        </p>
      ) : (
        <p className="text-[11px] text-amber-600 font-medium">
          Debes ubicar tu firma antes de firmar
        </p>
      ))}
    </div>
  );
}
