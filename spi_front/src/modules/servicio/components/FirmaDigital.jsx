import React, { useEffect, useRef } from "react";

/**
 * FirmaDigital
 * - Dibuja sobre canvas con pointer/touch/mouse.
 * - getBase64(): devuelve PNG base64 sin prefijo.
 * - clear(): limpia el canvas.
 */
const FirmaDigital = React.forwardRef(
  ({ height = 160, strokeWidth = 2, onSignatureCapture }, ref) => {
    const canvasRef = useRef(null);
    const ctxRef = useRef(null);
    const drawingRef = useRef(false);
    const hasStrokeRef = useRef(false);
    const pointerIdRef = useRef(null);
    const lastPointRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.offsetWidth || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;

      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = "#111827";
      ctxRef.current = ctx;
    }, [height, strokeWidth]);

    const getPoint = (clientX, clientY) => {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    };

    const startStroke = (clientX, clientY) => {
      drawingRef.current = true;
      lastPointRef.current = getPoint(clientX, clientY);
    };

    const moveStroke = (clientX, clientY) => {
      if (!drawingRef.current || !ctxRef.current) return;
      const point = getPoint(clientX, clientY);
      const ctx = ctxRef.current;
      ctx.beginPath();
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      lastPointRef.current = point;
      hasStrokeRef.current = true;
    };

    const getBase64Data = () => {
      const canvas = canvasRef.current;
      if (!canvas) return "";
      const dataUrl = canvas.toDataURL("image/png");
      return dataUrl.split(",")[1] || "";
    };

    const endStroke = () => {
      drawingRef.current = false;
      pointerIdRef.current = null;

      if (onSignatureCapture && hasStrokeRef.current) {
        const signatureData = getBase64Data();
        if (signatureData) onSignatureCapture(signatureData);
      }
    };

    const handlePointerDown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      pointerIdRef.current = e.pointerId;
      if (e.currentTarget.setPointerCapture) {
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      startStroke(e.clientX, e.clientY);
    };

    const handlePointerMove = (e) => {
      if (pointerIdRef.current !== null && e.pointerId !== pointerIdRef.current) return;
      e.preventDefault();
      moveStroke(e.clientX, e.clientY);
    };

    const handlePointerEnd = (e) => {
      if (pointerIdRef.current !== null && e.pointerId !== pointerIdRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      endStroke();
    };

    const handleMouseDown = (e) => {
      if (window.PointerEvent) return;
      e.preventDefault();
      startStroke(e.clientX, e.clientY);
    };

    const handleMouseMove = (e) => {
      if (window.PointerEvent) return;
      e.preventDefault();
      moveStroke(e.clientX, e.clientY);
    };

    const handleMouseEnd = (e) => {
      if (window.PointerEvent) return;
      e.preventDefault();
      endStroke();
    };

    const handleTouchStart = (e) => {
      if (window.PointerEvent) return;
      if (!e.touches || !e.touches.length) return;
      e.preventDefault();
      e.stopPropagation();
      const t = e.touches[0];
      startStroke(t.clientX, t.clientY);
    };

    const handleTouchMove = (e) => {
      if (window.PointerEvent) return;
      if (!e.touches || !e.touches.length) return;
      e.preventDefault();
      const t = e.touches[0];
      moveStroke(t.clientX, t.clientY);
    };

    const handleTouchEnd = (e) => {
      if (window.PointerEvent) return;
      e.preventDefault();
      e.stopPropagation();
      endStroke();
    };

    React.useImperativeHandle(ref, () => ({
      clear: () => {
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        if (!canvas || !ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasStrokeRef.current = false;
      },
      getBase64: getBase64Data,
    }));

    return (
      <div className="w-full">
        <div
          className="border rounded-lg bg-white dark:bg-gray-900"
          style={{ height, touchAction: "none", overscrollBehavior: "contain" }}
          onClick={(e) => e.stopPropagation()}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ touchAction: "none" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseEnd}
            onMouseLeave={handleMouseEnd}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">Firma aqui (usa mouse o tactil)</p>
      </div>
    );
  }
);

export default FirmaDigital;
