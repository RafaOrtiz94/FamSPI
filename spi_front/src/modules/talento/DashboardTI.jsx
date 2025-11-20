import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiUsers,
  FiSettings,
  FiDatabase,
  FiActivity,
  FiShield,
  FiArrowRight,
  FiFileText,
} from "react-icons/fi";
import toast from "react-hot-toast";
import api from "../../core/api";
import { getUsers } from "../../core/api/usersApi";
import { getDepartments } from "../../core/api/departmentsApi";
import Card from "../../core/ui/components/Card";
import { downloadAttendanceCalibrationPDF } from "../../core/api/attendanceApi";
import AttendanceWidget from "../shared/components/AttendanceWidget";

const DashboardTI = () => {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingCalibration, setDownloadingCalibration] = useState(false);
  const navigate = useNavigate();

  // ============================================================
  // 🔹 Cargar usuarios, departamentos y sesiones
  // ============================================================
  useEffect(() => {
    const loadData = async () => {
      try {
        const [u, d, s] = await Promise.all([
          getUsers(),
          getDepartments(),
          api.get("/auth/sessions"),
        ]);
        setUsers(u || []);
        setDepartments(d || []);
        setSessions(s.data.sessions || []);
      } catch (err) {
        console.error("❌ Error cargando datos TI:", err);
        toast.error("Error cargando información del panel de TI");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // ============================================================
  // 🔹 Cargando estado inicial
  // ============================================================
  if (loading)
    return (
      <div className="flex justify-center items-center min-h-[70vh]">
        <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );

  // ============================================================
  // 🔹 KPIs generales
  // ============================================================
  const totalUsuarios = users.length;
  const activos = users.filter((u) => u.role !== "pendiente").length;
  const departamentos = departments.length;

  // ============================================================
  // 🔹 Render principal
  // ============================================================
  return (
    <div className="p-6 space-y-8">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-800 tracking-tight">
          Panel de Administración / Tecnología
        </h1>
        <p className="text-sm text-neutral-500">
          Monitorea usuarios, departamentos, sesiones y auditoría completa del
          sistema.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          {
            icon: <FiUsers />,
            label: "Usuarios Totales",
            value: totalUsuarios,
            color: "blue",
          },
          {
            icon: <FiActivity />,
            label: "Usuarios Activos",
            value: activos,
            color: "green",
          },
          {
            icon: <FiSettings />,
            label: "Departamentos",
            value: departamentos,
            color: "orange",
          },
          {
            icon: <FiDatabase />,
            label: "Registros de Sesión",
            value: sessions.length,
            color: "purple",
          },
        ].map((kpi, i) => (
          <Card
            key={i}
            className="flex flex-col items-center justify-center py-6 text-center rounded-2xl shadow-sm hover:shadow-md transition-all bg-white border border-neutral-100"
          >
            <div className={`text-${kpi.color}-600 text-4xl mb-2`}>
              {kpi.icon}
            </div>
            <p className="text-sm text-neutral-500">{kpi.label}</p>
            <p className="text-3xl font-bold text-neutral-800">{kpi.value}</p>
          </Card>
        ))}
      </div>

      {/* CONTROL DE ASISTENCIA */}
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
        <AttendanceWidget />
      </div>

      {/* ACCESOS DIRECTOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[
          {
            title: "Gestión de Usuarios",
            desc: "Controla roles, accesos y perfiles activos en la organización.",
            path: "/dashboard/talento-humano/usuarios",
            gradient: "from-blue-600 via-blue-500 to-blue-400",
            icon: <FiUsers size={24} />,
          },
          {
            title: "Departamentos",
            desc: "Administra unidades operativas y responsables en segundos.",
            path: "/dashboard/talento-humano/departamentos",
            gradient: "from-emerald-600 via-emerald-500 to-emerald-400",
            icon: <FiSettings size={24} />,
          },
          {
            title: "Auditoría y Trazabilidad",
            desc: "Consulta la actividad completa y la bitácora de sesiones.",
            path: "/dashboard/auditoria",
            gradient: "from-purple-600 via-fuchsia-500 to-pink-500",
            icon: <FiShield size={24} />,
          },
        ].map((card) => (
          <div
            key={card.title}
            className={`rounded-2xl p-6 border border-white/30 bg-gradient-to-r ${card.gradient} text-white shadow-lg flex flex-col gap-4`}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/20 rounded-xl">{card.icon}</div>
              <div>
                <h2 className="text-lg font-semibold mb-1">{card.title}</h2>
                <p className="text-sm text-white/90 leading-relaxed">
                  {card.desc}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate(card.path)}
              className="self-start inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 transition text-sm font-medium"
            >
              Ir al módulo <FiArrowRight size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* CALIBRACIÓN DE DOCUMENTOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-6 rounded-2xl shadow-sm border border-neutral-100 bg-white">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
              <FiFileText size={24} />
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-blue-500 font-semibold">
                  Herramienta de calibración
                </p>
                <h2 className="text-xl font-bold text-neutral-800">
                  Calibrar formatos de asistencia
                </h2>
              </div>
              <p className="text-sm text-neutral-600 leading-relaxed">
                Genera un PDF con cuadrícula y coordenadas para validar la ubicación de
                firmas y campos en los documentos de asistencia. Úsalo antes de subir
                nuevas plantillas o ajustar los offsets.
              </p>
              <div className="flex items-center gap-3 text-sm text-neutral-500">
                <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 font-medium">
                  attendance.calibration.service
                </span>
                <span>Plantilla base: F.RH-09_V01</span>
              </div>
              <div className="pt-2">
                <button
                  onClick={async () => {
                    setDownloadingCalibration(true);
                    try {
                      await downloadAttendanceCalibrationPDF();
                      toast.success("PDF de calibración descargado");
                    } catch (err) {
                      console.error("❌ Error descargando PDF de calibración:", err);
                      toast.error("No se pudo generar el PDF de calibración");
                    } finally {
                      setDownloadingCalibration(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                  disabled={downloadingCalibration}
                >
                  {downloadingCalibration ? "Generando..." : "Descargar PDF de calibración"}
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DashboardTI;
