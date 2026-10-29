import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiAlertTriangle, FiCheckCircle, FiClock, FiDownload, FiRefreshCw, FiShield } from "react-icons/fi";
import QRCode from "qrcode";
import { verifySignatureWorkflowToken } from "../../../core/api/signatureWorkflowsApi";
import { generateSignatureValidationSheet } from "../utils/signatureValidationSheetPdf";

const STATUS_STYLES = {
  prepared: "bg-slate-100 text-slate-700",
  sent: "bg-blue-50 text-blue-700",
  in_progress: "bg-blue-50 text-blue-700",
  partially_signed: "bg-amber-50 text-amber-700",
  completed: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
  cancelled: "bg-slate-200 text-slate-700",
};

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }) {
  const normalized = String(status || "").toLowerCase();
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[normalized] || "bg-slate-100 text-slate-700"}`}>
      {normalized ? normalized.replace(/_/g, " ") : "sin estado"}
    </span>
  );
}

const SignatureWorkflowVerificationPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const qrCanvasRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await verifySignatureWorkflowToken(token);
        if (!cancelled) setData(response);
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError?.response?.data?.message || "No se pudo verificar el documento.");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (token) load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!qrCanvasRef.current || !token) return;
    const url = `${window.location.origin}/verificar/famsign/${token}`;
    QRCode.toCanvas(qrCanvasRef.current, url, {
      width: 160,
      margin: 2,
      color: { dark: "#0a1628", light: "#ffffff" },
    });
  }, [token, data]);

  const handleDownloadSheet = async () => {
    if (!data) return;
    try {
      await generateSignatureValidationSheet({
        workflow: data.workflow,
        signers: data.signers || [],
        documents: data.documents || [],
      });
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto flex max-w-3xl items-center justify-center rounded-2xl border border-slate-200 bg-white py-20 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
          <FiRefreshCw size={22} className="animate-spin text-slate-300" />
        </div>
      </div>
    );
  }

  if (error || !data?.workflow) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-3 text-red-700">
            <div className="rounded-full bg-red-50 p-3">
              <FiAlertTriangle size={20} />
            </div>
            <div>
              <p className="text-base font-semibold">No se pudo verificar el documento</p>
              <p className="text-sm text-red-600">{error || "El token no existe o ya no está disponible."}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-6 cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 active:scale-[0.97]"
          >
            Ir al inicio
          </button>
        </div>
      </div>
    );
  }

  const { workflow, signers = [], documents = [] } = data;
  const currentDocument = documents[0] || null;
  const isCompleted = String(workflow.status || "").toLowerCase() === "completed";

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${isCompleted ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                  {isCompleted ? <FiCheckCircle size={14} /> : <FiClock size={14} />}
                  {isCompleted ? "Documento verificado" : "Documento en proceso"}
                </span>
                <StatusBadge status={workflow.status} />
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-900">FamSign</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">{workflow.title || "Documento firmado"}</h1>
              <p className="mt-2 text-sm text-slate-500">
                Origen: {workflow.source_module || "-"} / {workflow.source_entity || "-"} / {workflow.source_entity_id || "-"}
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-400">Código</p>
                <p className="mt-1 font-mono text-sm font-semibold text-slate-700">{workflow.workflow_code}</p>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                  <canvas ref={qrCanvasRef} />
                </div>
                <p className="text-[10px] text-slate-400">Escanea para verificar</p>
              </div>
              <button
                type="button"
                onClick={handleDownloadSheet}
                className="cursor-pointer inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100 active:scale-[0.97]"
              >
                <FiDownload size={13} />
                Hoja de validación (PDF)
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
          <div className="flex flex-wrap sm:flex-nowrap sm:divide-x divide-slate-100">
            {[
              { label: "Estado", value: String(workflow.status || "sin estado").replace(/_/g, " ") },
              { label: "Creado", value: formatDate(workflow.created_at) },
              { label: "Finalizado", value: formatDate(currentDocument?.finalized_at) },
            ].map((item, index) => (
              <div key={item.label} className={`flex-1 px-4 py-3 ${index > 1 ? "border-t border-slate-100 sm:border-t-0" : ""}`}>
                <p className="text-xs text-slate-400">{item.label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2">
            <FiShield size={16} className="text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">Integridad del documento</h2>
          </div>

          {currentDocument ? (
            <div className="mt-4 space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div>
                <p className="text-xs text-slate-400">Archivo base</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{currentDocument.filename}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">SHA base</p>
                <p className="mt-1 break-all font-mono text-xs text-slate-700">{currentDocument.source_sha256 || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">SHA final</p>
                <p className="mt-1 break-all font-mono text-xs text-slate-700">{currentDocument.final_sha256 || currentDocument.source_sha256 || "-"}</p>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No hay documento asociado en este workflow.</p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
          <h2 className="text-lg font-semibold text-slate-900">Firmantes</h2>
          <div className="mt-4 space-y-3">
            {signers.length ? signers.map((signer) => (
              <div key={signer.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {signer.sequence_order}. {signer.name_snapshot}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {signer.role_snapshot || "sin rol"}
                      {signer.cedula_snapshot ? ` · C.I. ${signer.cedula_snapshot}` : ""}
                      {" · "}{signer.email_snapshot || "-"}
                    </p>
                  </div>
                  <StatusBadge status={signer.status} />
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Firmado: {formatDate(signer.signed_at)}
                </p>
              </div>
            )) : (
              <p className="text-sm text-slate-500">No hay firmantes registrados.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default SignatureWorkflowVerificationPage;
