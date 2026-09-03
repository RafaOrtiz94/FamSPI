import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCalendar,
  FiCamera,
  FiCheck,
  FiClock,
  FiDownload,
  FiEdit2,
  FiExternalLink,
  FiGift,
  FiMapPin,
  FiMaximize2,
  FiPrinter,
  FiRefreshCw,
  FiSearch,
  FiSlash,
  FiUpload,
  FiUser,
  FiUsers,
  FiX,
} from "react-icons/fi";
import QRCode from "qrcode";
import toast from "react-hot-toast";
import { useAuth } from "../../../core/auth/AuthContext";

import {
  applyEntryRegularization,
  downloadAttendanceBulkPDF,
  downloadAttendanceMonthlyReport,
  downloadAttendancePDF,
  generateCollaboratorBirthdayBenefitQr,
  getAttendanceRegularizationsPanel,
  getCollaboratorBirthdayBenefit,
  getAttendanceWorkspaceCollaborator,
  getAttendanceWorkspaceOverview,
  getCollaboratorJustificationsPanel,
  scheduleAttendanceFollowUpMeeting,
  transitionAttendanceRegularization,
  getTeleworkRequests,
  decideTeleworkRequest,
} from "../../../core/api/attendanceApi";
import Modal from "../../../core/ui/components/Modal";
import { WORKSPACE_PAGE_CLASS } from "../../../core/ui/workspaceLayout";
import AttendanceMapView from "../components/attendance-reports/AttendanceMapView";
import { parseCoordinatePair } from "../utils/attendanceGeo";
import famLogo from "../../../assets/famproject_logo.png";

// ─── Period modes ─────────────────────────────────────────────────────────────

const PM = Object.freeze({ DAY: "day", MONTH: "month", YEAR: "year" });

const TABS = Object.freeze({
  MARKS: "marks",
  PERMISSIONS: "permissions",
  BREACHES: "breaches",
  OVERTIME: "overtime",
  EXITS: "exits",
  MAP: "map",
  GESTION: "gestion",
});

// ─── Date helpers ─────────────────────────────────────────────────────────────

const toIso = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const todayIso = () => toIso(new Date());
const currentMonth = () => todayIso().slice(0, 7);
const currentYear = () => String(new Date().getFullYear());

const buildRange = (mode, day, month, year) => {
  if (mode === PM.DAY) return day ? { startDate: day, endDate: day } : null;
  if (mode === PM.MONTH) {
    const match = String(month || "").match(/^(\d{4})-(\d{2})$/);
    if (!match) return null;
    const first = new Date(+match[1], +match[2] - 1, 1);
    const last = new Date(+match[1], +match[2], 0);
    return { startDate: toIso(first), endDate: toIso(last) };
  }
  if (mode === PM.YEAR) {
    const y = Number(year);
    if (!Number.isInteger(y) || y < 2000 || y > 2100) return null;
    return { startDate: `${y}-01-01`, endDate: `${y}-12-31` };
  }
  return null;
};

const getNextWorkday = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  if (d.getDay() === 6) d.setDate(d.getDate() + 2);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return toIso(d);
};

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmtDate = (v) => {
  if (!v) return "--";
  const d = new Date(`${String(v).slice(0, 10)}T00:00:00`);
  return isNaN(d) ? String(v) : d.toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
};

const fmtTime = (v) => {
  if (!v) return "--";
  const d = new Date(v);
  return isNaN(d) ? "--" : d.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", hour12: false });
};

const fmtHours = (v) => {
  const n = Number(v || 0);
  return n > 0 ? `${n.toFixed(2)}h` : "--";
};

const fmtDuration = ({ seconds, hours } = {}) => {
  const rawSeconds = Number.isFinite(Number(seconds))
    ? Number(seconds)
    : Number(hours || 0) * 3600;
  const totalSeconds = Math.max(0, Math.round(rawSeconds));
  if (!totalSeconds) return "--";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
};

const fmtOvertime = (rowOrHours) => {
  if (rowOrHours && typeof rowOrHours === "object") {
    return fmtDuration({
      seconds: rowOrHours.real_overtime_seconds,
      hours: rowOrHours.real_overtime_hours,
    });
  }
  return fmtDuration({ hours: rowOrHours });
};

const PERMISSION_TYPE_LABELS = Object.freeze({
  personal: "Permiso personal",
  salud: "Permiso de salud",
  estudios: "Permiso de estudios",
  calamidad: "Calamidad domestica",
  emergencia_medica_propia: "Emergencia medica propia",
});

const normalizeToken = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const resolvePermissionTypeLabel = (item = {}) => {
  if (item?.es_emergencia || item?.time_off_is_emergency) return "Permiso de emergencia";
  const subtype = normalizeToken(item?.tipo_permiso || item?.time_off_subtype);
  if (!subtype) return "Permiso";
  return PERMISSION_TYPE_LABELS[subtype] || `Permiso ${subtype.replace(/_/g, " ")}`;
};

const resolvePoint = ({ location, time, type, label }) => {
  const coord = parseCoordinatePair(location);
  if (!coord || !time) return null;
  return {
    type,
    label,
    time,
    lat: coord.lat,
    lng: coord.lng,
  };
};

const buildRegularizedMarks = (row = {}) => ([
  {
    key: "entry",
    time: row.acta_entry_time || row.entry_time || null,
    point: resolvePoint({
      location: row.entry_location,
      time: row.acta_entry_time || row.entry_time || null,
      type: "entry",
      label: "Entrada regularizada",
    }),
  },
  {
    key: "lunch_start",
    time: row.acta_lunch_start_time || row.lunch_start_time || null,
    point: resolvePoint({
      location: row.op_lunch_start_location || row.lunch_start_location,
      time: row.acta_lunch_start_time || row.lunch_start_time || null,
      type: "lunch_start",
      label: "Salida a almuerzo regularizada",
    }),
  },
  {
    key: "lunch_end",
    time: row.acta_lunch_end_time || row.lunch_end_time || null,
    point: resolvePoint({
      location: row.op_lunch_end_location || row.lunch_end_location,
      time: row.acta_lunch_end_time || row.lunch_end_time || null,
      type: "lunch_end",
      label: "Regreso de almuerzo regularizado",
    }),
  },
  {
    key: "exit",
    time: row.acta_exit_time || row.exit_time || null,
    point: resolvePoint({
      location: row.return_location || row.exit_location,
      time: row.acta_exit_time || row.exit_time || null,
      type: "exit",
      label: "Salida regularizada",
    }),
  },
]);

const buildRealMarks = (row = {}) => ([
  {
    key: "entry",
    time: row.real_entry_time || row.entry_time || null,
    point: resolvePoint({
      location: row.entry_location,
      time: row.real_entry_time || row.entry_time || null,
      type: "entry",
      label: "Entrada real",
    }),
  },
  {
    key: "lunch_start",
    time: row.op_lunch_start_time || row.real_lunch_start_time || row.lunch_start_time || null,
    point: resolvePoint({
      location: row.op_lunch_start_location || row.lunch_start_location,
      time: row.op_lunch_start_time || row.real_lunch_start_time || row.lunch_start_time || null,
      type: "lunch_start",
      label: "Salida a almuerzo real",
    }),
  },
  {
    key: "lunch_end",
    time: row.op_lunch_end_time || row.real_lunch_end_time || row.lunch_end_time || null,
    point: resolvePoint({
      location: row.op_lunch_end_location || row.lunch_end_location,
      time: row.op_lunch_end_time || row.real_lunch_end_time || row.lunch_end_time || null,
      type: "lunch_end",
      label: "Regreso de almuerzo real",
    }),
  },
  {
    key: "exit",
    time: row.return_time || row.exit_time || null,
    point: resolvePoint({
      location: row.return_location || row.exit_location,
      time: row.return_time || row.exit_time || null,
      type: "exit",
      label: "Salida real",
    }),
  },
]);

const buildPermissionMarks = (row = {}) => ([
  {
    key: "permission_exit",
    time: row.permission_exit_time || null,
  },
  {
    key: "permission_return",
    time: row.permission_return_time || null,
  },
]);

const buildTeleworkMarks = (row = {}) => {
  const isTelework = normalizeToken(row.operational_category) === "teletrabajo";
  if (!isTelework) {
    return [
      { key: "telework_start", time: null, point: null },
      { key: "telework_lunch_start", time: null, point: null },
      { key: "telework_lunch_end", time: null, point: null },
      { key: "telework_end", time: null, point: null },
    ];
  }

  return [
    {
      key: "telework_start",
      time: row.start_time || row.entry_time || null,
      point: resolvePoint({
        location: row.start_location || row.entry_location,
        time: row.start_time || row.entry_time || null,
        type: "telework_start",
        label: "Inicio de teletrabajo",
      }),
    },
    {
      key: "telework_lunch_start",
      time: row.lunch_start_time || null,
      point: resolvePoint({
        location: row.lunch_start_location,
        time: row.lunch_start_time || null,
        type: "telework_lunch_start",
        label: "Salida a almuerzo teletrabajo",
      }),
    },
    {
      key: "telework_lunch_end",
      time: row.lunch_end_time || null,
      point: resolvePoint({
        location: row.lunch_end_location,
        time: row.lunch_end_time || null,
        type: "telework_lunch_end",
        label: "Regreso de almuerzo teletrabajo",
      }),
    },
    {
      key: "telework_end",
      time: row.return_time || row.exit_time || null,
      point: resolvePoint({
        location: row.return_location || row.exit_location,
        time: row.return_time || row.exit_time || null,
        type: "telework_end",
        label: "Cierre de teletrabajo",
      }),
    },
  ];
};

const getInitials = (name = "") => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "NA";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const buildPeriodLabel = (mode, range) => {
  if (!range) return "Sin rango seleccionado";
  if (range.startDate === range.endDate) return fmtDate(range.startDate);
  const names = { day: "Hoy", month: "Mensual", year: "Anual" };
  return `${names[mode] || ""}: ${fmtDate(range.startDate)} al ${fmtDate(range.endDate)}`;
};

// ─── CSV export ───────────────────────────────────────────────────────────────

const exportCsv = (rows, fileName) => {
  const headers = ["Colaborador", "Cedula", "Fecha", "Tipo", "Detalle", "Entrada", "Salida alm.", "Entrada alm.", "Salida", "Min. atraso", "Extra real", "Horas oper.", "Estado"];
  const lines = [
    headers.join(";"),
    ...rows.map((r) =>
      [
        r.fullname || "", r.cedula || "", fmtDate(r.date), r.breach_label || r.breach_type || "",
        r.detail || "", fmtTime(r.entry_time), fmtTime(r.lunch_start_time), fmtTime(r.lunch_end_time),
        fmtTime(r.exit_time), r.late_minutes ?? "", fmtOvertime(r),
        Number(r.operational_hours || 0).toFixed(2), r.attendance_status || "",
      ].map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")
    ),
  ];
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// ─── UI atoms ─────────────────────────────────────────────────────────────────

const BADGE_TONE = {
  neutral: "bg-[#F3F4F6] text-[#1F2937]",
  red:     "bg-[#FEE2E2] text-[#DC2626]",
  amber:   "bg-[#FEF3C7] text-[#D97706]",
  green:   "bg-[#DCFCE7] text-[#16A34A]",
  blue:    "bg-[#DBEAFE] text-[#1D4ED8]",
};

const Badge = ({ tone = "neutral", children }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${BADGE_TONE[tone] || BADGE_TONE.neutral}`}>
    {children}
  </span>
);

const EmptySection = ({ icon: Icon = FiAlertCircle, title, description }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
    <Icon size={22} className="text-[#D1D5DB]" />
    <p className="text-sm font-medium text-[#1F2937]">{title}</p>
    {description && <p className="max-w-xs text-xs leading-relaxed text-[#6B7280]">{description}</p>}
  </div>
);

const SelectedMarkPanel = ({ selectedMark, onClose }) => {
  if (!selectedMark?.point) return null;

  const mapRow = {
    id: `${selectedMark.rowKey}-${selectedMark.key}`,
    user_id: selectedMark.userId,
    fullname: selectedMark.fullname,
    date: selectedMark.date,
    geo_points: [selectedMark.point],
  };

  return (
    <div className="border-b border-[#F3F4F6] bg-[#FAFBFC] p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FiMapPin size={14} className="text-[#2563EB]" />
            <p className="text-sm font-semibold text-[#1F2937]">{selectedMark.label}</p>
          </div>
          <p className="mt-1 text-xs text-[#6B7280]">
            {selectedMark.fullname} · {fmtDate(selectedMark.date)} · {fmtTime(selectedMark.time)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer self-start rounded-[12px] border border-[#E5E7EB] px-3 py-1.5 text-xs font-medium text-[#6B7280] hover:bg-white"
        >
          Cerrar mapa
        </button>
      </div>
      <AttendanceMapView rows={[mapRow]} getGeoPoints={(row) => row.geo_points || []} selectedUserId={selectedMark.userId} />
    </div>
  );
};

const TabBtn = ({ active, children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`cursor-pointer whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition active:scale-[0.97] ${
      active ? "bg-[#1E293B] text-white" : "text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1F2937]"
    }`}
  >
    {children}
  </button>
);

const formatKilometers = (value) => {
  if (value === null || value === undefined || value === "") return "--";
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return `${number.toLocaleString("es-EC", { maximumFractionDigits: 2 })} km`;
};

const resolveDrivePhotoUrl = (url, fileId) => {
  if (url) return url;
  if (fileId) return `https://drive.google.com/file/d/${fileId}/view`;
  return "";
};

const hasMileageValue = (value) => value !== null && value !== undefined && value !== "";

const MileagePhoto = ({ label, url }) => {
  const [previewError, setPreviewError] = useState(false);

  return (
    <div className="rounded-[14px] border border-[#E5E7EB] bg-[#FAFBFC] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <FiCamera size={14} className="flex-shrink-0 text-[#2563EB]" />
          <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">{label}</span>
        </div>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-[#2563EB] hover:bg-[#EFF6FF]"
          >
            Abrir <FiExternalLink size={11} />
          </a>
        )}
      </div>
      {url && !previewError ? (
        <img
          src={url}
          alt={`${label} del kilometraje`}
          className="h-32 w-full rounded-[10px] border border-[#E5E7EB] bg-white object-contain"
          onError={() => setPreviewError(true)}
        />
      ) : url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex h-32 items-center justify-center rounded-[10px] border border-dashed border-[#BFDBFE] bg-[#EFF6FF] text-center text-xs font-semibold text-[#1D4ED8]"
        >
          La vista previa no esta disponible. Abrir fotografia
        </a>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-[10px] border border-dashed border-[#E5E7EB] bg-white text-center text-xs text-[#9CA3AF]">
          Sin fotografia registrada
        </div>
      )}
    </div>
  );
};

const MileageTab = ({ rows }) => {
  const mileageRows = (Array.isArray(rows) ? rows : []).filter((row) => (
    hasMileageValue(row?.odometer_start_km)
    || hasMileageValue(row?.odometer_end_km)
    || hasMileageValue(row?.odometer_distance_km)
    || Boolean(row?.odometer_start_photo_drive_url)
    || Boolean(row?.odometer_start_photo_drive_file_id)
    || Boolean(row?.odometer_end_photo_drive_url)
    || Boolean(row?.odometer_end_photo_drive_file_id)
  ));

  if (!mileageRows.length) {
    return (
      <div className="p-4">
        <EmptySection
          icon={FiCamera}
          title="Sin registros de kilometraje"
          description="No hay marcaciones de entrada o salida con kilometraje y fotografias en el periodo seleccionado."
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {mileageRows.map((row, index) => {
        const startPhotoUrl = resolveDrivePhotoUrl(
          row.odometer_start_photo_drive_url,
          row.odometer_start_photo_drive_file_id,
        );
        const endPhotoUrl = resolveDrivePhotoUrl(
          row.odometer_end_photo_drive_url,
          row.odometer_end_photo_drive_file_id,
        );

        return (
          <article
            key={`${row.user_id || "user"}-${row.date || "date"}-${row.exception_id || index}`}
            className="rounded-[16px] border border-[#E5E7EB] bg-white p-4"
          >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <FiMapPin size={14} className="text-[#2563EB]" />
                  <h3 className="text-sm font-semibold text-[#1F2937]">{fmtDate(row.date)}</h3>
                  <Badge tone="blue">Kilometraje</Badge>
                </div>
                <p className="mt-1 text-xs text-[#6B7280]">
                  {row.exception_description || "Salida operacional"}
                </p>
              </div>
              <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1 font-mono text-xs font-semibold text-[#4B5563]">
                Distancia: {formatKilometers(row.odometer_distance_km)}
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <section className="rounded-[14px] border border-[#BFDBFE] bg-[#F8FBFF] p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#1D4ED8]">Entrada</span>
                  <span className="font-mono text-sm font-bold text-[#1E40AF]">{formatKilometers(row.odometer_start_km)}</span>
                </div>
                <MileagePhoto label="Fotografia de entrada" url={startPhotoUrl} />
              </section>
              <section className="rounded-[14px] border border-[#BBF7D0] bg-[#F7FEF9] p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#15803D]">Salida</span>
                  <span className="font-mono text-sm font-bold text-[#166534]">{formatKilometers(row.odometer_end_km)}</span>
                </div>
                <MileagePhoto label="Fotografia de salida" url={endPhotoUrl} />
              </section>
            </div>
          </article>
        );
      })}
    </div>
  );
};

const SectionDivider = ({ label, count }) => (
  <div className="flex items-center gap-2 pt-4 pb-2">
    <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280]">{label}</span>
    {count !== undefined && (
      <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-semibold text-[#6B7280]">{count}</span>
    )}
    <div className="h-px flex-1 bg-[#F3F4F6]" />
  </div>
);

// ─── Marks table ──────────────────────────────────────────────────────────────

const BIRTHDAY_STATUS_LABEL = {
  not_generated: "Sin generar",
  qr_generated: "QR generado",
  evidence_uploaded: "Evidencia cargada",
  redeemed: "Canjeado",
  expired: "Vencido",
  cancelled: "Cancelado",
};

const BIRTHDAY_STATUS_TONE = {
  not_generated: "neutral",
  qr_generated: "blue",
  evidence_uploaded: "amber",
  redeemed: "green",
  expired: "red",
  cancelled: "red",
};

const BirthdayBenefitQrModal = ({ benefit, onClose }) => {
  const canvasRef = useRef(null);
  const logoUrlRef = useRef(null);

  useEffect(() => {
    if (!benefit?.qr_url || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, benefit.qr_url, {
      width: 260,
      margin: 1,
      color: { dark: "#0F172A", light: "#FFFFFF" },
    }).catch(() => {});
  }, [benefit]);

  useEffect(() => {
    logoUrlRef.current = famLogo;
  }, []);

  const handlePrint = () => {
    if (!benefit?.qr_url || !canvasRef.current) return;
    const qrDataUrl = canvasRef.current.toDataURL("image/png");
    const printWindow = window.open("", "_blank", "width=860,height=720");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Tarjeta de cumpleaños</title>
          <style>
            body { font-family: Geist, Arial, sans-serif; margin: 0; padding: 32px; color: #1F2937; background: linear-gradient(180deg, #F8FAFC 0%, #FFF7ED 100%); }
            .card { max-width: 780px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 28px; padding: 0; box-shadow: 0 18px 40px rgba(15,23,42,0.10); overflow: hidden; }
            .hero { position: relative; padding: 28px 32px; background:
              radial-gradient(circle at top left, rgba(14,165,233,0.18), transparent 30%),
              radial-gradient(circle at top right, rgba(249,115,22,0.16), transparent 34%),
              linear-gradient(135deg, #0F172A 0%, #1E293B 62%, #334155 100%);
              color: #FFFFFF; }
            .confetti-a, .confetti-b, .confetti-c { position: absolute; border-radius: 999px; opacity: 0.95; }
            .confetti-a { width: 14px; height: 14px; background: #FDBA74; top: 22px; right: 118px; }
            .confetti-b { width: 10px; height: 10px; background: #7DD3FC; top: 58px; right: 72px; }
            .confetti-c { width: 18px; height: 18px; background: #FDE68A; top: 90px; right: 142px; }
            .hero-row { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
            .brand { display: flex; align-items: center; gap: 14px; }
            .brand img { width: 56px; height: 56px; border-radius: 16px; background: #FFFFFF; padding: 8px; }
            .eyebrow { color: #BAE6FD; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
            h1 { margin: 10px 0 6px; font-size: 30px; line-height: 1.05; }
            .hero p { margin: 0; line-height: 1.6; color: rgba(255,255,255,0.82); max-width: 520px; }
            .body { padding: 32px; }
            .grid { display: grid; grid-template-columns: 280px 1fr; gap: 28px; align-items: center; }
            .meta { display: grid; gap: 12px; }
            .qr-shell { padding: 18px; border-radius: 24px; background: linear-gradient(180deg, #FFF7ED 0%, #FFFFFF 100%); border: 1px solid #FED7AA; }
            .qr-shell img { width: 100%; height: auto; display: block; border-radius: 18px; border: 1px solid #E5E7EB; background: #FFFFFF; }
            .pill { display: inline-flex; padding: 6px 12px; border-radius: 999px; background: #DBEAFE; color: #1D4ED8; font-size: 12px; font-weight: 700; }
            .headline { font-size: 18px; font-weight: 700; color: #1F2937; }
            .sub { color: #6B7280; line-height: 1.6; }
            .meta-card { border: 1px solid #E5E7EB; border-radius: 18px; padding: 16px; background: #F9FAFB; }
            .link { margin-top: 10px; font-size: 12px; word-break: break-all; color: #334155; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="hero">
              <span class="confetti-a"></span>
              <span class="confetti-b"></span>
              <span class="confetti-c"></span>
              <div class="hero-row">
                <div class="brand">
                  <img src="${logoUrlRef.current || famLogo}" alt="Logo FAM" />
                  <div>
                    <div class="eyebrow">FamSPI · Beneficio interno</div>
                    <h1>Tu día libre de cumpleaños</h1>
                    <p>Una tarjeta pensada para coordinar tu canje con orden, trazabilidad y un mensaje más humano para esta fecha especial.</p>
                  </div>
                </div>
              </div>
            </div>
            <div class="body">
              <div class="grid">
                <div class="qr-shell">
                  <img src="${qrDataUrl}" alt="QR cumpleaños" />
                </div>
                <div class="meta">
                  <span class="pill">${benefit.user_fullname || benefit.user_email || "Colaborador"}</span>
                  <div class="headline">Feliz cumpleaños de parte de FAM</div>
                  <div class="sub">Escanea esta tarjeta, sube tu evidencia de coordinación y elige el día en que vas a disfrutar tu beneficio.</div>
                  <div class="meta-card"><strong>Vigencia</strong><br />${fmtDate(benefit.cycle_start)} al ${fmtDate(benefit.cycle_end)}</div>
                  <div class="meta-card"><strong>Estado actual</strong><br />${BIRTHDAY_STATUS_LABEL[benefit.status] || benefit.status}</div>
                  <div class="meta-card">
                    <strong>Enlace directo</strong>
                    <div class="link">${benefit.qr_url || ""}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <Modal open onClose={onClose} title="Tarjeta imprimible de cumpleaños" maxWidth="max-w-3xl">
      <div className="overflow-hidden rounded-[24px] border border-[#E5E7EB] bg-white shadow-[0_15px_35px_rgba(15,23,42,0.08)]">
        <div className="relative overflow-hidden bg-[linear-gradient(135deg,#0F172A_0%,#1E293B_62%,#334155_100%)] px-6 py-6 text-white">
          <div className="absolute right-8 top-6 h-4 w-4 rounded-full bg-[#FDBA74]" />
          <div className="absolute right-16 top-16 h-3 w-3 rounded-full bg-[#7DD3FC]" />
          <div className="absolute right-28 top-10 h-5 w-5 rounded-full bg-[#FDE68A]" />
          <div className="flex items-start gap-4">
            <div className="rounded-[16px] bg-white/95 p-2 shadow-[0_4px_16px_rgba(15,23,42,0.18)]">
              <img src={famLogo} alt="Logo FAM" className="h-12 w-12 object-contain" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#BAE6FD]">FamSPI · Beneficio interno</p>
              <h3 className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.02em] text-white">Tu día libre de cumpleaños</h3>
              <p className="mt-3 max-w-[560px] text-sm leading-relaxed text-white/80">
                Una tarjeta especial para coordinar el canje de tu beneficio, mantener la trazabilidad y celebrar esta fecha con una experiencia más cuidada.
              </p>
            </div>
          </div>
        </div>
        <div className="grid gap-6 p-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="rounded-[24px] border border-[#FED7AA] bg-[linear-gradient(180deg,#FFF7ED_0%,#FFFFFF_100%)] p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
            <canvas ref={canvasRef} className="mx-auto h-auto w-full max-w-[260px] rounded-[18px] bg-white" />
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2563EB]">Canje por cumpleaños</p>
              <h3 className="mt-1 text-xl font-semibold text-[#1F2937]">{benefit?.user_fullname || benefit?.user_email || "Colaborador"}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">
                Feliz cumpleaños de parte de FAM. Escanea esta tarjeta para subir la coordinación y registrar el día en que vas a usar tu beneficio.
              </p>
            </div>
            <div className="grid gap-3 rounded-[18px] border border-[#E5E7EB] bg-[#F9FAFB] p-4 text-sm text-[#1F2937]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#6B7280]">Estado</span>
                <Badge tone={BIRTHDAY_STATUS_TONE[benefit?.status] || "neutral"}>{BIRTHDAY_STATUS_LABEL[benefit?.status] || benefit?.status}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#6B7280]">Vigencia</span>
                <span className="font-mono text-xs">{fmtDate(benefit?.cycle_start)} - {fmtDate(benefit?.cycle_end)}</span>
              </div>
              <div className="rounded-[14px] bg-white px-3 py-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">Enlace directo</span>
                <div className="mt-1 break-all text-[12px] text-[#334155]">{benefit?.qr_url || "QR no disponible"}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={handlePrint} className="cursor-pointer rounded-[16px] bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white transition active:scale-[0.97]">
                <FiPrinter className="mr-2 inline" size={15} />
                Imprimir tarjeta
              </button>
              <button
                type="button"
                onClick={() => window.open(benefit?.qr_url, "_blank", "noopener,noreferrer")}
                className="cursor-pointer rounded-[16px] border border-[#E5E7EB] px-4 py-2.5 text-sm font-semibold text-[#1F2937] transition hover:bg-[#F9FAFB] active:scale-[0.97]"
              >
                <FiMaximize2 className="mr-2 inline" size={14} />
                Abrir enlace
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

const BirthdayBenefitPanel = ({ userId }) => {
  const [benefit, setBenefit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);

  const loadBenefit = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await getCollaboratorBirthdayBenefit(userId);
      setBenefit(res?.data || null);
    } catch (error) {
      toast.error(error?.response?.data?.message || "No se pudo cargar el beneficio de cumpleaños.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadBenefit();
  }, [loadBenefit]);

  const handleGenerateQr = async () => {
    setBusy(true);
    try {
      const res = await generateCollaboratorBirthdayBenefitQr(userId);
      setBenefit(res?.data || null);
      setQrModalOpen(true);
      toast.success("Tarjeta QR generada correctamente.");
    } catch (error) {
      toast.error(error?.response?.data?.message || "No se pudo generar la tarjeta QR.");
    } finally {
      setBusy(false);
    }
  };

  if (loading && !benefit) {
    return (
      <div className="flex h-40 items-center justify-center">
        <FiRefreshCw className="animate-spin text-[#D1D5DB]" size={20} />
      </div>
    );
  }

  const status = benefit?.status || "not_generated";

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#DBEAFE] text-[#1D4ED8]">
                <FiGift size={18} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#1F2937]">Día libre por cumpleaños</h3>
                <p className="text-sm text-[#6B7280]">Tarjeta imprimible con QR para que el colaborador gestione su canje.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={BIRTHDAY_STATUS_TONE[status] || "neutral"}>{BIRTHDAY_STATUS_LABEL[status] || status}</Badge>
              {benefit?.birth_date ? <span className="font-mono text-xs text-[#6B7280]">Cumpleaños: {fmtDate(benefit.birth_date)}</span> : null}
              {benefit?.cycle_start && benefit?.cycle_end ? <span className="font-mono text-xs text-[#6B7280]">Vigencia: {fmtDate(benefit.cycle_start)} - {fmtDate(benefit.cycle_end)}</span> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={loadBenefit} className="cursor-pointer rounded-[16px] border border-[#E5E7EB] px-3.5 py-2 text-sm font-semibold text-[#6B7280] transition hover:bg-[#F9FAFB] active:scale-[0.97]">
              <FiRefreshCw className="mr-2 inline" size={14} />
              Actualizar
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleGenerateQr}
              className="cursor-pointer rounded-[16px] bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? <FiRefreshCw className="mr-2 inline animate-spin" size={14} /> : <FiGift className="mr-2 inline" size={14} />}
              {benefit?.qr_token ? "Regenerar tarjeta" : "Generar tarjeta"}
            </button>
          </div>
        </div>
      </div>

      {!benefit || status === "not_generated" ? (
        <EmptySection icon={FiGift} title="Sin tarjeta generada" description="Genera el QR para que el colaborador cargue la coordinación y seleccione la fecha de su día libre." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">Estado</p>
                <p className="mt-2 text-sm font-semibold text-[#1F2937]">{BIRTHDAY_STATUS_LABEL[status] || status}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">Fecha canjeada</p>
                <p className="mt-2 text-sm font-semibold text-[#1F2937]">{benefit?.redeem_date ? fmtDate(benefit.redeem_date) : "--"}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">Evidencia cargada</p>
                <p className="mt-2 text-sm font-semibold text-[#1F2937]">{benefit?.coordination_uploaded_at ? fmtDate(benefit.coordination_uploaded_at) : "--"}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">Regularización F-RH-09</p>
                <p className="mt-2 text-sm font-semibold text-[#1F2937]">{benefit?.attendance_regularized_at ? "Aplicada" : "Pendiente"}</p>
              </div>
            </div>
            {!!benefit?.coordination_evidence_urls?.length && (
              <>
                <SectionDivider label="Evidencias" count={benefit.coordination_evidence_urls.length} />
                <div className="flex flex-wrap gap-2">
                  {benefit.coordination_evidence_urls.map((url, index) => (
                    <a
                      key={`${url}-${index}`}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex cursor-pointer items-center rounded-full border border-[#E5E7EB] px-3 py-1.5 text-xs font-semibold text-[#1F2937] transition hover:bg-[#F9FAFB]"
                    >
                      <FiUpload className="mr-2" size={12} />
                      Evidencia {index + 1}
                    </a>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="rounded-[20px] border border-[#E5E7EB] bg-[#F9FAFB] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">Acceso del colaborador</p>
            <div className="mt-3 break-all rounded-[16px] bg-white px-4 py-3 text-xs leading-relaxed text-[#334155]">
              {benefit?.qr_url || "Sin enlace generado"}
            </div>
            <button
              type="button"
              onClick={() => setQrModalOpen(true)}
              className="mt-4 w-full cursor-pointer rounded-[16px] border border-[#E5E7EB] px-4 py-2.5 text-sm font-semibold text-[#1F2937] transition hover:bg-white active:scale-[0.97]"
            >
              <FiPrinter className="mr-2 inline" size={14} />
              Ver tarjeta imprimible
            </button>
          </div>
        </div>
      )}

      {qrModalOpen && benefit?.qr_token ? <BirthdayBenefitQrModal benefit={benefit} onClose={() => setQrModalOpen(false)} /> : null}
    </div>
  );
};

const STATUS_MAP = {
  completed:  { tone: "green", label: "Jornada cerrada" },
  working:    { tone: "blue",  label: "En jornada" },
  lunch_open: { tone: "amber", label: "Almuerzo abierto" },
};

const MarksTable = ({ rows = [], variant = "regularized", onMarkClick = null }) => {
  if (!rows.length)
    return <EmptySection icon={FiClock} title="Sin marcaciones en este periodo" description="El colaborador no registra asistencia en el rango filtrado." />;

  const isRegularized = variant === "regularized";
  const headers = isRegularized
    ? ["Fecha", "Estado", "Entrada", "Alm. S", "Alm. E", "Salida", "Perm. S", "Perm. E", "Extra", "Oper.", "Modalidad", "TT Inicio", "TT Alm. S", "TT Alm. E", "TT Cierre", "Ciudad", "Ubicacion", "Excepcion"]
    : ["Fecha", "Estado", "Entrada", "Alm. S", "Alm. E", "Salida", "Extra", "Oper.", "Modalidad", "TT Inicio", "TT Alm. S", "TT Alm. E", "TT Cierre", "Ciudad", "Ubicacion", "Excepcion"];

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-[#F3F4F6]">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F9FAFB]">
          {rows.map((row) => {
            const { tone, label } = STATUS_MAP[row.attendance_status] || { tone: "neutral", label: row.attendance_status || "Sin entrada" };
            const marks = variant === "real" ? buildRealMarks(row) : buildRegularizedMarks(row);
            const permissionMarks = buildPermissionMarks(row);
            const isTelework = normalizeToken(row.operational_category) === "teletrabajo";
            const teleworkMarks = buildTeleworkMarks(row);
            const location = row.start_location || row.entry_location || row.return_location || row.exit_location;
            const point = parseCoordinatePair(location);
            const renderMarkCell = (mark, muted = false) => {
              if (!mark?.time) {
                return <span className="text-[#D1D5DB]">--</span>;
              }
              if (!mark.point || !onMarkClick) {
                return <span>{fmtTime(mark.time)}</span>;
              }
              return (
                <button
                  type="button"
                  onClick={() =>
                    onMarkClick({
                      ...mark,
                      rowKey: `${row.user_id}-${row.date}`,
                      userId: row.user_id,
                      fullname: row.fullname,
                      date: row.date,
                    })
                  }
                  className={`cursor-pointer rounded-md px-1.5 py-0.5 underline decoration-dotted underline-offset-2 transition hover:bg-[#EFF6FF] ${muted ? "text-[#6B7280]" : "text-[#1F2937]"}`}
                >
                  {fmtTime(mark.time)}
                </button>
              );
            };
            return (
              <tr key={`${row.user_id}-${row.date}`} className="hover:bg-[#F9FAFB]">
                <td className="px-3 py-2 font-mono text-xs font-medium text-[#1F2937]">{fmtDate(row.date)}</td>
                <td className="px-3 py-2"><Badge tone={tone}>{label}</Badge></td>
                <td className="px-3 py-2 font-mono text-xs text-[#1F2937]">{renderMarkCell(marks[0], false)}</td>
                <td className="px-3 py-2 font-mono text-xs text-[#6B7280]">{renderMarkCell(marks[1], true)}</td>
                <td className="px-3 py-2 font-mono text-xs text-[#6B7280]">{renderMarkCell(marks[2], true)}</td>
                <td className="px-3 py-2 font-mono text-xs text-[#1F2937]">{renderMarkCell(marks[3], false)}</td>
                {isRegularized ? (
                  <>
                    <td className="px-3 py-2 font-mono text-xs text-[#6B7280]">{renderMarkCell(permissionMarks[0], true)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-[#6B7280]">{renderMarkCell(permissionMarks[1], true)}</td>
                  </>
                ) : null}
                <td className="px-3 py-2 font-mono text-xs text-[#1F2937]">{fmtOvertime(row)}</td>
                <td className="px-3 py-2 font-mono text-xs text-[#1F2937]">{fmtHours(row.operational_elapsed_hours)}</td>
                <td className="px-3 py-2"><Badge tone={isTelework ? "blue" : "neutral"}>{isTelework ? "Teletrabajo" : "Presencial / campo"}</Badge></td>
                <td className="px-3 py-2 font-mono text-xs text-[#1F2937]">{renderMarkCell(teleworkMarks[0], false)}</td>
                <td className="px-3 py-2 font-mono text-xs text-[#6B7280]">{renderMarkCell(teleworkMarks[1], true)}</td>
                <td className="px-3 py-2 font-mono text-xs text-[#6B7280]">{renderMarkCell(teleworkMarks[2], true)}</td>
                <td className="px-3 py-2 font-mono text-xs text-[#1F2937]">{renderMarkCell(teleworkMarks[3], false)}</td>
                <td className="max-w-[150px] px-3 py-2 text-xs text-[#1F2937]">{row.operational_destination_city || "--"}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-[#6B7280]">{point ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : "--"}</td>
                <td className="px-3 py-2">
                  {row.exception_type ? (
                    <div className="space-y-0.5">
                      <Badge tone="neutral">{String(row.exception_type).replace(/_/g, " ")}</Badge>
                      {row.exception_description && (
                        <p className="text-[11px] leading-tight text-[#6B7280]">{row.exception_description}</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-[#D1D5DB]">--</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const resolvePermissionMarksForReport = (permission = {}, rows = []) => {
  const requestId = Number(permission?.id || 0);
  const permissionDate = String(
    permission?.fecha_inicio ||
    permission?.fecha_inicio_hora ||
    "",
  ).slice(0, 10);

  const matchedRow = (Array.isArray(rows) ? rows : []).find((row) => {
    if (requestId > 0 && Number(row?.permission_request_id || 0) === requestId) {
      return true;
    }
    if (!permissionDate) return false;
    return (
      String(row?.date || "").slice(0, 10) === permissionDate &&
      normalizeToken(row?.time_off_type) === "permiso" &&
      normalizeToken(row?.time_off_subtype) === normalizeToken(permission?.tipo_permiso)
    );
  });

  return {
    exitTime:
      matchedRow?.permission_exit_time ||
      permission?.fecha_inicio_hora ||
      null,
    returnTime:
      matchedRow?.permission_return_time ||
      permission?.fecha_fin_hora ||
      null,
  };
};

const PermissionsTab = ({ permissions = [], rows = [] }) => {
  if (!permissions.length) {
    return (
      <EmptySection
        icon={FiCheck}
        title="Sin permisos aprobados en este periodo"
        description="No se encontraron permisos o emergencias aprobadas para el rango seleccionado."
      />
    );
  }

  return (
    <div className="p-4">
      <div className="overflow-x-auto rounded-[12px] border border-[#F3F4F6]">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-[#F3F4F6]">
              {["Fecha", "Tipo", "Modalidad", "Salida permiso", "Entrada permiso", "Duracion", "Estado"].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F9FAFB]">
            {permissions.map((item) => {
              const isHourly = Boolean(item?.fecha_inicio_hora && item?.fecha_fin_hora);
              const marks = resolvePermissionMarksForReport(item, rows);
              return (
                <tr key={item.id} className="hover:bg-[#F9FAFB]">
                  <td className="px-3 py-2 font-mono text-xs text-[#1F2937]">{fmtDate(item.fecha_inicio || item.fecha_inicio_hora)}</td>
                  <td className="px-3 py-2 text-xs font-medium text-[#1F2937]">{resolvePermissionTypeLabel(item)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone={item.es_emergencia ? "red" : "blue"}>
                        {item.es_emergencia ? "Emergencia" : isHourly ? "Por horas" : "Dia completo"}
                      </Badge>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-[#6B7280]">{fmtTime(marks.exitTime)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-[#6B7280]">{fmtTime(marks.returnTime)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-[#1F2937]">
                    {isHourly ? fmtHours(item.duracion_horas) : item.duracion_dias ? `${Number(item.duracion_dias)} dia(s)` : "Dia completo"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone="green">{String(item.status || "approved").replace(/_/g, " ")}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Breach row (with schedule meeting button) ────────────────────────────────

const BreachRow = ({ breach, onSchedule }) => {
  const isOT = String(breach.breach_type || "").toLowerCase().includes("overtime") ||
    String(breach.breach_type || "").toLowerCase().includes("extra");
  const meeting = breach.follow_up_meeting || null;
  return (
    <div className="flex items-start gap-3 rounded-[12px] border border-[#F3F4F6] bg-white px-4 py-3 transition hover:border-[#E5E7EB] hover:shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold text-[#1F2937]">{fmtDate(breach.date)}</span>
          <Badge tone={isOT ? "amber" : "red"}>{breach.breach_label || breach.breach_type || "Incumplimiento"}</Badge>
        </div>
        <p className="mt-1 text-xs text-[#6B7280]">{breach.detail || "Sin detalle adicional"}</p>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[11px] text-[#6B7280]">
          <span>Entrada: {fmtTime(breach.entry_time)}</span>
          <span>Alm.: {fmtTime(breach.lunch_start_time)} / {fmtTime(breach.lunch_end_time)}</span>
          <span>Salida: {fmtTime(breach.exit_time)}</span>
          {Number(breach.late_minutes || 0) > 0 && (
            <span className="font-semibold text-[#DC2626]">Atraso: {breach.late_minutes} min</span>
          )}
          {Number(breach.real_overtime_hours || 0) > 0 && (
            <span>Extra: {fmtOvertime(breach)}</span>
          )}
        </div>
        {meeting ? (
          <div className="mt-2 inline-flex flex-wrap items-center gap-1.5 rounded-[10px] border border-[#BBF7D0] bg-[#F0FDF4] px-2.5 py-1 text-[11px] font-semibold text-[#15803D]">
            <FiCalendar size={12} />
            Reunion agendada
            <span className="font-mono font-medium text-[#166534]">
              {fmtDate(meeting.meeting_date)} {meeting.start_time || ""}
            </span>
          </div>
        ) : null}
      </div>
      {meeting ? (
        <button
          type="button"
          disabled
          className="flex-shrink-0 rounded-[10px] border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-1.5 text-xs font-semibold text-[#15803D]"
        >
          Reunion agendada
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onSchedule(breach)}
          className="cursor-pointer flex-shrink-0 rounded-[10px] bg-[#2563EB] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1D4ED8] active:scale-[0.97]"
        >
          Agendar reunion
        </button>
      )}
    </div>
  );
};

// ─── Overtime tab ─────────────────────────────────────────────────────────────

const OvertimeTab = ({ rows, incidents }) => {
  const unauthorizedDates = useMemo(
    () => new Set(incidents.filter((i) => Number(i.real_overtime_hours || 0) > 0).map((i) => i.date)),
    [incidents]
  );

  const authorized = useMemo(
    () => rows.filter((r) => Number(r.real_overtime_hours || 0) > 0 && !unauthorizedDates.has(r.date)),
    [rows, unauthorizedDates]
  );

  const unauthorized = useMemo(
    () => incidents.filter((i) => Number(i.real_overtime_hours || 0) > 0),
    [incidents]
  );

  return (
    <div className="p-4 space-y-0">
      <SectionDivider label="Con permiso" count={authorized.length} />
      {authorized.length ? (
        <div className="overflow-x-auto rounded-[12px] border border-[#F3F4F6]">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[#F3F4F6]">
                {["Fecha", "Horas extra", "Entrada", "Salida", "Tipo excepcion"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F9FAFB]">
              {authorized.map((r) => (
                <tr key={r.date} className="hover:bg-[#F9FAFB]">
                  <td className="px-3 py-2 font-mono text-xs text-[#1F2937]">{fmtDate(r.date)}</td>
                  <td className="px-3 py-2 font-mono text-xs font-semibold text-[#16A34A]">{fmtOvertime(r)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-[#6B7280]">{fmtTime(r.entry_time)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-[#6B7280]">{fmtTime(r.exit_time)}</td>
                  <td className="px-3 py-2 text-xs text-[#6B7280]">{r.exception_type ? String(r.exception_type).replace(/_/g, " ") : "--"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptySection icon={FiCheck} title="Sin horas extra con permiso" description="No se detectaron horas extra autorizadas en este periodo." />
      )}

      <SectionDivider label="Sin permiso (detectadas por el sistema)" count={unauthorized.length} />
      {unauthorized.length ? (
        <div className="overflow-x-auto rounded-[12px] border border-[#F3F4F6]">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[#F3F4F6]">
                {["Fecha", "Horas extra", "Entrada", "Salida", "Novedad"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F9FAFB]">
              {unauthorized.map((i, idx) => (
                <tr key={`${i.date}-${idx}`} className="hover:bg-[#F9FAFB]">
                  <td className="px-3 py-2 font-mono text-xs text-[#1F2937]">{fmtDate(i.date)}</td>
                  <td className="px-3 py-2 font-mono text-xs font-semibold text-[#DC2626]">{fmtOvertime(i)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-[#6B7280]">{fmtTime(i.entry_time)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-[#6B7280]">{fmtTime(i.exit_time)}</td>
                  <td className="px-3 py-2 text-xs text-[#6B7280]">{i.breach_label || "--"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptySection icon={FiCheck} title="Sin horas extra no autorizadas" description="El sistema no detecto horas extra sin permiso en este periodo." />
      )}
    </div>
  );
};

// ─── Marcaciones operacionales tab ───────────────────────────────────────────

const OPERATIONAL_MARK_LABELS = Object.freeze({
  start: "Salida operacional",
  arrival: "Llegada a destino",
  op_lunch_start: "Almuerzo op. salida",
  op_lunch_end: "Almuerzo op. regreso",
  departure: "Salida del destino",
  return: "Retorno / cierre",
});

const FIELD_EVENT_LABELS = Object.freeze({
  client_entry: "Entrada a cliente",
  client_exit: "Salida de cliente",
  office_exit: "Salida de oficina",
  office_entry: "Retorno a oficina",
});

// geo_points (backend) trae las marcas operacionales con lat/lng; field_events
// trae entradas/salidas de cliente con nombre de prospecto. Se unen y ordenan
// cronológicamente para listar el recorrido completo del día.
const buildOperationalMarks = (row = {}) => {
  const geoMarks = (Array.isArray(row.geo_points) ? row.geo_points : [])
    .filter((p) => OPERATIONAL_MARK_LABELS[p.type])
    .map((p, idx) => ({
      key: `${p.type}-${idx}`,
      label: OPERATIONAL_MARK_LABELS[p.type],
      time: p.time,
      point: Number.isFinite(p.lat) && Number.isFinite(p.lng)
        ? { type: p.type, label: OPERATIONAL_MARK_LABELS[p.type], time: p.time, lat: p.lat, lng: p.lng }
        : null,
    }));

  const fieldMarks = (Array.isArray(row.field_events) ? row.field_events : []).map((e, idx) => {
    const base = FIELD_EVENT_LABELS[e.type] || String(e.type || "Evento").replace(/_/g, " ");
    const label = e.prospect_name ? `${base} — ${e.prospect_name}` : base;
    const lat = Number(e.lat);
    const lng = Number(e.lng);
    return {
      key: `event-${idx}`,
      label,
      time: e.time,
      point: Number.isFinite(lat) && Number.isFinite(lng) ? { type: e.type, label, time: e.time, lat, lng } : null,
    };
  });

  return [...geoMarks, ...fieldMarks]
    .filter((m) => m.time || m.point)
    .sort((a, b) => new Date(a.time || 0) - new Date(b.time || 0));
};

const ExitsTab = ({ rows, onMarkClick = null }) => {
  const operationalDays = useMemo(
    () =>
      rows
        .map((r) => ({ row: r, marks: buildOperationalMarks(r) }))
        .filter(({ row, marks }) => marks.length > 0 || Number(row.operational_elapsed_hours || 0) > 0),
    [rows]
  );

  return (
    <div className="p-4 space-y-0">
      <SectionDivider label="Marcaciones operacionales" count={operationalDays.length} />
      {operationalDays.length ? (
        <div className="overflow-x-auto rounded-[12px] border border-[#F3F4F6]">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[#F3F4F6]">
                {["Fecha", "Marcacion", "Modalidad", "Ciudad", "Hora", "Ubicacion"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">{h}</th>
                ))}
              </tr>
              <tr className="hidden border-b border-[#F3F4F6]">
                {["Fecha", "Marcación", "Hora", "Ubicación"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F9FAFB]">
              {operationalDays.map(({ row, marks }) => (
                <React.Fragment key={`${row.user_id}-${row.date}`}>
                  <tr className="bg-[#F9FAFB]">
                    <td colSpan={6} className="px-3 py-1.5 text-[11px] font-semibold text-[#1F2937]">
                      {fmtDate(row.date)}
                      {row.fullname ? <span className="ml-2 font-normal text-[#6B7280]">{row.fullname}</span> : null}
                      {Number(row.operational_elapsed_hours || 0) > 0 ? (
                        <span className="ml-2 font-mono text-[#2563EB]">{fmtHours(row.operational_elapsed_hours)} oper.</span>
                      ) : null}
                    </td>
                  </tr>
                  {marks.map((mark) => (
                    <tr key={`${row.user_id}-${row.date}-${mark.key}`} className="hover:bg-[#F9FAFB]">
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2 text-xs text-[#1F2937]">{mark.label}</td>
                      <td className="px-3 py-2"><Badge tone={normalizeToken(row.operational_category) === "teletrabajo" ? "blue" : "neutral"}>{normalizeToken(row.operational_category) === "teletrabajo" ? "Teletrabajo" : "Presencial / campo"}</Badge></td>
                      <td className="px-3 py-2 text-xs text-[#1F2937]">{row.operational_destination_city || "--"}</td>
                      <td className="px-3 py-2 font-mono text-xs text-[#1F2937]">{fmtTime(mark.time)}</td>
                      <td className="px-3 py-2">
                        {mark.point && onMarkClick ? (
                          <div className="space-y-0.5">
                            <p className="font-mono text-[11px] text-[#6B7280]">{mark.point.lat.toFixed(5)}, {mark.point.lng.toFixed(5)}</p>
                            <button
                              type="button"
                              onClick={() =>
                                onMarkClick({
                                  ...mark,
                                  rowKey: `${row.user_id}-${row.date}`,
                                  userId: row.user_id,
                                  fullname: row.fullname,
                                  date: row.date,
                                })
                              }
                              className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-[#2563EB] underline decoration-dotted underline-offset-2 hover:bg-[#EFF6FF]"
                            >
                              <FiMapPin size={11} />
                              Ver en mapa
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-[#D1D5DB]">--</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!marks.length ? (
                    <tr>
                      <td className="px-3 py-2" />
                      <td colSpan={5} className="px-3 py-2 text-xs text-[#9CA3AF]">Sin marcas georreferenciadas para este día.</td>
                    </tr>
                  ) : null}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptySection icon={FiCalendar} title="Sin marcaciones operacionales" description="No se registraron salidas operacionales en el periodo." />
      )}
    </div>
  );
};

// ─── Meeting modal ────────────────────────────────────────────────────────────

const MeetingModal = ({ target, onClose, onScheduled }) => {
  const [date, setDate] = useState(getNextWorkday());
  const [time, setTime] = useState("10:00");
  const [type, setType] = useState("presencial");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!date || !time) {
      toast.error("Completa la fecha y hora de la reunion.");
      return;
    }
    setLoading(true);
    try {
      await scheduleAttendanceFollowUpMeeting(target.userId, {
        date,
        start_time: time,
        meeting_type: type,
        reason: notes.trim() || undefined,
        breach_date: target.breach?.date,
        breach_type: target.breach?.breach_type,
      });
      toast.success("Reunion agendada correctamente.");
      await onScheduled?.();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || "No se pudo agendar la reunion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[30] flex items-center justify-center bg-[#0F172A]/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="z-[40] w-full max-w-md rounded-[16px] border border-[#E5E7EB] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18),0_4px_16px_rgba(15,23,42,0.10)]">
        <div className="flex items-start justify-between border-b border-[#F3F4F6] px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-[#1F2937]">Agendar reunion de seguimiento</p>
            <p className="mt-0.5 text-xs text-[#6B7280]">
              {target.fullname}{target.breach ? ` · ${fmtDate(target.breach.date)}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-[8px] p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] active:scale-[0.97]"
          >
            <FiX size={15} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {target.breach && (
            <div className="rounded-[10px] bg-[#FEF3C7] px-3 py-2">
              <p className="text-xs text-[#D97706]">
                <span className="font-semibold">Motivo:</span>{" "}
                {target.breach.breach_label || target.breach.breach_type || "Incumplimiento"} — {fmtDate(target.breach.date)}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[#1F2937]">Fecha</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 rounded-[12px] border border-[#D1D5DB] px-3 text-sm text-[#1F2937] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#0EA5E9]/20"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[#1F2937]">Hora</span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-10 rounded-[12px] border border-[#D1D5DB] px-3 text-sm text-[#1F2937] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#0EA5E9]/20"
              />
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-[#1F2937]">Modalidad</span>
            <div className="flex gap-4">
              {["presencial", "virtual"].map((opt) => (
                <label key={opt} className="flex cursor-pointer items-center gap-2 text-sm text-[#1F2937]">
                  <input
                    type="radio"
                    name="meeting-type"
                    value={opt}
                    checked={type === opt}
                    onChange={() => setType(opt)}
                    className="accent-[#2563EB]"
                  />
                  <span className="capitalize">{opt}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-[#1F2937]">Notas (opcional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Contexto adicional para la reunion..."
              className="resize-none rounded-[12px] border border-[#D1D5DB] px-3 py-2.5 text-sm text-[#1F2937] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#0EA5E9]/20 placeholder:text-[#D1D5DB]"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-[#F3F4F6] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-[12px] px-4 py-2 text-sm font-medium text-[#6B7280] hover:bg-[#F3F4F6] active:scale-[0.97]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="cursor-pointer inline-flex items-center gap-2 rounded-[12px] bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1D4ED8] active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
          >
            {loading && <FiRefreshCw size={13} className="animate-spin" />}
            Agendar reunion
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Gestión tab (justificaciones + regularizaciones) ────────────────────────

const JUST_STATUS_TONE = { approved: "green", rejected: "red", overridden: "amber" };
const JUST_STATUS_LABEL = { approved: "Aprobada", rejected: "Rechazada", overridden: "Modificada" };
const REG_STATUS_TONE = { pending: "amber", approved: "green", rejected: "red", applied: "blue", cancelled: "neutral" };
const REG_STATUS_LABEL = { pending: "Pendiente", approved: "Aprobada", rejected: "Rechazada", applied: "Aplicada", cancelled: "Cancelada" };
const REG_TYPE_LABEL = {
  missing_clock_in: "Entrada faltante",
  late_arrival: "Atraso",
  early_departure: "Salida anticipada",
  missing_lunch_out: "Salida almuerzo faltante",
  missing_lunch_in: "Retorno almuerzo faltante",
  missing_clock_out: "Salida faltante",
  wrong_location: "Ubicacion incorrecta",
  field_operation_adjustment: "Ajuste operacion campo",
  client_visit_adjustment: "Ajuste visita cliente",
  offline_sync_adjustment: "Ajuste sincronizacion offline",
};

const normalizeAttendanceDateValue = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s].*)?$/);
  return match?.[1] || raw;
};

const GENERAL_REGULARIZATION_TYPE_OPTIONS = [
  { value: "", label: "Todos los tipos" },
  { value: "late_arrival", label: "Atraso" },
  { value: "early_departure", label: "Salida anticipada" },
  { value: "missing_clock_in", label: "Entrada faltante" },
  { value: "missing_lunch_out", label: "Salida almuerzo faltante" },
  { value: "missing_lunch_in", label: "Retorno almuerzo faltante" },
  { value: "missing_clock_out", label: "Salida faltante" },
  { value: "wrong_location", label: "Ubicacion incorrecta" },
  { value: "field_operation_adjustment", label: "Ajuste operacion campo" },
  { value: "client_visit_adjustment", label: "Ajuste visita cliente" },
  { value: "offline_sync_adjustment", label: "Ajuste sincronizacion offline" },
];

const hasExactTalentHumanRole = (user = {}) => [
  user.role,
  user.scope,
  user.role_name,
  user.rol,
  ...(Array.isArray(user.roles) ? user.roles : []),
  ...(Array.isArray(user.scopes) ? user.scopes : []),
].map(normalizeToken).includes("talento_humano");

const TeleworkRequestsPanel = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getTeleworkRequests();
      setRequests((response?.data?.requests || []).filter((request) => String(request?.status || "").toUpperCase() === "PENDING"));
    } catch (error) {
      toast.error(error?.response?.data?.message || "No se pudieron cargar las solicitudes de teletrabajo.");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDecision = async (requestId, decision) => {
    if (decision === "reject" && !String(rejectionReason || "").trim()) {
      toast.error("Escribe el motivo del rechazo.");
      return;
    }
    setBusy(requestId);
    try {
      await decideTeleworkRequest(requestId, decision, rejectionReason);
      toast.success(decision === "approve" ? "Teletrabajo aprobado." : "Teletrabajo rechazado.");
      setRejectingId(null);
      setRejectionReason("");
      await load();
    } catch (error) {
      toast.error(error?.response?.data?.message || "No se pudo actualizar la solicitud.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col gap-3 rounded-[16px] border border-[#D1FAE5] bg-[#F0FDF4] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#14532D]">Solicitudes de teletrabajo</h3>
          <p className="mt-1 text-xs leading-5 text-[#166534]">
            Revisa la fecha, ciudad y motivo antes de aprobar. La aprobación solo habilita la marcación en la fecha solicitada.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-[10px] border border-[#BBF7D0] bg-white px-3 py-2 text-xs font-semibold text-[#166534] transition hover:bg-[#F0FDF4] disabled:opacity-60"
        >
          <FiRefreshCw size={12} className={loading ? "animate-spin" : ""} /> Actualizar
        </button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><FiRefreshCw className="animate-spin text-[#D1D5DB]" size={20} /></div>
      ) : !requests.length ? (
        <EmptySection icon={FiCheck} title="Sin solicitudes pendientes" description="Las nuevas solicitudes de teletrabajo aparecerán aquí para su revisión." />
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <div key={request.id} className="rounded-[16px] border border-[#E5E7EB] bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[#1F2937]">{request.user_name || request.user_email}</p>
                    <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#92400E]">Pendiente</span>
                  </div>
                  <p className="mt-1 text-xs text-[#6B7280]">{request.user_email || "Sin correo"}</p>
                </div>
                <div className="rounded-[10px] bg-[#F8FAFC] px-3 py-2 text-left sm:text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Fecha solicitada</p>
                  <p className="mt-0.5 text-sm font-semibold text-[#1F2937]">{fmtDate(request.request_date)}</p>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-[10px] border border-[#F3F4F6] bg-[#FAFBFC] px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Ciudad</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[#1F2937]"><FiMapPin size={12} className="text-[#2563EB]" />{request.city}</p>
                </div>
                <div className="rounded-[10px] border border-[#F3F4F6] bg-[#FAFBFC] px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Solicitud registrada</p>
                  <p className="mt-1 text-xs text-[#374151]">{fmtTime(request.created_at)}</p>
                </div>
              </div>
              {request.reason ? <p className="mt-3 rounded-[10px] bg-[#F8FBFF] px-3 py-2 text-xs leading-5 text-[#374151]"><strong>Motivo:</strong> {request.reason}</p> : null}

              {rejectingId === request.id ? (
                <div className="mt-3 space-y-2 border-t border-[#F3F4F6] pt-3">
                  <textarea
                    rows="2"
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    placeholder="Motivo del rechazo"
                    className="w-full resize-none rounded-[10px] border border-[#D1D5DB] px-3 py-2 text-xs text-[#1F2937] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#0EA5E9]/20"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={busy === request.id} onClick={() => handleDecision(request.id, "reject")} className="rounded-[10px] bg-[#DC2626] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#B91C1C] disabled:opacity-60">Confirmar rechazo</button>
                    <button type="button" onClick={() => { setRejectingId(null); setRejectionReason(""); }} className="rounded-[10px] px-3 py-2 text-xs font-semibold text-[#6B7280] hover:bg-[#F3F4F6]">Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-[#F3F4F6] pt-3">
                  <button type="button" disabled={busy === request.id} onClick={() => handleDecision(request.id, "approve")} className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[10px] border border-[#BBF7D0] px-3 py-2 text-xs font-semibold text-[#15803D] transition hover:bg-[#F0FDF4] disabled:opacity-60"><FiCheck size={12} />Aprobar</button>
                  <button type="button" disabled={busy === request.id} onClick={() => setRejectingId(request.id)} className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[10px] border border-[#FECACA] px-3 py-2 text-xs font-semibold text-[#B91C1C] transition hover:bg-[#FEF2F2] disabled:opacity-60"><FiSlash size={12} />Rechazar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const GestionTab = ({ userId, rows, range, canManageTelework = false }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [subTab, setSubTab] = useState("atrasos");
  const [busy, setBusy] = useState(null); // id of row being actioned
  const [applyModal, setApplyModal] = useState(null); // { date, entryTime }

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await getCollaboratorJustificationsPanel(userId, {
        startDate: range?.startDate,
        endDate: range?.endDate,
      });
      setData(res?.data || null);
    } catch {
      toast.error("No se pudo cargar el panel de gestión.");
    } finally {
      setLoading(false);
    }
  }, [userId, range?.startDate, range?.endDate]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!canManageTelework && subTab === "teletrabajo") setSubTab("atrasos");
  }, [canManageTelework, subTab]);

  const handleApplyEntry = async () => {
    if (!applyModal?.date || !applyModal?.entryTime) return;
    setBusy(`entry-${applyModal.date}`);
    let ok = false;
    try {
      await applyEntryRegularization({
        userId,
        date: normalizeAttendanceDateValue(applyModal.date),
        entryTime: applyModal.entryTime,
      });
      ok = true;
    } catch (err) {
      toast.error(err?.response?.data?.message || "Error al aplicar entrada.");
    } finally {
      setBusy(null);
      setApplyModal(null);
    }
    if (ok) toast.success("Entrada regularizada correctamente.");
    await load();
  };

  const handleTransition = async (id, status) => {
    setBusy(id);
    let ok = false;
    try {
      await transitionAttendanceRegularization(id, { status });
      ok = true;
    } catch (err) {
      toast.error(err?.response?.data?.message || "Error al procesar regularizacion.");
    } finally {
      setBusy(null);
    }
    if (ok) toast.success(`Regularizacion ${REG_STATUS_LABEL[status]?.toLowerCase() || status}.`);
    await load();
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <FiRefreshCw className="animate-spin text-[#D1D5DB]" size={20} />
      </div>
    );
  }

  const lateJustifications = data?.late_justifications || [];
  const pendingEntries = data?.pending_entry_regularizations || [];
  const formalRegs = data?.formal_regularizations || [];
  const pendingCount = pendingEntries.length + formalRegs.filter(r => r.status === "pending").length;

  return (
    <div className="flex flex-col">
      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 border-b border-[#F3F4F6] px-4 py-2.5">
        {canManageTelework && (
          <TabBtn active={subTab === "teletrabajo"} onClick={() => setSubTab("teletrabajo")}>
            Teletrabajo
          </TabBtn>
        )}
        <TabBtn active={subTab === "atrasos"} onClick={() => setSubTab("atrasos")}>
          Atrasos {lateJustifications.length > 0 ? `(${lateJustifications.length})` : ""}
        </TabBtn>
        <TabBtn active={subTab === "regularizaciones"} onClick={() => setSubTab("regularizaciones")}>
          Regularizaciones {pendingCount > 0 ? `(${pendingCount})` : ""}
        </TabBtn>
        <TabBtn active={subTab === "kilometraje"} onClick={() => setSubTab("kilometraje")}>
          Kilometraje
        </TabBtn>
        <TabBtn active={subTab === "cumpleanos"} onClick={() => setSubTab("cumpleanos")}>
          Cumpleaños
        </TabBtn>
        <button
          type="button"
          onClick={load}
          className="ml-auto cursor-pointer rounded-full p-1.5 text-[#D1D5DB] transition hover:text-[#6B7280]"
        >
          <FiRefreshCw size={12} />
        </button>
      </div>

      {/* ── Atrasos sub-tab ── */}
      {subTab === "atrasos" && (
        <div className="p-4">
          {!lateJustifications.length ? (
            <EmptySection icon={FiCheck} title="Sin justificaciones de atraso" description="El colaborador no registra justificaciones de atraso en el sistema." />
          ) : (
            <div className="space-y-2">
              {lateJustifications.map((lj) => {
                const tone = JUST_STATUS_TONE[lj.status] || "neutral";
                return (
                  <div key={lj.id} className="rounded-[12px] border border-[#F3F4F6] bg-white px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-[#1F2937]">{fmtDate(lj.attendance_date)}</span>
                          {Number(lj.late_minutes) > 0 && (
                            <span className="rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[11px] font-semibold text-[#DC2626]">
                              +{lj.late_minutes} min
                            </span>
                          )}
                          <Badge tone={tone}>{JUST_STATUS_LABEL[lj.status] || lj.status}</Badge>
                        </div>
                        <p className="text-xs text-[#6B7280]">{lj.reason || "Sin motivo registrado"}</p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          <div className="rounded-[10px] border border-[#F3F4F6] bg-[#FAFBFC] px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Hora real</p>
                            <p className="mt-0.5 font-mono text-xs font-semibold text-[#1F2937]">
                              {lj.actual_entry_time ? fmtTime(lj.actual_entry_time) : "--"}
                            </p>
                          </div>
                          <div className="rounded-[10px] border border-[#F3F4F6] bg-[#FAFBFC] px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Hora regularizada</p>
                            <p className="mt-0.5 font-mono text-xs font-semibold text-[#1F2937]">
                              {lj.regularized_entry_time ? String(lj.regularized_entry_time).slice(0, 5) : "--"}
                            </p>
                          </div>
                          <div className="rounded-[10px] border border-[#F3F4F6] bg-[#FAFBFC] px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Registro</p>
                            <p className="mt-0.5 font-mono text-xs font-semibold text-[#1F2937]">
                              {lj.created_at ? fmtDate(lj.created_at) : "--"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {subTab === "cumpleanos" && <BirthdayBenefitPanel userId={userId} />}

      {subTab === "kilometraje" && <MileageTab rows={rows} />}
      {subTab === "teletrabajo" && canManageTelework && <TeleworkRequestsPanel />}

      {/* ── Regularizaciones sub-tab ── */}
      {subTab === "regularizaciones" && (
        <div className="p-4 space-y-4">

          {/* Pendientes de entrada (entry_pending_regularization = TRUE) */}
          {pendingEntries.length > 0 && (
            <div>
              <SectionDivider label="Regularizacion de entrada pendiente" count={pendingEntries.length} />
              <div className="space-y-2">
                {pendingEntries.map((pe) => (
                  <div key={pe.date} className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-[#FEF3C7] bg-[#FFFBEB] px-4 py-3">
                    <div>
                      <span className="font-mono text-xs font-semibold text-[#1F2937]">{fmtDate(pe.date)}</span>
                      <p className="mt-0.5 text-[11px] text-[#92400E]">
                        El colaborador solicito regularizacion de entrada — entrada no marcada
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy === `entry-${pe.date}`}
                      onClick={() => setApplyModal({ date: pe.date, entryTime: "09:00" })}
                      className="cursor-pointer rounded-[10px] bg-[#2563EB] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#1D4ED8] active:scale-[0.97] disabled:opacity-50"
                    >
                      Aplicar entrada
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Regularizaciones formales */}
          {formalRegs.length > 0 ? (
            <div>
              <SectionDivider label="Solicitudes formales" count={formalRegs.length} />
              <div className="space-y-2">
                {formalRegs.map((reg) => {
                  const tone = REG_STATUS_TONE[reg.status] || "neutral";
                  const isPending = reg.status === "pending";
                  return (
                    <div key={reg.id} className="rounded-[12px] border border-[#F3F4F6] bg-white px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-[#1F2937]">{fmtDate(reg.attendance_date)}</span>
                            <Badge tone={tone}>{REG_STATUS_LABEL[reg.status] || reg.status}</Badge>
                            <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-medium text-[#6B7280]">
                              {REG_TYPE_LABEL[reg.regularization_type] || reg.regularization_type}
                            </span>
                          </div>
                          <p className="text-xs text-[#6B7280]">{reg.reason || "Sin motivo"}</p>
                          {reg.approver_comment && (
                            <p className="text-[11px] text-[#9CA3AF]">Comentario TH: {reg.approver_comment}</p>
                          )}
                          <div className="flex flex-wrap gap-x-4 font-mono text-[11px] text-[#9CA3AF]">
                            {reg.requested_timestamp && <span>Solicitado: {fmtTime(reg.requested_timestamp)}</span>}
                            {reg.requester_name && <span>Por: {reg.requester_name}</span>}
                          </div>
                        </div>
                        {isPending && (
                          <div className="flex flex-shrink-0 gap-1.5">
                            <button
                              type="button"
                              disabled={busy === reg.id}
                              onClick={() => handleTransition(reg.id, "approved")}
                              className="cursor-pointer rounded-[10px] border border-[#DCFCE7] px-2.5 py-1.5 text-[11px] font-semibold text-[#16A34A] transition hover:bg-[#DCFCE7] active:scale-[0.97] disabled:opacity-50"
                            >
                              <FiCheck size={11} className="inline mr-1" />Aprobar
                            </button>
                            <button
                              type="button"
                              disabled={busy === reg.id}
                              onClick={() => handleTransition(reg.id, "rejected")}
                              className="cursor-pointer rounded-[10px] border border-[#FEE2E2] px-2.5 py-1.5 text-[11px] font-semibold text-[#DC2626] transition hover:bg-[#FEE2E2] active:scale-[0.97] disabled:opacity-50"
                            >
                              <FiSlash size={11} className="inline mr-1" />Rechazar
                            </button>
                            {reg.regularization_type === "missing_clock_in" && (
                              <button
                                type="button"
                                disabled={busy === reg.id}
                                onClick={() => setApplyModal({ date: reg.attendance_date, entryTime: reg.requested_timestamp ? fmtTime(reg.requested_timestamp) : "09:00" })}
                                className="cursor-pointer rounded-[10px] bg-[#2563EB] px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#1D4ED8] active:scale-[0.97] disabled:opacity-50"
                              >
                                Aplicar entrada
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            !pendingEntries.length && (
              <EmptySection icon={FiCheck} title="Sin regularizaciones" description="El colaborador no tiene solicitudes de regularizacion registradas." />
            )
          )}
        </div>
      )}

      {/* Modal: aplicar entrada */}
      {applyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-[20px] bg-white p-6 shadow-xl">
            <h3 className="mb-1 text-base font-semibold text-[#1F2937]">Aplicar entrada regularizada</h3>
            <p className="mb-4 text-xs text-[#6B7280]">
              Fecha: <strong>{fmtDate(applyModal.date)}</strong> · Ingresa la hora de entrada a registrar
            </p>
            <div className="mb-5 flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-[#6B7280]">Hora de entrada</label>
              <input
                type="time"
                value={applyModal.entryTime}
                onChange={(e) => setApplyModal((prev) => ({ ...prev, entryTime: e.target.value }))}
                className="rounded-[12px] border border-[#D1D5DB] px-3 py-2.5 font-mono text-sm text-[#1F2937] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#0EA5E9]/20"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setApplyModal(null)}
                className="cursor-pointer rounded-[12px] px-4 py-2 text-sm font-medium text-[#6B7280] hover:bg-[#F3F4F6]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={handleApplyEntry}
                className="cursor-pointer rounded-[12px] bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1D4ED8] active:scale-[0.97] disabled:opacity-50"
              >
                Aplicar entrada
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Expediente panel ─────────────────────────────────────────────────────────

const GeneralRegularizationsModal = ({ open, onClose }) => {
  const [filters, setFilters] = useState({
    search: "",
    startDate: "",
    endDate: "",
    regularizationType: "",
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState({});
  const [selectedFormal, setSelectedFormal] = useState({});
  const [entryTimes, setEntryTimes] = useState({});

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const res = await getAttendanceRegularizationsPanel(filters);
      setData(res?.data || null);
    } catch (err) {
      toast.error(err?.response?.data?.message || "No se pudo cargar la regularizacion general.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filters, open]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const rows = Array.isArray(data?.pending_entry_regularizations)
      ? data.pending_entry_regularizations
      : [];
    const nextTimes = {};
    rows.forEach((row) => {
      const key = `${row.user_id}:${normalizeAttendanceDateValue(row.date)}`;
      nextTimes[key] = row.entry_time ? fmtTime(row.entry_time) : "09:00";
    });
    setEntryTimes(nextTimes);
    setSelectedEntries({});
    setSelectedFormal({});
  }, [data, open]);

  const pendingEntries = Array.isArray(data?.pending_entry_regularizations)
    ? data.pending_entry_regularizations
    : [];
  const formalRegs = Array.isArray(data?.formal_regularizations)
    ? data.formal_regularizations
    : [];
  const summary = data?.summary || {};

  const selectedEntryRows = pendingEntries.filter((row) => {
    const key = `${row.user_id}:${normalizeAttendanceDateValue(row.date)}`;
    return selectedEntries[key];
  });
  const selectedFormalRows = formalRegs.filter((row) => selectedFormal[row.id]);

  const handleToggleAllEntries = () => {
    const shouldSelectAll = selectedEntryRows.length !== pendingEntries.length;
    setSelectedEntries(
      shouldSelectAll
        ? pendingEntries.reduce((acc, row) => {
            acc[`${row.user_id}:${normalizeAttendanceDateValue(row.date)}`] = true;
            return acc;
          }, {})
        : {}
    );
  };

  const handleToggleAllFormal = () => {
    const shouldSelectAll = selectedFormalRows.length !== formalRegs.length;
    setSelectedFormal(
      shouldSelectAll
        ? formalRegs.reduce((acc, row) => {
            acc[row.id] = true;
            return acc;
          }, {})
        : {}
    );
  };

  const handleBatchApplyEntries = async () => {
    if (!selectedEntryRows.length) return;
    setSubmitting(true);
    let okCount = 0;
    let failCount = 0;
    for (const row of selectedEntryRows) {
      const date = normalizeAttendanceDateValue(row.date);
      const key = `${row.user_id}:${date}`;
      try {
        await applyEntryRegularization({
          userId: row.user_id,
          date,
          entryTime: entryTimes[key] || "09:00",
        });
        okCount += 1;
      } catch {
        failCount += 1;
      }
    }
    setSubmitting(false);
    if (okCount) toast.success(`${okCount} entrada(s) regularizada(s).`);
    if (failCount) toast.error(`${failCount} regularizacion(es) no se pudieron aplicar.`);
    await load();
  };

  const handleBatchTransition = async (status) => {
    if (!selectedFormalRows.length) return;
    setSubmitting(true);
    let okCount = 0;
    let failCount = 0;
    for (const row of selectedFormalRows) {
      try {
        await transitionAttendanceRegularization(row.id, { status });
        okCount += 1;
      } catch {
        failCount += 1;
      }
    }
    setSubmitting(false);
    if (okCount) {
      toast.success(
        `${okCount} solicitud(es) ${status === "approved" ? "aprobada(s)" : "rechazada(s)"}`
      );
    }
    if (failCount) toast.error(`${failCount} solicitud(es) no se pudieron actualizar.`);
    await load();
  };

  return (
    <Modal
      open={open}
      onClose={() => !submitting && onClose?.()}
      title="Regularizacion general"
      maxWidth="max-w-6xl"
    >
      <div className="space-y-5">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
              Buscar colaborador
            </span>
            <div className="flex h-11 items-center gap-2 rounded-[14px] border border-[#D1D5DB] px-3 focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-[#0EA5E9]/20">
              <FiSearch size={14} className="text-[#9CA3AF]" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                placeholder="Nombre, correo, cargo o cedula"
                className="w-full bg-transparent text-sm text-[#1F2937] outline-none placeholder:text-[#9CA3AF]"
              />
            </div>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
              Desde
            </span>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
              className="h-11 rounded-[14px] border border-[#D1D5DB] px-3 text-sm text-[#1F2937] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#0EA5E9]/20"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
              Hasta
            </span>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
              className="h-11 rounded-[14px] border border-[#D1D5DB] px-3 text-sm text-[#1F2937] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#0EA5E9]/20"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
              Tipo formal
            </span>
            <select
              value={filters.regularizationType}
              onChange={(e) => setFilters((prev) => ({ ...prev, regularizationType: e.target.value }))}
              className="h-11 rounded-[14px] border border-[#D1D5DB] px-3 text-sm text-[#1F2937] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#0EA5E9]/20"
            >
              {GENERAL_REGULARIZATION_TYPE_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-[16px] border border-[#E5E7EB] bg-[#F9FAFB] p-3">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#1F2937] shadow-sm">
            Total: {summary.total ?? 0}
          </span>
          <span className="rounded-full bg-[#FFFBEB] px-3 py-1 text-xs font-semibold text-[#B45309]">
            Entradas pendientes: {summary.pending_entries ?? 0}
          </span>
          <span className="rounded-full bg-[#EFF6FF] px-3 py-1 text-xs font-semibold text-[#1D4ED8]">
            Solicitudes formales de regularizacion: {summary.formal_pending ?? 0}
          </span>
          <button
            type="button"
            onClick={load}
            disabled={loading || submitting}
            className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-[12px] border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-semibold text-[#1F2937] transition hover:bg-[#F3F4F6] disabled:cursor-wait disabled:opacity-60"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} size={12} />
            Actualizar listado
          </button>
        </div>

        {loading ? (
          <div className="flex h-56 items-center justify-center">
            <FiRefreshCw className="animate-spin text-[#D1D5DB]" size={22} />
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[1.05fr_1fr]">
            <section className="overflow-hidden rounded-[20px] border border-[#FDE68A] bg-[#FFFBEB]">
              <div className="flex flex-wrap items-center gap-2 border-b border-[#FDE68A] px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#92400E]">Entradas pendientes</h3>
                  <p className="text-xs text-[#B45309]">
                    Solicitudes directas con incumplimiento de entrada faltante.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleAllEntries}
                  disabled={!pendingEntries.length || submitting}
                  className="ml-auto cursor-pointer rounded-[10px] border border-[#FCD34D] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#92400E] transition hover:bg-[#FEF3C7] disabled:opacity-50"
                >
                  {selectedEntryRows.length === pendingEntries.length && pendingEntries.length
                    ? "Quitar seleccion"
                    : "Seleccionar todas"}
                </button>
                <button
                  type="button"
                  onClick={handleBatchApplyEntries}
                  disabled={!selectedEntryRows.length || submitting}
                  className="cursor-pointer rounded-[10px] bg-[#2563EB] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#1D4ED8] disabled:opacity-50"
                >
                  Aplicar seleccionadas ({selectedEntryRows.length})
                </button>
              </div>
              <div className="max-h-[62dvh] space-y-2 overflow-y-auto p-3">
                {!pendingEntries.length ? (
                  <EmptySection
                    icon={FiCheck}
                    title="Sin entradas pendientes"
                    description="No hay entradas faltantes pendientes con los filtros actuales."
                  />
                ) : (
                  pendingEntries.map((row) => {
                    const key = `${row.user_id}:${normalizeAttendanceDateValue(row.date)}`;
                    return (
                      <label
                        key={key}
                        className="flex flex-col gap-3 rounded-[16px] border border-[#FDE68A] bg-white p-4"
                      >
                        <div className="flex flex-wrap items-start gap-3">
                          <input
                            type="checkbox"
                            checked={Boolean(selectedEntries[key])}
                            onChange={(e) =>
                              setSelectedEntries((prev) => ({ ...prev, [key]: e.target.checked }))
                            }
                            className="mt-1 h-4 w-4 rounded border-[#D1D5DB] text-[#2563EB] focus:ring-[#0EA5E9]"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-[#1F2937]">{row.fullname}</span>
                              <span className="rounded-full bg-[#FFFBEB] px-2 py-0.5 text-[10px] font-semibold text-[#B45309]">
                                {fmtDate(row.date)}
                              </span>
                            </div>
                            <p className="text-xs text-[#6B7280]">
                              {row.cargo || "Sin cargo"}
                              {row.department_name ? ` · ${row.department_name}` : ""}
                            </p>
                            <p className="text-[11px] font-semibold text-[#B45309]">
                              Incumplimiento: Entrada faltante
                            </p>
                            <p className="font-mono text-[11px] text-[#9CA3AF]">
                              {row.email || "--"}
                              {row.cedula ? ` · CI ${row.cedula}` : ""}
                            </p>
                            {row.reason ? (
                              <div className="rounded-[12px] border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-xs text-[#92400E]">
                                <span className="font-semibold">Observacion:</span> {row.reason}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-end gap-3">
                          <label className="flex min-w-[180px] flex-col gap-1">
                            <span className="text-[11px] font-semibold text-[#6B7280]">Hora de entrada</span>
                            <input
                              type="time"
                              value={entryTimes[key] || "09:00"}
                              onChange={(e) =>
                                setEntryTimes((prev) => ({ ...prev, [key]: e.target.value }))
                              }
                              className="h-10 rounded-[12px] border border-[#D1D5DB] px-3 font-mono text-sm text-[#1F2937] outline-none focus:border-[#2563EB]"
                            />
                          </label>
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={async () => {
                              setSubmitting(true);
                              try {
                                await applyEntryRegularization({
                                  userId: row.user_id,
                                  date: normalizeAttendanceDateValue(row.date),
                                  entryTime: entryTimes[key] || "09:00",
                                });
                                toast.success("Entrada regularizada correctamente.");
                                await load();
                              } catch (err) {
                                toast.error(err?.response?.data?.message || "Error al aplicar entrada.");
                              } finally {
                                setSubmitting(false);
                              }
                            }}
                            className="cursor-pointer rounded-[12px] border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-xs font-semibold text-[#1D4ED8] transition hover:bg-[#DBEAFE] disabled:opacity-50"
                          >
                            Aplicar ahora
                          </button>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </section>

            <section className="overflow-hidden rounded-[20px] border border-[#DBEAFE] bg-[#F8FBFF]">
              <div className="flex flex-wrap items-center gap-2 border-b border-[#DBEAFE] px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#1D4ED8]">Solicitudes formales de regularizacion</h3>
                  <p className="text-xs text-[#4B5563]">
                    Aprobacion o rechazo masivo de solicitudes formales pendientes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleAllFormal}
                  disabled={!formalRegs.length || submitting}
                  className="ml-auto cursor-pointer rounded-[10px] border border-[#BFDBFE] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#1D4ED8] transition hover:bg-[#EFF6FF] disabled:opacity-50"
                >
                  {selectedFormalRows.length === formalRegs.length && formalRegs.length
                    ? "Quitar seleccion"
                    : "Seleccionar todas"}
                </button>
                <button
                  type="button"
                  onClick={() => handleBatchTransition("approved")}
                  disabled={!selectedFormalRows.length || submitting}
                  className="cursor-pointer rounded-[10px] border border-[#DCFCE7] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#16A34A] transition hover:bg-[#DCFCE7] disabled:opacity-50"
                >
                  Aprobar ({selectedFormalRows.length})
                </button>
                <button
                  type="button"
                  onClick={() => handleBatchTransition("rejected")}
                  disabled={!selectedFormalRows.length || submitting}
                  className="cursor-pointer rounded-[10px] border border-[#FEE2E2] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#DC2626] transition hover:bg-[#FEE2E2] disabled:opacity-50"
                >
                  Rechazar ({selectedFormalRows.length})
                </button>
              </div>
              <div className="max-h-[62dvh] space-y-2 overflow-y-auto p-3">
                {!formalRegs.length ? (
                  <EmptySection
                    icon={FiCheck}
                    title="Sin solicitudes formales"
                    description="No hay solicitudes formales pendientes con los filtros actuales."
                  />
                ) : (
                  formalRegs.map((row) => (
                    <label
                      key={row.id}
                      className="flex flex-col gap-3 rounded-[16px] border border-[#DBEAFE] bg-white p-4"
                    >
                      <div className="flex flex-wrap items-start gap-3">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedFormal[row.id])}
                          onChange={(e) =>
                            setSelectedFormal((prev) => ({ ...prev, [row.id]: e.target.checked }))
                          }
                          className="mt-1 h-4 w-4 rounded border-[#D1D5DB] text-[#2563EB] focus:ring-[#0EA5E9]"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-[#1F2937]">{row.affected_name}</span>
                            <span className="rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-semibold text-[#1D4ED8]">
                              {REG_TYPE_LABEL[row.regularization_type] || row.regularization_type}
                            </span>
                            <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-semibold text-[#6B7280]">
                              {fmtDate(row.attendance_date)}
                            </span>
                          </div>
                          <p className="text-xs text-[#6B7280]">
                            {row.cargo || "Sin cargo"}
                            {row.department_name ? ` · ${row.department_name}` : ""}
                          </p>
                          <p className="text-[11px] font-semibold text-[#1D4ED8]">
                            Incumplimiento: {REG_TYPE_LABEL[row.regularization_type] || row.regularization_type}
                          </p>
                          <p className="font-mono text-[11px] text-[#9CA3AF]">
                            {row.affected_email || "--"}
                            {row.cedula ? ` · CI ${row.cedula}` : ""}
                          </p>
                          {row.reason ? (
                            <div className="rounded-[12px] border border-[#DBEAFE] bg-[#F8FBFF] px-3 py-2 text-xs text-[#374151]">
                              <span className="font-semibold text-[#1D4ED8]">Observacion:</span> {row.reason}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </Modal>
  );
};

const ExpedientePanel = ({ detail, loading, onScheduleMeeting, onDownloadRh, pLabel, range, canManageTelework = false }) => {
  const [activeTab, setActiveTab] = useState(TABS.MARKS);
  const [selectedMark, setSelectedMark] = useState(null);

  useEffect(() => { setActiveTab(TABS.MARKS); }, [detail]);
  useEffect(() => { setSelectedMark(null); }, [activeTab, detail]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <FiRefreshCw className="animate-spin text-[#D1D5DB]" size={22} />
      </div>
    );
  }

  const collaborator = detail?.data?.collaborator;

  if (!collaborator) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16">
        <FiUser size={26} className="text-[#D1D5DB]" />
        <p className="text-sm font-semibold text-[#1F2937]">Selecciona un expediente</p>
        <p className="max-w-64 text-center text-xs text-[#6B7280]">
          Elige un colaborador en la lista para ver su reporte detallado de asistencia.
        </p>
      </div>
    );
  }

  const summary = detail.data.summary || {};
  const rows = Array.isArray(detail.data.rows) ? detail.data.rows : [];
  const incidents = Array.isArray(detail.data.incidents) ? detail.data.incidents : [];
  const permissions = Array.isArray(detail.data.permissions) ? detail.data.permissions : [];
  const breachCount = Number(summary.breaches_total || 0);

  const STATS = [
    { label: "Marcaciones",     value: summary.attendance_days ?? "--",  tone: "default" },
    { label: "Cerradas",        value: summary.completed_days ?? "--",   tone: "green" },
    { label: "Incumplimientos", value: breachCount,                       tone: breachCount > 0 ? "red" : "green" },
    { label: "Extra real",      value: fmtOvertime(summary), tone: "default" },
    { label: "Horas oper.",     value: fmtHours(summary.operational_hours),   tone: "default" },
  ];

  const VAL_COLOR = { red: "text-[#DC2626]", green: "text-[#16A34A]", amber: "text-[#D97706]", default: "text-[#1F2937]" };

  return (
    <div className="flex flex-col overflow-hidden">
      {/* Collaborator header */}
      <div className="flex flex-col gap-3 border-b border-[#F3F4F6] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#1E293B] text-sm font-semibold text-white">
            {getInitials(collaborator.fullname)}
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#1F2937]">{collaborator.fullname}</h2>
            <p className="text-xs text-[#6B7280]">
              {collaborator.cargo || "Sin cargo"}
              {collaborator.department_name ? ` · ${collaborator.department_name}` : ""}
            </p>
            <p className="font-mono text-[11px] text-[#D1D5DB]">
              CI: {collaborator.cedula || "--"} · {collaborator.email || "--"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDownloadRh}
          className="cursor-pointer inline-flex items-center gap-1.5 self-start rounded-[12px] border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-semibold text-[#1F2937] shadow-[0_2px_10px_rgba(0,0,0,0.06)] transition hover:bg-[#F9FAFB] active:scale-[0.97]"
        >
          <FiDownload size={12} />
          Descargar F-RH
        </button>
      </div>

      {/* Mini stats */}
      <div className="flex divide-x divide-[#F3F4F6] overflow-x-auto border-b border-[#F3F4F6]">
        {STATS.map((s) => (
          <div key={s.label} className="flex min-w-[90px] flex-col gap-0.5 px-4 py-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">{s.label}</span>
            <span className={`font-mono text-base font-semibold ${VAL_COLOR[s.tone]}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-[#F3F4F6] px-4 py-2.5">
        {[
          { key: TABS.MARKS,    label: "Marcaciones" },
          { key: TABS.PERMISSIONS, label: permissions.length > 0 ? `Permisos (${permissions.length})` : "Permisos" },
          { key: TABS.BREACHES, label: breachCount > 0 ? `Incumplimientos (${breachCount})` : "Incumplimientos" },
          { key: TABS.OVERTIME, label: "Horas extra" },
          { key: TABS.EXITS,    label: "Marcaciones operacionales" },
          { key: TABS.MAP,      label: "Mapa" },
          { key: TABS.GESTION,  label: "Gestión" },
        ].map((tab) => (
          <TabBtn key={tab.key} active={activeTab === tab.key} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </TabBtn>
        ))}
        {activeTab === TABS.BREACHES && incidents.length > 0 && (
          <button
            type="button"
            onClick={() => {
              exportCsv(
                incidents,
                `incumplimientos_${String(collaborator.fullname || "colaborador").replace(/\s+/g, "_")}.csv`
              );
              toast.success("Exportado.");
            }}
            className="cursor-pointer ml-auto flex items-center gap-1.5 rounded-[12px] border border-[#E5E7EB] px-3 py-1.5 text-xs font-medium text-[#6B7280] hover:bg-[#F9FAFB] active:scale-[0.97]"
          >
            <FiDownload size={12} />
            Exportar
          </button>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {(activeTab === TABS.MARKS || activeTab === TABS.EXITS) && selectedMark?.point ? (
          <SelectedMarkPanel selectedMark={selectedMark} onClose={() => setSelectedMark(null)} />
        ) : null}

        {activeTab === TABS.MARKS && (
          <div className="p-4">
            <MarksTable rows={rows} variant="regularized" onMarkClick={setSelectedMark} />
          </div>
        )}

        {activeTab === TABS.PERMISSIONS && <PermissionsTab permissions={permissions} rows={rows} />}

        {activeTab === TABS.BREACHES && (
          <div className="space-y-2 p-4">
            {incidents.length ? (
              incidents.map((breach, idx) => (
                <BreachRow
                  key={`${breach.date}-${breach.breach_type}-${idx}`}
                  breach={breach}
                  onSchedule={(b) =>
                    onScheduleMeeting({ userId: collaborator.user_id, fullname: collaborator.fullname, breach: b })
                  }
                />
              ))
            ) : (
              <EmptySection
                icon={FiCheck}
                title="Sin incumplimientos"
                description="El colaborador no registra novedades de asistencia en este periodo."
              />
            )}
          </div>
        )}

        {activeTab === TABS.OVERTIME && <OvertimeTab rows={rows} incidents={incidents} />}

        {activeTab === TABS.EXITS && <ExitsTab rows={rows} onMarkClick={setSelectedMark} />}

        {activeTab === TABS.MAP && (
          <div className="p-4">
            <AttendanceMapView
              rows={rows}
              getGeoPoints={(row) => row.geo_points || []}
              selectedUserId={collaborator.user_id}
            />
          </div>
        )}

        {activeTab === TABS.GESTION && (
          <GestionTab userId={collaborator.user_id} rows={rows} range={range} canManageTelework={canManageTelework} />
        )}
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const AsistenciaReportes = () => {
  const { user } = useAuth();
  const canManageTelework = hasExactTalentHumanRole(user);
  const [periodMode, setPeriodMode] = useState(PM.MONTH);
  const [dayValue, setDayValue] = useState(todayIso());
  const [monthValue, setMonthValue] = useState(currentMonth());
  const [yearValue, setYearValue] = useState(currentYear());
  const [search, setSearch] = useState("");

  const [overview, setOverview] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [downloadingBulkRh, setDownloadingBulkRh] = useState(false);
  const [downloadingMonthlyReport, setDownloadingMonthlyReport] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [meetingTarget, setMeetingTarget] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [generalRegularizationsOpen, setGeneralRegularizationsOpen] = useState(false);

  const range = useMemo(
    () => buildRange(periodMode, dayValue, monthValue, yearValue),
    [periodMode, dayValue, monthValue, yearValue]
  );

  const pLabel = useMemo(() => buildPeriodLabel(periodMode, range), [periodMode, range]);

  const loadOverview = useCallback(async () => {
    if (!range?.startDate || !range?.endDate) return;
    setLoadingOverview(true);
    try {
      const res = await getAttendanceWorkspaceOverview({
        startDate: range.startDate,
        endDate: range.endDate,
        search,
      });
      setOverview(res);
    } catch (err) {
      toast.error(err?.response?.data?.message || "No se pudo cargar la reporteria de asistencia.");
      setOverview(null);
    } finally {
      setLoadingOverview(false);
    }
  }, [range?.startDate, range?.endDate, search]);

  const loadDetail = useCallback(async () => {
    if (!selectedId || !range?.startDate || !range?.endDate) {
      setDetail(null);
      return;
    }
    setLoadingDetail(true);
    try {
      const res = await getAttendanceWorkspaceCollaborator(selectedId, {
        startDate: range.startDate,
        endDate: range.endDate,
      });
      setDetail(res);
    } catch (err) {
      toast.error(err?.response?.data?.message || "No se pudo cargar el expediente.");
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, [selectedId, range?.startDate, range?.endDate]);

  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => { loadDetail(); }, [loadDetail]);

  useEffect(() => {
    if (!overview?.data?.length) return;
    const ids = new Set(overview.data.map((c) => Number(c.user_id)));
    if (selectedId && !ids.has(Number(selectedId))) {
      setSelectedId(null);
      setDetail(null);
    }
  }, [overview, selectedId]);

  const collaborators = useMemo(() => {
    const list = Array.isArray(overview?.data) ? overview.data : [];
    return [...list].sort(
      (a, b) => Number(b.metrics?.breaches_total || 0) - Number(a.metrics?.breaches_total || 0)
    );
  }, [overview]);

  const handleSelectCollaborator = (id) => {
    setSelectedId(Number(id));
    setShowDetail(true);
  };

  const handleDownloadRh = async () => {
    if (!selectedId || !range?.startDate || !range?.endDate) return;
    try {
      await downloadAttendancePDF(selectedId, range.startDate, range.endDate, {
        periodType: periodMode === PM.YEAR ? "annual" : "monthly",
        year: periodMode === PM.YEAR ? Number(yearValue) : undefined,
      });
      toast.success("Formato F-RH descargado.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "No se pudo descargar el formato F-RH.");
    }
  };

  const handleDownloadBulkRh = async () => {
    if (!range?.startDate || !range?.endDate || downloadingBulkRh) return;
    setDownloadingBulkRh(true);
    try {
      await downloadAttendanceBulkPDF({
        startDate: range.startDate,
        endDate: range.endDate,
        periodType: periodMode === PM.YEAR ? "annual" : "monthly",
        year: periodMode === PM.YEAR ? Number(yearValue) : undefined,
        search,
      });
      toast.success("Formato F-RH general descargado.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "No se pudo descargar el F-RH general.");
    } finally {
      setDownloadingBulkRh(false);
    }
  };

  const handleDownloadMonthlyReport = async (format = "pdf") => {
    if (!range?.startDate || !range?.endDate || downloadingMonthlyReport) return;
    setDownloadingMonthlyReport(true);
    try {
      await downloadAttendanceMonthlyReport({
        start: range.startDate,
        end: range.endDate,
        search,
        format,
      });
      toast.success(format === "excel" ? "Reporte Excel descargado." : "Reporte PDF descargado.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "No se pudo generar el reporte mensual.");
    } finally {
      setDownloadingMonthlyReport(false);
    }
  };

  const s = overview?.summary || {};
  const OVERVIEW_STATS = [
    { label: "Expedientes",      value: s.collaborators_total ?? "--",        tone: "default" },
    { label: "Con incumpl.",     value: s.collaborators_with_breaches ?? "--", tone: Number(s.collaborators_with_breaches || 0) > 0 ? "amber" : "default" },
    { label: "Incumplimientos",  value: s.breaches_total ?? "--",              tone: Number(s.breaches_total || 0) > 0 ? "red" : "default" },
    { label: "Extra real",       value: fmtOvertime(s),       tone: "default" },
    { label: "Horas oper.",      value: fmtHours(s.operational_hours),         tone: "default" },
  ];
  const STAT_COLOR = { red: "text-[#DC2626]", amber: "text-[#D97706]", default: "text-[#1F2937]" };

  return (
    <div className={`${WORKSPACE_PAGE_CLASS} gap-4`}>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1.5 inline-flex items-center rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
            Talento Humano
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-[#1F2937]">Asistencia por expediente</h1>
          <p className="text-xs text-[#6B7280]">{pLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setGeneralRegularizationsOpen(true)}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-[12px] border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-semibold text-[#1F2937] shadow-[0_2px_10px_rgba(0,0,0,0.06)] transition hover:bg-[#F9FAFB] active:scale-[0.97]"
          >
            <FiEdit2 size={12} />
            Regularizacion general
          </button>
          <button
            type="button"
            onClick={loadOverview}
            disabled={loadingOverview}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-[12px] border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-semibold text-[#6B7280] shadow-[0_2px_10px_rgba(0,0,0,0.06)] transition hover:bg-[#F9FAFB] active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
          >
            <FiRefreshCw className={loadingOverview ? "animate-spin" : ""} size={12} />
            Actualizar
          </button>
          <button
            type="button"
            onClick={handleDownloadBulkRh}
            disabled={downloadingBulkRh}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-[12px] border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-semibold text-[#1F2937] shadow-[0_2px_10px_rgba(0,0,0,0.06)] transition hover:bg-[#F9FAFB] active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
          >
            <FiDownload className={downloadingBulkRh ? "animate-spin" : ""} size={12} />
            {downloadingBulkRh ? "Generando..." : "F-RH general"}
          </button>
          <button
            type="button"
            onClick={() => handleDownloadMonthlyReport("pdf")}
            disabled={downloadingMonthlyReport}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-[12px] border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-semibold text-[#1F2937] shadow-[0_2px_10px_rgba(0,0,0,0.06)] transition hover:bg-[#F9FAFB] active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
          >
            <FiDownload className={downloadingMonthlyReport ? "animate-spin" : ""} size={12} />
            {downloadingMonthlyReport ? "Generando..." : "Reporte PDF"}
          </button>
          <button
            type="button"
            onClick={() => handleDownloadMonthlyReport("excel")}
            disabled={downloadingMonthlyReport}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-[12px] border border-[#D9E8C8] bg-[#F6FBEF] px-3.5 py-2 text-xs font-semibold text-[#3F6212] shadow-[0_2px_10px_rgba(0,0,0,0.06)] transition hover:bg-[#EEF8DE] active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
          >
            <FiDownload className={downloadingMonthlyReport ? "animate-spin" : ""} size={12} />
            {downloadingMonthlyReport ? "Generando..." : "Reporte Excel"}
          </button>
        </div>
      </div>

      {/* Toolbar: period + search */}
      <div className="rounded-[16px] border border-[#E5E7EB] bg-white px-4 py-3 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
        <div className="flex flex-wrap items-center gap-3">
          {/* Period pills */}
          <div className="flex items-center gap-0.5 rounded-full bg-[#F3F4F6] p-1">
            {[{ key: PM.DAY, label: "Hoy" }, { key: PM.MONTH, label: "Mes" }, { key: PM.YEAR, label: "Año" }].map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setPeriodMode(opt.key)}
                className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition active:scale-[0.97] ${
                  periodMode === opt.key
                    ? "bg-white text-[#1F2937] shadow-[0_1px_4px_rgba(0,0,0,0.08)]"
                    : "text-[#6B7280] hover:text-[#1F2937]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Date picker */}
          {periodMode === PM.DAY && (
            <input type="date" value={dayValue} onChange={(e) => setDayValue(e.target.value)}
              className="h-9 rounded-[12px] border border-[#D1D5DB] px-3 text-sm text-[#1F2937] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#0EA5E9]/20"
            />
          )}
          {periodMode === PM.MONTH && (
            <input type="month" value={monthValue} onChange={(e) => setMonthValue(e.target.value)}
              className="h-9 rounded-[12px] border border-[#D1D5DB] px-3 text-sm text-[#1F2937] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#0EA5E9]/20"
            />
          )}
          {periodMode === PM.YEAR && (
            <input type="number" min="2020" max="2100" value={yearValue} onChange={(e) => setYearValue(e.target.value)}
              className="h-9 w-24 rounded-[12px] border border-[#D1D5DB] px-3 text-sm text-[#1F2937] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#0EA5E9]/20"
            />
          )}

          {/* Search */}
          <div className="flex h-9 min-w-[180px] flex-1 items-center gap-2 rounded-[12px] border border-[#D1D5DB] px-3 focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-[#0EA5E9]/20">
            <FiSearch size={13} className="shrink-0 text-[#D1D5DB]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre, cedula o cargo"
              className="w-full bg-transparent text-sm text-[#1F2937] outline-none placeholder:text-[#D1D5DB]"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="cursor-pointer text-[#D1D5DB] hover:text-[#6B7280]">
                <FiX size={12} />
              </button>
            )}
          </div>
        </div>

        {overview?.meta?.warnings?.length ? (
          <div className="mt-2.5 rounded-[10px] bg-[#FEF3C7] px-3 py-2 text-xs text-[#D97706]">
            {overview.meta.warnings[0]}
          </div>
        ) : null}
      </div>

      {/* Summary stats strip */}
      <div className="flex flex-wrap divide-x divide-[#F3F4F6] overflow-hidden rounded-[16px] border border-[#E5E7EB] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
        {OVERVIEW_STATS.map((stat) => (
          <div key={stat.label} className="flex min-w-[100px] flex-1 flex-col gap-0.5 px-4 py-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">{stat.label}</span>
            <span className={`font-mono text-xl font-semibold ${STAT_COLOR[stat.tone] || STAT_COLOR.default}`}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* Collaborator list */}
        <div
          className={`flex flex-col rounded-[16px] border border-[#E5E7EB] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] ${
            showDetail ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="flex items-center justify-between border-b border-[#F3F4F6] px-4 py-3">
            <span className="text-sm font-semibold text-[#1F2937]">Expedientes</span>
            <span className="rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-xs font-semibold text-[#6B7280]">
              {collaborators.length}
            </span>
          </div>

          <div className="max-h-[72vh] overflow-y-auto p-2">
            {loadingOverview ? (
              <div className="flex h-40 items-center justify-center">
                <FiRefreshCw className="animate-spin text-[#D1D5DB]" size={20} />
              </div>
            ) : collaborators.length ? (
              <div className="space-y-0.5">
                {collaborators.map((collab) => {
                  const breaches = Number(collab.metrics?.breaches_total || 0);
                  const isActive = Number(selectedId) === Number(collab.user_id);
                  return (
                    <button
                      key={collab.user_id}
                      type="button"
                      onClick={() => handleSelectCollaborator(collab.user_id)}
                      className={`group w-full cursor-pointer rounded-[12px] px-3 py-2.5 text-left transition active:scale-[0.98] ${
                        isActive ? "bg-[#1E293B]" : "hover:bg-[#F9FAFB]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                          isActive ? "bg-white/10 text-white" : "bg-[#F3F4F6] text-[#6B7280]"
                        }`}>
                          {getInitials(collab.fullname)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-xs font-semibold ${isActive ? "text-white" : "text-[#1F2937]"}`}>
                            {collab.fullname}
                          </p>
                          <p className={`truncate text-[11px] ${isActive ? "text-white/50" : "text-[#6B7280]"}`}>
                            {collab.cargo || "Sin cargo"}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          {breaches > 0 ? (
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              isActive ? "bg-[#DC2626]/20 text-[#FCA5A5]" : "bg-[#FEE2E2] text-[#DC2626]"
                            }`}>
                              {breaches}
                            </span>
                          ) : (
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              isActive ? "bg-white/10 text-white/60" : "bg-[#DCFCE7] text-[#16A34A]"
                            }`}>
                              OK
                            </span>
                          )}
                          {Number(collab.metrics?.real_overtime_hours || 0) > 0 && (
                            <span className={`font-mono text-[10px] ${isActive ? "text-white/40" : "text-[#6B7280]"}`}>
                              +{fmtOvertime(collab.metrics)}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptySection
                icon={FiUsers}
                title="Sin expedientes"
                description="Ajusta el periodo o el buscador para cargar colaboradores."
              />
            )}
          </div>
        </div>

        {/* Expediente detail panel */}
        <div
          className={`flex flex-col overflow-hidden rounded-[16px] border border-[#E5E7EB] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] ${
            showDetail ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Mobile back */}
          {showDetail && (
            <div className="flex items-center border-b border-[#F3F4F6] px-4 py-3 lg:hidden">
              <button
                type="button"
                onClick={() => setShowDetail(false)}
                className="cursor-pointer flex items-center gap-1.5 text-xs font-semibold text-[#2563EB] active:scale-[0.97]"
              >
                <FiArrowLeft size={13} />
                Volver a la lista
              </button>
            </div>
          )}

          <ExpedientePanel
            detail={detail}
            loading={loadingDetail}
            pLabel={pLabel}
            range={range}
            onScheduleMeeting={setMeetingTarget}
            onDownloadRh={handleDownloadRh}
            canManageTelework={canManageTelework}
          />
        </div>
      </div>

      {meetingTarget && (
        <MeetingModal
          target={meetingTarget}
          onClose={() => setMeetingTarget(null)}
          onScheduled={async () => {
            await Promise.all([loadOverview(), loadDetail()]);
          }}
        />
      )}
      <GeneralRegularizationsModal
        open={generalRegularizationsOpen}
        onClose={() => setGeneralRegularizationsOpen(false)}
      />
    </div>
  );
};

export default AsistenciaReportes;
