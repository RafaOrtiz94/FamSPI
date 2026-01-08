import React, { useEffect, useRef } from "react";

/**
 * FirmaDigital
 * - Dibuja con mouse/touch sobre un <canvas>.
 * - getBase64(): devuelve el PNG en base64 **sin prefijo** (solo la cadena).
 * - clear(): limpia el canvas.
 */
const FirmaDigital = React.forwardRef(({ height = 160, strokeWidth = 2, onSignatureCapture }, ref) => {
  console.log("🔏 FirmaDigital: Component initialized", { height, strokeWidth, hasCallback: !!onSignatureCapture });

  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  useEffect(() => {
    console.log("🔏 FirmaDigital: Setting up canvas");
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
    console.log("🔏 FirmaDigital: Canvas setup complete", { width: canvas.width, height: canvas.height });
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
    e.preventDefault(); // Prevent any form submission
    drawing.current = true;
    last.current = getPos(e);
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault(); // Prevent any form submission
    const { x, y } = getPos(e);
    const ctx = ctxRef.current;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    last.current = { x, y };
  };
  const getBase64Data = () => {
    const dataUrl = canvasRef.current.toDataURL("image/png");
    // quitar prefijo "data:image/png;base64,"
    return dataUrl.split(",")[1] || "";
  };

  const end = (e) => {
    e.preventDefault(); // Prevent any form submission
    e.stopPropagation(); // Stop event bubbling
    drawing.current = false;

    // Call onSignatureCapture callback when drawing ends
    if (onSignatureCapture) {
      const signatureData = getBase64Data();
      console.log("Signature data length:", signatureData.length);
      if (signatureData && signatureData.length > 10) { // Lower threshold for testing
        console.log("Calling onSignatureCapture with signature data");
        onSignatureCapture(signatureData);
      } else {
        console.log("Signature data too small or empty");
      }
    } else {
      console.log("onSignatureCapture callback not provided");
    }
  };



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
        onClick={(e) => e.stopPropagation()} // Prevent event bubbling
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
          onClick={(e) => e.stopPropagation()} // Prevent event bubbling
        />
      </div>
      <p className="text-xs text-gray-500 mt-1">Firma aquí (usa mouse o táctil)</p>
    </div>
  );
});

export default FirmaDigital;
