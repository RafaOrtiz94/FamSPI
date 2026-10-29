import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { FiAlertTriangle, FiExternalLink, FiMapPin, FiRefreshCw, FiShield, FiCalendar } from "react-icons/fi";
import Button from "../../../core/ui/components/Button";
import Modal from "../../../core/ui/components/Modal";
import { useAuth } from "../../../core/auth/AuthContext";
import { getAvailableTechnicalApplications } from "../../../core/api/technicalApplicationsApi";
import DesinfeccionStepper from "../components/DesinfeccionStepper";
import EntrenamientoStepper from "../components/EntrenamientoStepper";
import AsistenciaStepper from "../components/AsistenciaStepper";
import VerificacionStepper from "../components/VerificacionStepper";
import TrainingWorkflowWorkspace from "../components/TrainingWorkflowWorkspace";
import ServicioCard from "../design/ServicioCard";
import ServicioBadge from "../design/ServicioBadge";
import ServicioEmptyState from "../design/ServicioEmptyState";
import "../design/tokens.css";

// T9 aplicado aca (§3.7 del plan): las 5 tarjetas se mostraban identicas a
// los 3 roles aunque solo 2-3 les aplican por especialidad -- esp_app
// normalmente no ejecuta Desinfeccion fisica, ing_servicio normalmente no
// dicta Entrenamiento (verificado contra ST-01-01 original, ver §3.8).
// `primaryRoles` decide que tarjetas van "destacadas" (mas peso visual, con
// descripcion) vs "secundarias" (fila compacta, solo tag+titulo) segun el
// rol de quien mira -- reemplaza el grid de 5 cards identicas (icono+titulo+
// descripcion x5) que DESIGN.md prohibe explicitamente.
const APP_CARDS = [
  {
    key: "training-workflow",
    tag: "CAP",
    icon: FiShield,
    eyebrow: "Workflow integrado",
    title: "Entrenamiento ST-01-01",
    code: "F.ST-04/05/06/08/12",
    description: "Coordinación, asistencia, evaluación, conformidad y certificado en un flujo guiado único con timeline y expediente documental.",
    action: "Abrir workflow",
    modalKey: "trainingWorkflow",
    primaryRoles: ["esp_app"],
  },
  {
    key: "desinfeccion",
    tag: "DES",
    icon: FiShield,
    eyebrow: "Aplicación interna",
    title: "Desinfección de instrumentos",
    code: "F.ST-02",
    description: "Registro de desinfección según V04. Formulario digital con firma y evidencias.",
    action: "Abrir formulario",
    modalKey: "desinfeccion",
    primaryRoles: ["ing_servicio"],
  },
  {
    key: "entrenamiento",
    tag: "ENT",
    icon: FiCalendar,
    eyebrow: "Aplicación interna",
    title: "Planificación del entrenamiento",
    code: "F.ST-04",
    description: "Coordinación de fechas de entrenamiento con firma de compromiso.",
    action: "Abrir formulario",
    modalKey: "entrenamiento",
    primaryRoles: ["esp_app"],
  },
  {
    key: "asistencia",
    tag: "AST",
    icon: FiCalendar,
    eyebrow: "Aplicación interna",
    title: "Lista de asistencia",
    code: "F.ST-05",
    description: "Control de asistencia a entrenamientos con registro de participantes y firma digital.",
    action: "Abrir formulario",
    modalKey: "asistencia",
    primaryRoles: ["esp_app"],
  },
  {
    key: "verificacion",
    tag: "VER",
    icon: FiShield,
    eyebrow: "Aplicación interna",
    title: "Verificación de equipos",
    code: "F.ST-09",
    description: "Verificación técnica de equipos nuevos con resultados, análisis y evidencia fotográfica.",
    action: "Abrir formulario",
    modalKey: "verificacion",
    primaryRoles: ["esp_app"],
  },
];

const normalizeTokens = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item || "").toLowerCase()).filter(Boolean);
  return String(value || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
};

// null = jefe_servicio/otro rol supervisor: ve todo con el mismo peso, sin
// filtrar por especialidad (necesita panorama completo del area).
const resolveSpecialty = (user) => {
  const tokens = new Set([...normalizeTokens(user?.role), ...normalizeTokens(user?.scope)]);
  if (tokens.has("esp_app")) return "esp_app";
  if (tokens.has("ing_servicio")) return "ing_servicio";
  return null;
};

const AplicacionesTecnicas = () => {
  const { user } = useAuth();
  const specialty = useMemo(() => resolveSpecialty(user), [user]);
  const featuredCards = useMemo(
    () => APP_CARDS.filter((card) => (specialty ? card.primaryRoles.includes(specialty) : ["desinfeccion", "asistencia"].includes(card.key))),
    [specialty],
  );
  const compactCards = useMemo(
    () => APP_CARDS.filter((card) => !featuredCards.includes(card)),
    [featuredCards],
  );
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Cross-link con Capacitaciones (Decision §6): el catalogo/agenda de
  // formacion enlaza aca con ?open=trainingWorkflow para abrir directo la
  // ejecucion, en vez de duplicar el formulario en esa pantalla de solo
  // lectura.
  const [searchParams] = useSearchParams();
  const [openModal, setOpenModal] = useState(() => (searchParams.get("open") === "trainingWorkflow" ? "trainingWorkflow" : null));

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getAvailableTechnicalApplications();
      setApplications(Array.isArray(result) ? result : []);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) {
        setError("Sesión expirada o sin permisos. Inicia sesión nuevamente para ver las aplicaciones disponibles.");
      } else {
        setError("No se pudieron cargar las aplicaciones técnicas disponibles.");
      }
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  return (
    <div className="st-scope space-y-6 p-6" style={{ background: "var(--st-bg)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm" style={{ color: "var(--st-text-muted)" }}>Documentos y rutas técnicas disponibles</p>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>Aplicaciones técnicas</h1>
        </div>
        <Button variant="secondary" icon={FiRefreshCw} onClick={loadApplications} disabled={loading}>Recargar</Button>
      </div>

      {error && (
        <ServicioCard className="flex items-start gap-3 p-4" style={{ borderColor: "var(--st-warning)", background: "var(--st-warning-soft)" }}>
          <FiAlertTriangle className="mt-1" style={{ color: "var(--st-warning)" }} />
          <div>
            <p className="font-medium" style={{ color: "var(--st-warning)" }}>Aviso</p>
            <p className="text-sm" style={{ color: "var(--st-warning)" }}>{error}</p>
          </div>
        </ServicioCard>
      )}

      {loading ? (
        <ServicioCard className="p-5">
          <p className="text-sm" style={{ color: "var(--st-text-muted)" }}>Cargando aplicaciones disponibles...</p>
        </ServicioCard>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {featuredCards.map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={() => setOpenModal(card.modalKey)}
                className="space-y-3 rounded-[var(--st-radius-lg)] border p-5 text-left transition"
                style={{ borderColor: "var(--st-border)", background: "var(--st-surface)", boxShadow: "var(--st-shadow-card)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm" style={{ color: "var(--st-text-muted)" }}>{card.eyebrow}</p>
                    <h3 className="text-lg font-semibold" style={{ color: "var(--st-text)" }}>{card.title}</h3>
                  </div>
                  <ServicioBadge tone="accent">{card.code}</ServicioBadge>
                </div>
                <p className="text-sm" style={{ color: "var(--st-text-muted)" }}>{card.description}</p>
                <div className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: "var(--st-accent)" }}>
                  <card.icon /> {card.action}
                </div>
              </button>
            ))}
          </div>

          {compactCards.length ? (
            <ServicioCard className="p-2">
              <div className="divide-y" style={{ borderColor: "var(--st-border)" }}>
                {compactCards.map((card) => (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => setOpenModal(card.modalKey)}
                    className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors duration-150 hover:bg-[var(--st-surface-sunken)]"
                  >
                    <span
                      className="font-mono-data shrink-0 rounded-[3px] px-1.5 py-0.5 text-[10px] font-bold tracking-wide"
                      style={{ background: "var(--st-surface-sunken)", color: "var(--st-text-faint)" }}
                    >
                      {card.tag}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium" style={{ color: "var(--st-text)" }}>{card.title}</span>
                      <span className="block truncate text-xs" style={{ color: "var(--st-text-faint)" }}>{card.code}</span>
                    </span>
                  </button>
                ))}
              </div>
            </ServicioCard>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {applications.map((app) => (
              <ServicioCard key={app.id || app._id || app.name} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm" style={{ color: "var(--st-text-muted)" }}>Cliente</p>
                    <h3 className="text-lg font-semibold" style={{ color: "var(--st-text)" }}>{app.client || app.cliente || "Cliente"}</h3>
                  </div>
                  {app.status && <ServicioBadge tone="info">{app.status}</ServicioBadge>}
                </div>

                <div className="space-y-1 text-sm" style={{ color: "var(--st-text-muted)" }}>
                  {app.location && (
                    <div className="flex items-center gap-2">
                      <FiMapPin style={{ color: "var(--st-accent)" }} />
                      <span className="truncate">{app.location}</span>
                    </div>
                  )}
                  {app.assignee && <p>Asignado a: {app.assignee}</p>}
                  {app.type && <p>Tipo: {app.type}</p>}
                </div>

                {app.url && (
                  <a
                    className="inline-flex items-center gap-2 text-sm font-medium"
                    style={{ color: "var(--st-accent)" }}
                    href={app.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FiExternalLink /> Abrir documento
                  </a>
                )}
              </ServicioCard>
            ))}

            {!loading && applications.length === 0 && APP_CARDS.length === 0 ? (
              <ServicioEmptyState title="Sin aplicaciones disponibles" />
            ) : null}
          </div>
        </>
      )}

      <Modal open={openModal === "desinfeccion"} onClose={() => setOpenModal(null)} title="Desinfección de Instrumentos y Partes" maxWidth="max-w-4xl">
        <DesinfeccionStepper />
      </Modal>

      <Modal open={openModal === "entrenamiento"} onClose={() => setOpenModal(null)} title="Planificación del Entrenamiento" maxWidth="max-w-4xl">
        <EntrenamientoStepper />
      </Modal>

      <Modal open={openModal === "asistencia"} onClose={() => setOpenModal(null)} title="Lista de Asistencia de Entrenamiento" maxWidth="max-w-6xl">
        <AsistenciaStepper />
      </Modal>

      <Modal open={openModal === "verificacion"} onClose={() => setOpenModal(null)} title="Verificación de Equipos Nuevos" maxWidth="max-w-4xl">
        <VerificacionStepper />
      </Modal>

      <Modal open={openModal === "trainingWorkflow"} onClose={() => setOpenModal(null)} title="Workflow Integrado de Entrenamiento ST-01-01" maxWidth="max-w-7xl">
        <TrainingWorkflowWorkspace />
      </Modal>
    </div>
  );
};

export default AplicacionesTecnicas;
