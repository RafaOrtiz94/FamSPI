import React, { useEffect, useRef } from "react";

/**
 * FirmaDigital
 * - Dibuja con mouse/touch sobre un <canvas>.
 * - getBase64(): devuelve el PNG en base64 **sin prefijo** (solo la cadena).
 * - clear(): limpia el canvas.
 */
const FirmaDigital = React.forwardRef(({ height = 160, strokeWidth = 2 }, ref) => {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = "#111827";
    ctxRef.current = ctx;
  }, [height, strokeWidth]);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    if (e.touches) {
      const t = e.touches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e) => {
    drawing.current = true;
    last.current = getPos(e);
  };
  const move = (e) => {
    if (!drawing.current) return;
    const { x, y } = getPos(e);
    const ctx = ctxRef.current;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    last.current = { x, y };
  };
  const end = () => (drawing.current = false);

  React.useImperativeHandle(ref, () => ({
    clear: () => {
      const c = canvasRef.current;
      ctxRef.current.clearRect(0, 0, c.width, c.height);
    },
    getBase64: () => {
      const dataUrl = canvasRef.current.toDataURL("image/png");
      // quitar prefijo "data:image/png;base64,"
      return dataUrl.split(",")[1] || "";
    },
  }));

  return (
    <div className="w-full">
      <div
        className="border rounded-lg bg-white dark:bg-gray-900"
        style={{ height }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>
      <p className="text-xs text-gray-500 mt-1">Firma aquí (usa mouse o táctil)</p>
    </div>
  );
});

export default FirmaDigital;
