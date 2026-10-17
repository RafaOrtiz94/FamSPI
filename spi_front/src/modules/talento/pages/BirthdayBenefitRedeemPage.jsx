import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiCalendar,
  FiCheck,
  FiGift,
  FiRefreshCw,
  FiUpload,
  FiXCircle,
} from "react-icons/fi";
import toast from "react-hot-toast";

import { useAuth } from "../../../core/auth/AuthContext";
import {
  redeemBirthdayBenefit,
  uploadBirthdayBenefitEvidence,
  validateBirthdayBenefitQr,
} from "../../../core/api/attendanceApi";

const STATUS_LABEL = {
  qr_generated: "QR generado",
  evidence_uploaded: "Evidencia cargada",
  redeemed: "Canjeado",
  expired: "Vencido",
  cancelled: "Cancelado",
};

const STATUS_TONE = {
  qr_generated: "bg-[#DBEAFE] text-[#1D4ED8]",
  evidence_uploaded: "bg-[#FEF3C7] text-[#D97706]",
  redeemed: "bg-[#DCFCE7] text-[#16A34A]",
  expired: "bg-[#FEE2E2] text-[#DC2626]",
  cancelled: "bg-[#FEE2E2] text-[#DC2626]",
};

const fmtDate = (value) => {
  if (!value) return "--";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

export default function BirthdayBenefitRedeemPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [benefit, setBenefit] = useState(null);
  const [state, setState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [files, setFiles] = useState([]);
  const [redeemDate, setRedeemDate] = useState("");
  const [uploading, setUploading] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  const loadBenefit = useCallback(async () => {
    if (!token) {
      setState("invalid");
      setErrorMessage("QR no proporcionado");
      return;
    }
    setState("loading");
    try {
      const response = await validateBirthdayBenefitQr(token);
      const nextBenefit = response?.data || null;
      setBenefit(nextBenefit);
      setRedeemDate(nextBenefit?.redeem_date || "");
      setState("ready");
      setErrorMessage("");
    } catch (error) {
      setState("invalid");
      setErrorMessage(error?.response?.data?.message || "Este QR ya no es válido.");
    }
  }, [token]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      const returnUrl = encodeURIComponent(`/cumpleanos/canje/${token}`);
      navigate(`/login?returnUrl=${returnUrl}`, { replace: true });
      return;
    }
    loadBenefit();
  }, [authLoading, isAuthenticated, loadBenefit, navigate, token]);

  const evidenceReady = useMemo(
    () => Array.isArray(benefit?.coordination_evidence_urls) && benefit.coordination_evidence_urls.length > 0,
    [benefit],
  );

  const canRedeem = benefit?.can_redeem && benefit?.status !== "redeemed" && benefit?.status !== "expired";

  const handleUploadEvidence = async () => {
    if (!files.length) {
      toast.error("Selecciona al menos una evidencia.");
      return;
    }
    setUploading(true);
    try {
      const response = await uploadBirthdayBenefitEvidence(token, files);
      setBenefit(response?.data || null);
      setFiles([]);
      toast.success("Evidencia cargada correctamente.");
    } catch (error) {
      toast.error(error?.response?.data?.message || "No se pudo cargar la evidencia.");
    } finally {
      setUploading(false);
    }
  };

  const handleRedeem = async () => {
    if (!redeemDate) {
      toast.error("Selecciona la fecha de canje.");
      return;
    }
    setRedeeming(true);
    try {
      const response = await redeemBirthdayBenefit(token, redeemDate);
      setBenefit(response?.data || null);
      toast.success("Día libre canjeado correctamente.");
    } catch (error) {
      toast.error(error?.response?.data?.message || "No se pudo registrar el canje.");
    } finally {
      setRedeeming(false);
    }
  };

  if (authLoading || state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] px-4">
        <div className="flex flex-col items-center gap-4 rounded-[20px] border border-[#E5E7EB] bg-white px-8 py-8 shadow-[0_15px_35px_rgba(15,23,42,0.08)]">
          <FiRefreshCw className="animate-spin text-[#2563EB]" size={28} />
          <div className="text-center">
            <p className="text-base font-semibold text-[#1F2937]">Validando acceso</p>
            <p className="mt-1 text-sm text-[#6B7280]">Estamos revisando tu tarjeta de cumpleaños.</p>
          </div>
        </div>
      </div>
    );
  }

  if (state === "invalid") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] px-4">
        <div className="max-w-lg rounded-[24px] border border-[#E5E7EB] bg-white p-8 text-center shadow-[0_15px_35px_rgba(15,23,42,0.08)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FEE2E2] text-[#DC2626]">
            <FiXCircle size={28} />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-[#1F2937]">Tarjeta no disponible</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">{errorMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-[24px] border border-[#E5E7EB] bg-white p-6 shadow-[0_15px_35px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#DBEAFE] text-[#1D4ED8]">
                  <FiGift size={22} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2563EB]">Beneficio de cumpleaños</p>
                  <h1 className="text-2xl font-semibold text-[#1F2937]">{benefit?.user_fullname || benefit?.user_email || "Colaborador"}</h1>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-[#6B7280]">
                Antes de elegir la fecha de canje debes subir la evidencia de coordinación con tu jefe inmediato. Luego el sistema notificará la ausencia y regularizará tu jornada.
              </p>
            </div>
            <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_TONE[benefit?.status] || "bg-[#F3F4F6] text-[#1F2937]"}`}>
              {STATUS_LABEL[benefit?.status] || benefit?.status || "Sin estado"}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-[18px] border border-[#E5E7EB] bg-[#F9FAFB] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">Cumpleaños</p>
              <p className="mt-2 text-sm font-semibold text-[#1F2937]">{fmtDate(benefit?.birth_date)}</p>
            </div>
            <div className="rounded-[18px] border border-[#E5E7EB] bg-[#F9FAFB] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">Vigencia</p>
              <p className="mt-2 text-sm font-semibold text-[#1F2937]">{fmtDate(benefit?.cycle_start)} - {fmtDate(benefit?.cycle_end)}</p>
            </div>
            <div className="rounded-[18px] border border-[#E5E7EB] bg-[#F9FAFB] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">Fecha canjeada</p>
              <p className="mt-2 text-sm font-semibold text-[#1F2937]">{benefit?.redeem_date ? fmtDate(benefit.redeem_date) : "--"}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-[24px] border border-[#E5E7EB] bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-2">
              <FiUpload className="text-[#2563EB]" size={18} />
              <h2 className="text-lg font-semibold text-[#1F2937]">Evidencia de coordinación</h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">
              Sube capturas o PDF que evidencien la coordinación de actividades para poder habilitar el canje.
            </p>

            <label className="mt-5 block text-xs font-semibold uppercase tracking-[0.14em] text-[#6B7280]">Archivos</label>
            <input
              type="file"
              multiple
              accept="image/*,.pdf"
              onChange={(event) => setFiles(Array.from(event.target.files || []))}
              className="mt-2 block w-full cursor-pointer rounded-[16px] border border-[#D1D5DB] bg-white px-4 py-3 text-sm text-[#1F2937] file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-[#DBEAFE] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#1D4ED8]"
            />
            {!!files.length && (
              <div className="mt-3 flex flex-wrap gap-2">
                {files.map((file) => (
                  <span key={`${file.name}-${file.size}`} className="rounded-full bg-[#F3F4F6] px-3 py-1 text-xs font-semibold text-[#1F2937]">
                    {file.name}
                  </span>
                ))}
              </div>
            )}

            <button
              type="button"
              disabled={uploading || !files.length || !canRedeem}
              onClick={handleUploadEvidence}
              className="mt-5 cursor-pointer rounded-[16px] bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? <FiRefreshCw className="mr-2 inline animate-spin" size={14} /> : <FiUpload className="mr-2 inline" size={14} />}
              Subir evidencia
            </button>

            {!!benefit?.coordination_evidence_urls?.length && (
              <>
                <div className="mt-6 h-px bg-[#F3F4F6]" />
                <div className="mt-5 flex flex-wrap gap-2">
                  {benefit.coordination_evidence_urls.map((url, index) => (
                    <a
                      key={`${url}-${index}`}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-full border border-[#E5E7EB] px-3 py-1.5 text-xs font-semibold text-[#1F2937] transition hover:bg-[#F9FAFB]"
                    >
                      <FiCheck className="mr-2 text-[#16A34A]" size={12} />
                      Evidencia {index + 1}
                    </a>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="rounded-[24px] border border-[#E5E7EB] bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-2">
              <FiCalendar className="text-[#2563EB]" size={18} />
              <h2 className="text-lg font-semibold text-[#1F2937]">Fecha de canje</h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">
              Elige un día laborable dentro de la vigencia. El sistema registrará la ausencia, la notificará y regularizará la jornada 09:00 / 13:00 / 14:00 / 18:00.
            </p>

            <label className="mt-5 block text-xs font-semibold uppercase tracking-[0.14em] text-[#6B7280]">Fecha seleccionada</label>
            <input
              type="date"
              value={redeemDate}
              min={benefit?.cycle_start || ""}
              max={benefit?.cycle_end || ""}
              onChange={(event) => setRedeemDate(event.target.value)}
              disabled={!canRedeem || !evidenceReady}
              className="mt-2 block w-full rounded-[16px] border border-[#D1D5DB] bg-white px-4 py-3 text-sm text-[#1F2937] disabled:cursor-not-allowed disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF]"
            />

            <div className="mt-5 rounded-[18px] border border-[#E5E7EB] bg-[#F9FAFB] p-4 text-sm text-[#1F2937]">
              <p className="font-semibold">Estado del flujo</p>
              <p className="mt-2 text-[#6B7280]">
                {!evidenceReady
                  ? "Primero debes subir la evidencia de coordinación."
                  : benefit?.status === "redeemed"
                    ? "Este beneficio ya fue canjeado."
                    : "Ya puedes confirmar la fecha para generar el registro automático."}
              </p>
            </div>

            <button
              type="button"
              disabled={redeeming || !redeemDate || !evidenceReady || !canRedeem}
              onClick={handleRedeem}
              className="mt-5 w-full cursor-pointer rounded-[16px] bg-[#16A34A] px-4 py-2.5 text-sm font-semibold text-white transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {redeeming ? <FiRefreshCw className="mr-2 inline animate-spin" size={14} /> : <FiCheck className="mr-2 inline" size={14} />}
              Confirmar canje
            </button>

            <button
              type="button"
              onClick={loadBenefit}
              className="mt-3 w-full cursor-pointer rounded-[16px] border border-[#E5E7EB] px-4 py-2.5 text-sm font-semibold text-[#1F2937] transition hover:bg-[#F9FAFB] active:scale-[0.97]"
            >
              <FiRefreshCw className="mr-2 inline" size={14} />
              Volver a consultar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
