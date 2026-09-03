import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiCamera, FiRefreshCw, FiTrash2 } from "react-icons/fi";

const buildCapturedFile = async (canvas, fileName) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No se pudo capturar la imagen"));
          return;
        }
        resolve(new File([blob], fileName, { type: "image/jpeg", lastModified: Date.now() }));
      },
      "image/jpeg",
      0.92
    );
  });

export default function CameraCaptureField({
  label,
  hint,
  value,
  onChange,
  error = "",
  fileNamePrefix = "captura",
}) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fallbackInputRef = useRef(null);
  const previewUrlRef = useRef("");
  // Guarda el timestamp de la captura para mostrarlo en la preview
  const [capturedAt, setCapturedAt] = useState("");

  const canUseLiveCamera = useMemo(
    () => typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia),
    []
  );

  // Asignar stream al <video> DESPUÉS de que React renderice el elemento.
  // requestAnimationFrame no es suficiente en iOS — el elemento puede no estar
  // en el DOM todavía. useEffect con [cameraOpen] garantiza que el <video>
  // ya existe cuando asignamos srcObject.
  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    // iOS Safari requiere llamar a play() explícitamente tras asignar srcObject.
    video.play().catch(() => {});
  }, [cameraOpen]);

  useEffect(() => {
    if (!value) {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = "";
        setPreviewUrl("");
      }
      return;
    }

    const nextUrl = URL.createObjectURL(value);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      previewUrlRef.current = nextUrl;
      return nextUrl;
    });

    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [value]);

  useEffect(() => () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  const openLiveCamera = async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      // setCameraOpen(true) dispara el useEffect que asigna srcObject
      // una vez que React renderiza el <video>.
      setCameraOpen(true);
    } catch {
      // getUserMedia falló (permiso denegado, no disponible en WKWebView, etc.).
      // NO llamamos click() aquí — iOS bloquea input.click() desde async catch.
      setCameraError("No se pudo acceder a la cámara. Verifica que la aplicación tenga permiso de cámara e intenta de nuevo.");
    }
  };

  const handleCameraButton = () => {
    setCameraError("");
    if (!canUseLiveCamera) {
      // Sin getUserMedia: abrir selector nativo con cámara trasera.
      fallbackInputRef.current?.click();
      return;
    }
    openLiveCamera();
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width  = video.videoWidth  || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Grabar fecha y hora en la esquina inferior derecha de la imagen
      const now = new Date();
      const ts = now.toLocaleString("es-EC", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false,
      });
      const fontSize = Math.max(16, Math.round(canvas.width * 0.032));
      ctx.font = `bold ${fontSize}px monospace`;
      const pad = Math.round(fontSize * 0.6);
      const tw  = ctx.measureText(ts).width;
      const bx  = canvas.width  - tw - pad * 2;
      const by  = canvas.height - pad * 2;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(bx - pad * 0.5, by - fontSize - pad * 0.25, tw + pad * 1.5, fontSize + pad * 0.75);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(ts, bx, by);

      const file = await buildCapturedFile(canvas, `${fileNamePrefix}_${Date.now()}.jpg`);
      setCapturedAt(ts);
      onChange(file);
      stopCamera();
    } catch {
      setCameraError("No se pudo capturar la foto. Reintenta.");
    }
  };

  const handleFallbackSelection = (event) => {
    const file = event.target.files?.[0] || null;
    if (file) {
      onChange(file);
      setCameraError("");
    }
    event.target.value = "";
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</span>
        {hint ? <span className="text-xs leading-relaxed text-slate-500">{hint}</span> : null}
      </div>

      {/* Fallback nativo — solo se activa cuando getUserMedia no está disponible */}
      <input
        ref={fallbackInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFallbackSelection}
      />

      {!cameraOpen && !previewUrl ? (
        <button
          type="button"
          onClick={handleCameraButton}
          className="flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 active:scale-[0.97]"
        >
          <FiCamera className="h-4 w-4" />
          Tomar foto
        </button>
      ) : null}

      {cameraOpen ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
          <video ref={videoRef} autoPlay playsInline muted className="aspect-[4/3] w-full object-cover" />
          <div className="flex flex-wrap gap-2 border-t border-slate-800 bg-slate-900 p-3">
            <button
              type="button"
              onClick={capturePhoto}
              className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-2xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white transition active:scale-[0.97]"
            >
              <FiCamera className="h-4 w-4" />
              Capturar
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition active:scale-[0.97]"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {previewUrl ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="relative">
            <img src={previewUrl} alt={label} className="aspect-[4/3] w-full object-cover" />
            {capturedAt ? (
              <span className="absolute bottom-2 right-2 rounded bg-black/55 px-2 py-0.5 font-mono text-[11px] font-semibold text-white">
                {capturedAt}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-slate-100 p-3">
            <button
              type="button"
              onClick={handleCameraButton}
              className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-2xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white transition active:scale-[0.97]"
            >
              <FiRefreshCw className="h-4 w-4" />
              Repetir foto
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setCapturedAt("");
                if (fallbackInputRef.current) fallbackInputRef.current.value = "";
              }}
              className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition active:scale-[0.97]"
            >
              <FiTrash2 className="h-4 w-4" />
              Quitar
            </button>
          </div>
        </div>
      ) : null}

      {cameraError ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs text-amber-800">{cameraError}</p>
        </div>
      ) : null}
      {error ? <p className="text-xs text-[#DC2626]">{error}</p> : null}
    </div>
  );
}
