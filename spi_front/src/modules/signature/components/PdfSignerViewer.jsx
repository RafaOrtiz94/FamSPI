import React, { useCallback, useEffect, useRef, useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

const SCALE = 1.4;

export default function PdfSignerViewer({ pdfArrayBuffer, signatureB64, placement, onPlacement }) {
  const [pdf, setPdf] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [rendering, setRendering] = useState(false);
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);

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

  const renderPage = useCallback(async (pageNum) => {
    if (!pdf || !canvasRef.current) return;
    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch {}
    }
    setRendering(true);
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: SCALE });
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
  }, [pdf]);

  useEffect(() => { renderPage(currentPage); }, [pdf, currentPage, renderPage]);

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x_pct = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0.01), 0.99);
    const y_pct = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0.01), 0.99);
    onPlacement({ page_number: currentPage, x_pct, y_pct });
  };

  const isPlacedOnThisPage = placement && placement.page_number === currentPage;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
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
        </div>
        <span className="text-[11px] text-slate-400 italic">
          {isPlacedOnThisPage
            ? "Firma ubicada — haz clic para mover"
            : "Haz clic en el documento para ubicar tu firma"}
        </span>
      </div>

      <div className="relative overflow-auto rounded-xl border border-slate-200 bg-slate-100 shadow-inner" style={{ maxHeight: 560, cursor: "crosshair" }}>
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
        </div>
      </div>

      {isPlacedOnThisPage ? (
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
      )}
    </div>
  );
}
