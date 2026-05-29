import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
 FiUsers,
 FiSettings,
 FiDatabase,
 FiActivity,
 FiShield,
 FiArrowRight,
 FiLink,
 FiCalendar,
 FiCpu,
 FiGrid,
} from "react-icons/fi";
import toast from "react-hot-toast";
import api from "../../core/api";
import { getUsers } from "../../core/api/usersApi";
import { getDepartments } from "../../core/api/departmentsApi";
import Card from "../../core/ui/components/Card";
import PermisosStatusWidget from "../shared/solicitudes/components/PermisosStatusWidget";
import useAuditStatus from "../../core/hooks/useAuditStatus";
import { useAuth } from "../../core/auth/AuthContext";

const DashboardTI = () => {
 const [users, setUsers] = useState([]);
 const [departments, setDepartments] = useState([]);
 const [sessions, setSessions] = useState([]);
 const [loading, setLoading] = useState(true);
 const { status: auditStatus } = useAuditStatus();
 const { user } = useAuth();
 const navigate = useNavigate();

 // ============================================================
 // 🔹 Cargar usuarios, departamentos y sesiones
 // ============================================================
 useEffect(() => {
 const loadData = async () => {
 try {
 const [u, d, s] = await Promise.all([
 getUsers(),
 getDepartments({ include_inactive: true }),
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
 const activos = users.filter((u) => u.active !== false).length;
 const inactivos = users.filter((u) => u.active === false).length;
 const departamentos = departments.filter((d) => String(d.status || "").toLowerCase() !== "inactive").length;
 const departamentosInactivos = departments.filter((d) => String(d.status || "").toLowerCase() === "inactive").length;
 const role = (user?.role || "").toLowerCase();
 const auditActive = Boolean(auditStatus?.active);
 const canSeeAudit = auditActive || ["admin_ti", "jefe_ti", "ti"].includes(role);

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
 icon: <FiActivity />,
 label: "Usuarios Inactivos",
 value: inactivos,
 color: "red",
 },
 {
 icon: <FiSettings />,
 label: "Departamentos Activos",
 value: departamentos,
 color: "orange",
 },
 {
 icon: <FiSettings />,
 label: "Departamentos Inactivos",
 value: departamentosInactivos,
 color: "slate",
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

 {/* ACCESOS DIRECTOS */}
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
 {[
 {
 title: "Usuarios y Departamentos",
 desc: "Centraliza la gestion de usuarios, roles y estructura organizacional.",
 path: "/dashboard/talento-humano/gestion",
 gradient: "from-blue-600 via-blue-500 to-blue-400",
 icon: <FiSettings size={24} />,
 },
 {
 title: "Auditoría y Trazabilidad",
 desc: "Consulta la actividad completa y la bitácora de sesiones.",
 path: "/dashboard/auditoria",
 gradient: "from-purple-600 via-fuchsia-500 to-pink-500",
 icon: <FiShield size={24} />,
 },
 {
 title: "Dispositivos TI",
 desc: "Administra equipos corporativos, asignaciones, estados y trazabilidad de cambios.",
 path: "/dashboard/ti/dispositivos",
 gradient: "from-indigo-600 via-blue-500 to-cyan-500",
 icon: <FiCpu size={24} />,
 },
 {
 title: "Modulos por Usuario",
 desc: "Activa o desactiva modulos por usuario desde workspace TI.",
 path: "/dashboard/ti/modulos",
 gradient: "from-slate-700 via-slate-600 to-slate-500",
 icon: <FiGrid size={24} />,
 },
 {
 title: "Cronograma de Mantenimientos TI",
 desc: "Planifica y gestiona mantenimientos de celulares y computadoras asignadas.",
 path: "/dashboard/ti/mantenimientos",
 gradient: "from-emerald-600 via-teal-500 to-cyan-500",
 icon: <FiCalendar size={24} />,
 },
 {
 title: "Casos Externos ST-01-04",
 desc: "Monitorea salud de Navify/REXIS/GoApp, errores y reintentos de sincronización.",
 path: "/dashboard/ti/casos-externos",
 gradient: "from-cyan-600 via-sky-500 to-blue-500",
 icon: <FiLink size={24} />,
 },
 {
 title: "Kick Off 2026",
 desc: "Gestiona el evento interno: cronograma, presentaciones, sala de preguntas y moderación en vivo.",
 path: "/dashboard/kickoff",
 gradient: "from-violet-600 via-purple-500 to-fuchsia-500",
 icon: <FiCalendar size={24} />,
 },
 canSeeAudit
 ? {
 title: "Preparación de Auditoría",
 desc: auditActive
 ? "Carga y controla la documentación requerida para auditores."
 : "Configura fechas y activa el modo auditoría.",
 path: "/dashboard/auditoria/preparacion",
 gradient: "from-amber-600 via-orange-500 to-yellow-400",
 icon: <FiShield size={24} />,
 }
 : null,
 ]
 .filter(Boolean)
 .map((card) => (
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

 {/* Widget de Permisos y Vacaciones */}
 <PermisosStatusWidget />

 </div>
 );
};

export default DashboardTI;
