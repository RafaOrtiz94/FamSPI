import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiInfo,
  FiMail,
  FiMapPin,
  FiNavigation,
  FiSearch,
  FiUser,
  FiUsers,
  FiCalendar,
} from "react-icons/fi";

import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import Modal from "../../../core/ui/components/Modal";
import { useUI } from "../../../core/ui/useUI";
import { useAuth } from "../../../core/auth/useAuth";
import {
  assignClient,
  endClientVisit,
  fetchClients,
  startClientVisit,
  registerProspectVisit
} from "../../../core/api/clientsApi";
import { getUsers } from "../../../core/api/usersApi";
import ClientApprovalsWidget from "../../backoffice/components/ClientApprovalsWidget";
import BackofficeClientRequestsKpiWidget from "../components/BackofficeClientRequestsKpiWidget";
import MyClientRequestsWidget from "../components/MyClientRequestsWidget";

const todayStr = new Date().toISOString().slice(0, 10);

const roleIsManager = (role) =>
  ["jefe_comercial", "gerencia", "gerente", "admin", "administrador", "ti"].includes(role);

const advisorRoles = new Set(["comercial", "acp_comercial", "backoffice"]);

const normalizeStatus = (status) => {
  const value = (status || "").toLowerCase();
  if (["visited", "visitado"].includes(value)) return "visitado";
  if (["en_visita", "in_visit", "in_progress"].includes(value)) return "en_visita";
  return "pendiente";
};

const STATUS_STYLES = {
  pendiente: {
    label: "Pendiente",
    chip: "bg-gray-100 text-gray-700",
    led: "bg-gray-300",
  },
  en_visita: {
    label: "En visita",
    chip: "bg-blue-50 text-blue-700",
    led: "bg-blue-500",
  },
  visitado: {
    label: "Visitado",
    chip: "bg-green-50 text-green-700",
    led: "bg-green-500",
  },
};

const ClientesPage = () => {
  const { showToast } = useUI();
  const { role, user } = useAuth();
  const normalizedRole =
    (role || user?.role || user?.role_name || user?.scope || "").toLowerCase();
  const isManager = roleIsManager(normalizedRole);
  const isBackofficeUser = normalizedRole.includes("backoffice");
  const currentEmail = user?.email?.toLowerCase?.() || "";

  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState({});
  const [advisors, setAdvisors] = useState([]);
  const [activeClient, setActiveClient] = useState(null);
  const [modalType, setModalType] = useState(null); // start | end | report
  const [visitModal, setVisitModal] = useState({
    timestamp: null,
    coords: null,
    note: "",
    loadingLocation: false,
    error: null,
  });
  const [submittingVisit, setSubmittingVisit] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all"); // all | pending | visited
  const [assignedViewFilter, setAssignedViewFilter] = useState("assigned");
  const [assignedSearch, setAssignedSearch] = useState("");
  const [filterBySchedule, setFilterBySchedule] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [summary, setSummary] = useState({});

  const getStatusMeta = (status) => STATUS_STYLES[normalizeStatus(status)] || STATUS_STYLES.pendiente;

  const activeStatusMeta = useMemo(
    () => getStatusMeta(activeClient?.visit_status),
    [activeClient],
  );

  const formatTime = (value) =>
    value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

  const formatDuration = (minutes) => {
    if (minutes === null || typeof minutes === "undefined") return "—";
    if (minutes < 60) return `${minutes} min`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs}h ${mins}m`;
  };

  const calculateDuration = (client) => {
    if (!client?.hora_entrada || !client?.hora_salida) return null;
    const diffMs = new Date(client.hora_salida) - new Date(client.hora_entrada);
    return Math.max(0, Math.round(diffMs / 60000));
  };

  const formatClientType = (type) => {
    const value = (type || "").toLowerCase();
    if (value === "persona_juridica" || value.includes("jurid")) return "Persona Jurídica";
    if (value === "persona_natural" || value.includes("natur")) return "Persona Natural";
    return "Tipo no especificado";
  };

  const parseAddressParts = (address) =>
    (address || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const getCityFromAddress = (address) => {
    const parts = parseAddressParts(address);
    if (parts.length >= 2) return parts[parts.length - 2];
    return parts[0] || "Ciudad no especificada";
  };

  const getProvinceFromAddress = (address) => {
    const parts = parseAddressParts(address);
    if (parts.length >= 1) return parts[parts.length - 1];
    return "Provincia no especificada";
  };

  // Helper para normalizar asignados a un array siempre
  const normalizeAsignados = (asignados) => {
    if (Array.isArray(asignados)) return asignados;
    if (typeof asignados === "string") {
      try {
        const parsed = JSON.parse(asignados);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  };

  const captureLocation = () =>
    new Promise((resolve, reject) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        console.error("DEBUG: Navigator o geolocation no existen");
        showToast("Geolocalización no soportada", "error");
        reject(new Error("La geolocalización no está disponible"));
        return;
      }

      console.log("DEBUG: Iniciando captureLocation...");
      console.log("DEBUG: Configuración -> Timeout: 30000ms, MaxAge: 300000ms, HighAccuracy: true");
      showToast("Obteniendo ubicación...", "info");

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          console.log(`DEBUG: Ubicación obtenida! Lat: ${latitude}, Lng: ${longitude}, Acc: ${accuracy}m`);
          resolve({ latitude, longitude });
        },
        (err) => {
          console.error("DEBUG: Error en getCurrentPosition:", err);
          console.error(`DEBUG: Error Code: ${err.code}, Message: ${err.message}`);

          let msg = "No se pudo obtener la ubicación.";
          if (err.code === 1) msg = "Permiso denegado. Habilita la ubicación.";
          if (err.code === 2) msg = "Señal GPS débil o no disponible.";
          if (err.code === 3) msg = "Tiempo de espera agotado (30s). Intenta en exteriores.";

          showToast(msg, "warning");
          reject(new Error(msg));
        },
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 300000 }
      );
    });

  const loadAdvisors = async () => {
    try {
      const users = await getUsers();
      const usersArray = Array.isArray(users) ? users : [];
      const filtered = usersArray.filter((u) => advisorRoles.has(u.role?.toLowerCase?.()));
      setAdvisors(Array.isArray(filtered) ? filtered : []);
    } catch (error) {
      console.error(error);
      setAdvisors([]);
    }
  };

  const loadClientes = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchClients({
        date: selectedDate,
        include_schedule_info: true,
        filter_by_schedule: filterBySchedule,
      });

      let loadedClients = [];
      let loadedProspects = [];
      let loadedSummary = {};

      if (Array.isArray(result)) {
        loadedClients = result;
      } else {
        loadedClients = Array.isArray(result?.clients) ? result.clients : [];
        // Map prospects to client-like structure
        loadedProspects = (Array.isArray(result?.prospects) ? result.prospects : []).map(p => ({
          ...p,
          id: p.id, // Keep original ID, handled by different API call
          nombre: p.prospect_name,
          visit_status: p.status, // 'in_visit' | 'visited'
          identificador: "PROSPECTO",
          shipping_address: "Ubicación registrada en visita",
          shipping_city: "—",
          shipping_province: "—",
          client_type: "Prospecto",
          is_prospect: true,
          // Map timestamps for standard display
          hora_entrada: p.check_in_time,
          hora_salida: p.check_out_time,
          lat_entrada: p.check_in_lat,
          lng_entrada: p.check_in_lng,
          lat_salida: p.check_out_lat,
          lng_salida: p.check_out_lng,
          duracion_minutos: null, // Calculate on fly or add to DB if needed
          // Ensure they show in "assigned" and "created" filters
          created_by: currentEmail,
          asignados: [currentEmail]
        }));
        loadedSummary = result?.summary || {};
      }

      setClientes([...loadedProspects, ...loadedClients]);
      setSummary(loadedSummary);

      if (filterBySchedule && !loadedSummary?.has_approved_schedule) {
        showToast(
          "No tienes un cronograma aprobado para este mes. Mostrando todos los clientes.",
          "info",
        );
      }

    } catch (error) {
      console.error(error);
      showToast("No pudimos cargar tus clientes", "error");
      setClientes([]);
      setSummary({});
    } finally {
      setLoading(false);
    }
  }, [filterBySchedule, selectedDate, showToast, currentEmail]);

  useEffect(() => {
    loadClientes();
  }, [filterBySchedule, loadClientes]);

  useEffect(() => {
    if (isManager) loadAdvisors();
  }, [isManager]);

  const visitedCount = useMemo(() => {
    if (typeof summary?.visited === "number") return summary.visited;
    if (!Array.isArray(clientes)) return 0;
    return clientes.filter((c) => normalizeStatus(c.visit_status) === "visitado").length;
  }, [clientes, summary]);

  const pendingCount = useMemo(() => {
    if (typeof summary?.pending === "number") return summary.pending;
    if (!Array.isArray(clientes)) return 0;
    return clientes.filter((c) => normalizeStatus(c.visit_status) !== "visitado").length;
  }, [clientes, summary]);

  const filteredClientes = useMemo(() => {
    if (!Array.isArray(clientes)) return [];
    let base = clientes;

    if (statusFilter === "pending") {
      base = base.filter((c) => normalizeStatus(c.visit_status) !== "visitado");
    } else if (statusFilter === "visited") {
      base = base.filter((c) => normalizeStatus(c.visit_status) === "visitado");
    }

    return base;
  }, [clientes, statusFilter]);

  const assignedToMe = useMemo(() => {
    if (!Array.isArray(clientes)) return [];
    return clientes.filter((c) => {
      const asignados = normalizeAsignados(c.asignados);
      return asignados.some((mail) => (mail || "").toLowerCase?.() === currentEmail);
    });
  }, [clientes, currentEmail]);

  const createdByMe = useMemo(() => {
    if (!Array.isArray(clientes)) return [];
    return clientes.filter(
      (c) => (c.created_by || "").toLowerCase?.() === currentEmail,
    );
  }, [clientes, currentEmail]);

  const allMine = useMemo(() => {
    if (!Array.isArray(clientes)) return [];
    const seen = new Set();
    const merged = [];
    [...assignedToMe, ...createdByMe].forEach((client) => {
      if (!seen.has(client.id)) {
        seen.add(client.id);
        merged.push(client);
      }
    });
    return merged;
  }, [clientes, assignedToMe, createdByMe]);

  const filteredAssignedList = useMemo(() => {
    let base = assignedToMe;

    if (assignedViewFilter === "created") {
      base = createdByMe;
    } else if (assignedViewFilter === "all") {
      base = allMine;
    }

    if (!assignedSearch) return base;
    const q = assignedSearch.toLowerCase();
    return base.filter((c) => {
      const haystack = `${c.nombre || ""} ${c.identificador || ""} ${c.shipping_contact_name || ""} ${c.shipping_address || ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [assignedViewFilter, assignedToMe, createdByMe, allMine, assignedSearch]);

  const handleAssign = async (clientId) => {
    const email = assignments[clientId];
    if (!email) {
      showToast("Selecciona un asesor para asignar", "warning");
      return;
    }
    try {
      await assignClient(clientId, email);
      showToast("Cliente asignado", "success");
      loadClientes();
    } catch (error) {
      console.error(error);
      showToast("No se pudo asignar el cliente", "error");
    }
  };

  const openVisitFlow = async (client, mode) => {
    const timestamp = new Date();
    setActiveClient(client);
    setModalType(mode);
    setVisitModal({ timestamp, coords: null, note: "", loadingLocation: true, error: null });

    try {
      const coords = await captureLocation();
      setVisitModal((prev) => ({ ...prev, coords, loadingLocation: false }));
    } catch (error) {
      console.error(error);
      setVisitModal((prev) => ({
        ...prev,
        loadingLocation: false,
        error: error?.message || "No pudimos obtener tu ubicación",
      }));
      showToast("No pudimos obtener tu ubicación", "warning");
    }
  };

  const openReportModal = (client) => {
    setActiveClient(client);
    setModalType("report");
  };

  const closeModal = () => {
    setActiveClient(null);
    setModalType(null);
    setVisitModal({ timestamp: null, coords: null, note: "", loadingLocation: false, error: null });
  };

  const handleConfirmVisit = async () => {
    if (!activeClient || (modalType !== "start" && modalType !== "end")) return;
    if (modalType === "end" && !activeClient.hora_entrada) {
      showToast("No puedes finalizar una visita que no ha iniciado", "warning");
      return;
    }

    const timestamp = visitModal.timestamp || new Date();
    const coords = visitModal.coords;
    const payload =
      modalType === "start"
        ? {
          hora_entrada: timestamp.toISOString(),
          lat_entrada: coords?.latitude,
          lng_entrada: coords?.longitude,
          observaciones: visitModal.note,
        }
        : {
          hora_salida: timestamp.toISOString(),
          lat_salida: coords?.latitude,
          lng_salida: coords?.longitude,
          observaciones: visitModal.note,
        };

    setSubmittingVisit(true);
    try {
      let response;
      if (activeClient.is_prospect) {
        // Lógica para prospectos (solo checkout o update)
        const prospectPayload = {
          visit_id: activeClient.id,
          check_out_time: payload.hora_salida,
          check_out_lat: payload.lat_salida,
          check_out_lng: payload.lng_salida,
          observations: payload.observaciones
        };
        // Para prospectos, registerProspectVisit maneja upsert.
        // Si es "start" (re-checkin?), se manejaría igual, pero asumimos "end".
        response = await registerProspectVisit(prospectPayload);
      } else {
        const apiCall = modalType === "start" ? startClientVisit : endClientVisit;
        response = await apiCall(activeClient.id, payload);
      }

      const durationFromApi = response?.duracion_minutos ?? response?.data?.duracion_minutos;

      const updated = {
        ...activeClient,
        ...payload,
        visit_status: modalType === "start" ? "en_visita" : "visitado",
      };

      if (modalType === "end") {
        const computed = durationFromApi ?? calculateDuration(updated);
        if (typeof computed === "number") updated.duracion_minutos = computed;
      }

      setClientes((prev) => {
        if (!Array.isArray(prev)) return [];
        return prev.map((c) => (c.id === activeClient.id ? updated : c));
      });
      setActiveClient(updated);
      showToast(modalType === "start" ? "Visita iniciada" : "Visita finalizada", "success");
      closeModal();
    } catch (error) {
      console.error(error);
      showToast("No pudimos registrar la visita", "error");
    } finally {
      setSubmittingVisit(false);
    }
  };

  const renderCard = (cliente) => {
    const status = normalizeStatus(cliente.visit_status);
    const meta = getStatusMeta(status);
    const duration = cliente.duracion_minutos ?? calculateDuration(cliente);
    const asignadosArray = normalizeAsignados(cliente.asignados);
    const assigned = asignadosArray.length > 0 ? asignadosArray.join(", ") : "Sin asignar";
    const hasEntryCoords = cliente.lat_entrada && cliente.lng_entrada;
    const hasExitCoords = cliente.lat_salida && cliente.lng_salida;
    const isPlanned = cliente.scheduled_info?.is_planned;

    return (
      <div
        key={cliente.id}
        className="relative flex flex-col rounded-2xl border border-gray-100 bg-white/80 p-4 shadow-sm backdrop-blur hover:shadow-md transition hover:-translate-y-0.5 cursor-pointer"
        onClick={() => openReportModal(cliente)}
      >
        {isPlanned && (
          <span className="absolute top-3 left-3 px-2 py-1 bg-green-500 text-white text-xs rounded-full flex items-center gap-1">
            <FiCalendar size={12} />
            Planificado
          </span>
        )}
        <span className={`absolute top-3 right-3 h-2.5 w-2.5 rounded-full ${meta.led}`} />

        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-gray-900">{cliente.nombre}</p>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <FiMapPin className="text-gray-400" /> {cliente.shipping_address || "Sin dirección"}
            </p>
            <p className="text-[11px] text-gray-400">ID #{cliente.id}</p>
          </div>
          <span className={`px-2 py-[2px] text-xs font-semibold rounded-full ${meta.chip}`}>
            {meta.label}
          </span>
        </div>

        <div className="mt-3 space-y-2 text-sm text-gray-700">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Entrada</span>
            <span className="font-semibold text-gray-800">{formatTime(cliente.hora_entrada)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Salida</span>
            <span className="font-semibold text-gray-800">{formatTime(cliente.hora_salida)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Duración</span>
            <span className="font-semibold text-gray-800">{formatDuration(duration)}</span>
          </div>
          <p className="text-xs text-gray-600">
            <span className="font-semibold text-gray-700">Asignado:</span> {assigned}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {status === "pendiente" && (
            <Button
              className="flex-1"
              icon={FiMapPin}
              onClick={(e) => {
                e.stopPropagation();
                openVisitFlow(cliente, "start");
              }}
            >
              Iniciar visita
            </Button>
          )}
          {status === "en_visita" && (
            <Button
              className="flex-1"
              icon={FiCheckCircle}
              onClick={(e) => {
                e.stopPropagation();
                openVisitFlow(cliente, "end");
              }}
            >
              Finalizar visita
            </Button>
          )}
          {status === "visitado" && (
            <Button
              className="flex-1"
              variant="secondary"
              icon={FiInfo}
              onClick={(e) => {
                e.stopPropagation();
                openReportModal(cliente);
              }}
            >
              Ver reporte
            </Button>
          )}
          {status !== "visitado" && (
            <Button
              variant="ghost"
              icon={FiInfo}
              className="px-3 py-2"
              onClick={(e) => {
                e.stopPropagation();
                openReportModal(cliente);
              }}
            >
              Detalles
            </Button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {hasEntryCoords && (
            <a
              href={`https://www.google.com/maps?q=${cliente.lat_entrada},${cliente.lng_entrada}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded-full border border-gray-200 px-3 py-1 text-gray-700 hover:bg-gray-50"
            >
              Ver ubicación entrada
            </a>
          )}
          {hasExitCoords && (
            <a
              href={`https://www.google.com/maps?q=${cliente.lat_salida},${cliente.lng_salida}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded-full border border-gray-200 px-3 py-1 text-gray-700 hover:bg-gray-50"
            >
              Ver ubicación salida
            </a>
          )}
        </div>

        {isManager && (
          <div className="mt-4 flex flex-col gap-2 rounded-lg bg-gray-50 p-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs font-semibold text-gray-700">Reasignar asesor</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={assignments[cliente.id] || ""}
                onChange={(e) => setAssignments((prev) => ({ ...prev, [cliente.id]: e.target.value }))}
              >
                <option value="">Selecciona asesor</option>
                {Array.isArray(advisors) && advisors.map((u) => (
                  <option key={u.id} value={u.email}>
                    {u.fullname || u.name || u.email}
                  </option>
                ))}
              </select>
              <Button onClick={() => handleAssign(cliente.id)}>Asignar</Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FiUsers className="text-blue-600" /> Gestión de Clientes
            </h1>
            <p className="text-sm text-gray-500">
              Clientes aprobados que puedes gestionar, con enfoque en tu ruta diaria de visitas.
            </p>
          </div>
        </div>

        {isBackofficeUser ? (
          <>
            <BackofficeClientRequestsKpiWidget />
            <ClientApprovalsWidget />
          </>
        ) : (
          <>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setModalType("prospect")}>
                  Visita a Prospecto
                </Button>
                <div className="flex items-center gap-2 text-sm">
                  <label className="text-gray-700">Fecha</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={filterBySchedule}
                    onChange={(e) => setFilterBySchedule(e.target.checked)}
                    className="rounded"
                  />
                  <span>Mostrar solo clientes planificados</span>
                </label>
              </div>
            </div>

            {summary?.has_approved_schedule && (
              <Card className="p-4 bg-blue-50 border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                      <FiCalendar /> Planificación de Hoy
                    </h4>
                    <p className="text-sm text-blue-700 mt-1">
                      {(summary.cities_today || []).join(", ") || "Ciudades"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-900">{summary.planned_today || 0}</p>
                    <p className="text-xs text-blue-600">clientes planificados</p>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-blue-700">Progreso</span>
                    <span className="font-semibold text-blue-900">
                      {visitedCount} / {summary.planned_today || 0}
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2 mt-1">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${summary.planned_today
                          ? Math.min(100, (visitedCount / summary.planned_today) * 100)
                          : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </Card>
            )}

            <MyClientRequestsWidget
              total={summary?.planned_today ?? (Array.isArray(clientes) ? clientes.length : 0)}
              visited={visitedCount}
              pending={pendingCount}
              onFilterChange={setStatusFilter}
            />
          </>
        )}
      </header>

      {
        !isBackofficeUser && (
          <>
            <Card className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Tarjetas de clientes para check‑in/check‑out</h2>
                  <p className="text-sm text-gray-500">
                    Usa las tarjetas para iniciar o finalizar visita y consulta el detalle completo de cada cliente.
                  </p>
                </div>
              </div>

              {Array.isArray(filteredClientes) && filteredClientes.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {filteredClientes.map((cliente) => renderCard(cliente))}
                </div>
              ) : (
                <div className="py-10 text-center text-gray-500">
                  {loading ? "Cargando clientes..." : "No se encontraron clientes"}
                </div>
              )}
            </Card>

            {/* Widget: Clientes asignados / registrados por mí */}
            <Card className="p-5 space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Mis clientes de gestión diaria
                  </h2>
                  <p className="text-sm text-gray-500">
                    Revisa rápidamente los clientes que tienes asignados, que tú mismo registraste o el conjunto de todos.
                  </p>
                </div>
                <div className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700">
                  Vista solo para tu usuario
                </div>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="inline-flex rounded-full bg-gray-100 p-1 text-xs font-medium text-gray-700">
                  <button
                    type="button"
                    onClick={() => setAssignedViewFilter("assigned")}
                    className={`px-3 py-1 rounded-full transition ${assignedViewFilter === "assigned"
                      ? "bg-white shadow-sm text-gray-900"
                      : "text-gray-500"
                      }`}
                  >
                    Asignados a mí ({Array.isArray(assignedToMe) ? assignedToMe.length : 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignedViewFilter("created")}
                    className={`px-3 py-1 rounded-full transition ${assignedViewFilter === "created"
                      ? "bg-white shadow-sm text-gray-900"
                      : "text-gray-500"
                      }`}
                  >
                    Registrados por mí ({Array.isArray(createdByMe) ? createdByMe.length : 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignedViewFilter("all")}
                    className={`px-3 py-1 rounded-full transition ${assignedViewFilter === "all"
                      ? "bg-white shadow-sm text-gray-900"
                      : "text-gray-500"
                      }`}
                  >
                    Todos mis clientes ({Array.isArray(allMine) ? allMine.length : 0})
                  </button>
                </div>

                <div className="relative w-full md:max-w-xs">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre, RUC o ciudad..."
                    value={assignedSearch}
                    onChange={(e) => setAssignedSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {Array.isArray(filteredAssignedList) && filteredAssignedList.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredAssignedList.map((cliente) => {
                    const ciudad = cliente.shipping_city || getCityFromAddress(cliente.shipping_address);
                    const provincia = cliente.shipping_province || getProvinceFromAddress(cliente.shipping_address);
                    const clienteEmail = cliente.client_email || "Correo no disponible";
                    const clientTypeLabel = formatClientType(cliente.client_type);
                    const status = normalizeStatus(cliente.visit_status);
                    const meta = getStatusMeta(status);
                    return (
                      <div
                        key={`mini-${cliente.id}`}
                        className="flex flex-col rounded-xl border border-gray-100 bg-white/80 p-3 shadow-sm hover:shadow-md transition cursor-pointer"
                        onClick={() => openReportModal(cliente)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <p className="text-sm font-semibold text-gray-900 line-clamp-1">
                              {cliente.nombre}
                            </p>
                          </div>
                          <span className={`px-2 py-[1px] text-[10px] font-semibold rounded-full ${meta.chip}`}>
                            {meta.label}
                          </span>
                        </div>

                        <div className="mt-2 space-y-1 text-[11px] text-gray-600">
                          <p className="flex items-center gap-1">
                            <FiMail className="h-3 w-3 text-gray-400" />
                            <span className="truncate">{clienteEmail}</span>
                          </p>
                          <p className="flex items-center gap-1">
                            <FiUser className="h-3 w-3 text-gray-400" />
                            {clientTypeLabel}
                          </p>
                          <p className="flex items-center gap-1">
                            <FiMapPin className="h-3 w-3 text-gray-400" />
                            {provincia || "Provincia no especificada"}
                          </p>
                          <p className="flex items-center gap-1">
                            <FiMapPin className="h-3 w-3 text-gray-400" />
                            {ciudad || "Ciudad no especificada"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  {assignedViewFilter === "assigned"
                    ? "No tienes clientes asignados que coincidan con el filtro."
                    : assignedViewFilter === "created"
                      ? "No tienes clientes registrados por ti que coincidan con el filtro."
                      : "No tienes clientes asignados o registrados por ti que coincidan con el filtro."}
                </p>
              )}
            </Card>
          </>
        )
      }

      {/* Modal de visita normal (usuario registrado) */}
      <Modal
        isOpen={!!activeClient && (modalType === "start" || modalType === "end")}
        onClose={submittingVisit ? undefined : closeModal}
        title={modalType === "start" ? "Iniciar visita a cliente" : "Finalizar visita y reportar"}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {modalType === "start"
              ? `Estás a punto de iniciar la visita a ${activeClient?.nombre}. Se registrará tu ubicación y hora de entrada.`
              : `Finaliza la visita a ${activeClient?.nombre}. Puedes agregar observaciones finales.`}
          </p>

          <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500 space-y-1">
            <div className="flex justify-between">
              <span>Fecha:</span>
              <span className="font-medium text-gray-900">
                {visitModal.timestamp?.toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Hora:</span>
              <span className="font-medium text-gray-900">
                {formatTime(visitModal.timestamp)}
              </span>
            </div>
            {visitModal.loadingLocation ? (
              <div className="flex items-center gap-2 text-blue-600">
                <FiNavigation className="animate-spin" /> Obteniendo ubicación...
              </div>
            ) : visitModal.coords ? (
              <div className="flex items-center gap-2 text-green-600">
                <FiMapPin />{" "}
                {`${visitModal.coords.latitude.toFixed(5)}, ${visitModal.coords.longitude.toFixed(5)}`}
              </div>
            ) : (
              <div className="text-red-500">Ubicación no disponible</div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Observaciones (opcional)</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              rows={3}
              placeholder="Escribe aquí notas sobre la visita..."
              value={visitModal.note}
              onChange={(e) => setVisitModal((prev) => ({ ...prev, note: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={closeModal}
              disabled={submittingVisit}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmVisit}
              disabled={submittingVisit || visitModal.loadingLocation || !visitModal.coords}
              isLoading={submittingVisit}
            >
              {modalType === "start" ? "Confirmar inicio" : "Confirmar finalización"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de visita a PROSPECTO */}
      <Modal
        isOpen={modalType === "prospect"}
        onClose={submittingVisit ? undefined : closeModal}
        title="Visita a Prospecto (No registrado)"
        maxWidth="max-w-md"
      >
        <ProspectVisitForm
          onClose={closeModal}
          onSuccess={() => {
            showToast("Visita a prospecto registrada", "success");
            closeModal();
            loadClientes(); // Reload to perhaps show prospects in a future list
          }}
          captureLocation={captureLocation}
        />
      </Modal>

      {/* Modal de reporte final */}
      <Modal
        isOpen={modalType === "report" && !!activeClient}
        onClose={closeModal}
        title={`Reporte de visita: ${activeClient?.nombre}`}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">Cliente</label>
              <p className="text-sm font-medium text-gray-900">{activeClient?.nombre}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">Identificación</label>
              <p className="text-sm text-gray-900">{activeClient?.identificador || "N/A"}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">Visita</label>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${getStatusMeta(activeClient?.visit_status).led}`} />
                <span className="text-sm text-gray-900">{getStatusMeta(activeClient?.visit_status).label}</span>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">Duración</label>
              <p className="text-sm text-gray-900">
                {formatDuration(activeClient?.duracion_minutos ?? calculateDuration(activeClient))}
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Tiempos y Ubicación</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Entrada:</span>
                <span className="font-medium text-gray-900">{formatTime(activeClient?.hora_entrada)}</span>
              </div>
              {activeClient?.lat_entrada && (
                <div className="flex justify-end">
                  <a
                    href={`https://www.google.com/maps?q=${activeClient.lat_entrada},${activeClient.lng_entrada}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <FiMapPin /> Ver ubicación
                  </a>
                </div>
              )}
              <div className="border-t border-gray-200 my-2" />
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Salida:</span>
                <span className="font-medium text-gray-900">{formatTime(activeClient?.hora_salida)}</span>
              </div>
              {activeClient?.lat_salida && (
                <div className="flex justify-end">
                  <a
                    href={`https://www.google.com/maps?q=${activeClient.lat_salida},${activeClient.lng_salida}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <FiMapPin /> Ver ubicación
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 uppercase">Observaciones</label>
            <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700 min-h-[80px]">
              {activeClient?.observaciones || "Sin observaciones registradas."}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={closeModal}>
              Cerrar
            </Button>
          </div>
        </div>
      </Modal>
    </div >
  );
};

const ProspectVisitForm = ({ onClose, onSuccess, captureLocation }) => {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setLocating(true);
    try {
      const coords = await captureLocation();
      setLocating(false);

      await registerProspectVisit({
        prospect_name: name,
        check_in_time: new Date().toISOString(),
        check_in_lat: coords.latitude,
        check_in_lng: coords.longitude,
        observations: note,
      });

      onSuccess();
    } catch (error) {
      console.error(error);
      setLocating(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Nombre del Laboratorio / Prospecto</label>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          placeholder="Ej. Laboratorio Clínico Central"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Observaciones</label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          placeholder="Contactos, dirección, interés..."
          rows={3}
        />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={loading} disabled={!name.trim()}>
          {locating ? "Obteniendo ubicación..." : "Registrar Visita"}
        </Button>
      </div>
    </form>
  );
};

export default ClientesPage;
