import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiFileText, FiArrowRight, FiClock, FiCheck, FiX, FiUpload } from "react-icons/fi";
import { getMisSolicitudes } from "../../../../core/api/permisosApi";
import { getTipoLabel, formatDateShort } from "../utils/solicitudesHelpers";

const ACTIVE_STATUSES = ["pending", "partially_approved", "pending_final"];

const STATUS_MAP = {
  pending:            { label: "Pendiente",        bg: "bg-[#FEF3C7]", text: "text-[#D97706]",  icon: FiClock },
  partially_approved: { label: "Subir docs",        bg: "bg-blue-50",   text: "text-blue-700",   icon: FiUpload },
  pending_final:      { label: "Esp. final",        bg: "bg-purple-50", text: "text-purple-700", icon: FiClock },
  approved:           { label: "Aprobado",          bg: "bg-[#DCFCE7]", text: "text-[#16A34A]",  icon: FiCheck },
  aprobado:           { label: "Aprobado",          bg: "bg-[#DCFCE7]", text: "text-[#16A34A]",  icon: FiCheck },
  rejected:           { label: "Rechazado",         bg: "bg-[#FEE2E2]", text: "text-[#DC2626]",  icon: FiX },
  rechazado:          { label: "Rechazado",         bg: "bg-[#FEE2E2]", text: "text-[#DC2626]",  icon: FiX },
  cancelled:          { label: "Cancelado",         bg: "bg-[#F3F4F6]", text: "text-[#6B7280]",  icon: FiX },
  cancelado:          { label: "Cancelado",         bg: "bg-[#F3F4F6]", text: "text-[#6B7280]",  icon: FiX },
};

const StatusBadge = ({ status }) => {
  const meta = STATUS_MAP[status] || STATUS_MAP.pending;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.bg} ${meta.text}`}>
      <Icon size={10} />
      {meta.label}
    </span>
  );
};

const PermisosCompactCard = () => {
  const navigate = useNavigate();
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMisSolicitudes()
      .then((res) => {
        const rows = Array.isArray(res)
          ? res
          : Array.isArray(res?.rows)
          ? res.rows
          : Array.isArray(res?.data)
          ? res.data
          : [];
        setSolicitudes(rows);
      })
      .catch(() => setSolicitudes([]))
      .finally(() => setLoading(false));
  }, []);

  const active = solicitudes.filter((s) => ACTIVE_STATUSES.includes(s.status));
  const recent = solicitudes.slice(0, 3);

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-[0_2px_10px_rgba(0,0,0,0.06)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#F9FAFB] rounded-lg">
            <FiFileText size={15} className="text-[#374151]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#111827] leading-tight">
              Mis permisos y vacaciones
            </h3>
            {!loading && active.length > 0 && (
              <p className="text-xs text-[#D97706] font-medium">
                {active.length} solicitud{active.length !== 1 ? "es" : ""} activa{active.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => navigate("/dashboard/talento-humano/permisos")}
          className="flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:text-blue-700 transition-colors cursor-pointer"
        >
          Gestionar
          <FiArrowRight size={12} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 rounded-xl bg-[#F3F4F6] animate-pulse" />
          ))}
        </div>
      ) : recent.length === 0 ? (
        <p className="text-sm text-[#9CA3AF] py-1">Sin solicitudes recientes.</p>
      ) : (
        <div className="space-y-1.5">
          {recent.map((s) => {
            const tipo = getTipoLabel(s);
            const fechaInicio = formatDateShort(s.fecha_inicio || s.start_date);
            const fechaFin = formatDateShort(s.fecha_fin || s.end_date);
            const rango = fechaInicio === fechaFin ? fechaInicio : `${fechaInicio} — ${fechaFin}`;
            return (
              <div
                key={s.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#F9FAFB]"
              >
                <div>
                  <p className="text-sm font-medium text-[#111827]">{tipo}</p>
                  <p className="text-xs font-mono text-[#6B7280]">{rango}</p>
                </div>
                <StatusBadge status={s.status} />
              </div>
            );
          })}
        </div>
      )}

      {!loading && solicitudes.length > 3 && (
        <button
          onClick={() => navigate("/dashboard/talento-humano/permisos")}
          className="mt-3 w-full text-xs text-center text-[#6B7280] hover:text-[#374151] transition-colors cursor-pointer py-1"
        >
          Ver {solicitudes.length - 3} más
        </button>
      )}
    </div>
  );
};

export default PermisosCompactCard;
