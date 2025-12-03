import React, { useEffect, useMemo, useState } from "react";
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
} from "../../../core/api/clientsApi";
import { getUsers } from "../../../core/api/usersApi";
import MyClientRequestsWidget from "../components/MyClientRequestsWidget";

const todayStr = new Date().toISOString().slice(0, 10);

const roleIsManager = (role) =>
  ["jefe_comercial", "gerencia", "gerente", "admin", "administrador", "ti"].includes(role);

const advisorRoles = new Set(["comercial", "acp_comercial", "backoffice"]);

const ClientesPage = () => {
  const { showToast } = useUI();
  const { role, user } = useAuth();
  const isManager = roleIsManager(role);
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

  const normalizeStatus = (status) => {
    const value = (status || "").toLowerCase();
    if (["visited", "visitado"].includes(value)) return "visitado";
    if (["en_visita", "in_visit", "in_progress"].includes(value)) return "en_visita";
    return "pendiente";
  };

  const statusStyles = {
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

  const getStatusMeta = (status) => statusStyles[normalizeStatus(status)] || statusStyles.pendiente;

  const activeStatusMeta = useMemo(() => getStatusMeta(activeClient?.visit_status), [activeClient]);

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
    if (value === "persona_juridica") return "Persona Jurídica";
    if (value === "persona_natural") return "Persona Natural";
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
    // Si es número, null, undefined, objeto, etc., devolver array vacío
    return [];
  };

  const captureLocation = () =>
    new Promise((resolve, reject) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        reject(new Error("La geolocalización no está disponible"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          resolve({ latitude, longitude });
        },
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000 },
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

  const loadClientes = async () => {
    setLoading(true);
    try {
      const data = await fetchClients({ date: todayStr });
      setClientes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      showToast("No pudimos cargar tus clientes", "error");
      setClientes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClientes();
  }, []);

  useEffect(() => {
    if (isManager) loadAdvisors();
  }, [isManager]);

  const visitedCount = useMemo(() => {
    if (!Array.isArray(clientes)) return 0;
    return clientes.filter((c) => normalizeStatus(c.visit_status) === "visitado").length;
  }, [clientes]);

  const pendingCount = useMemo(() => {
    if (!Array.isArray(clientes)) return 0;
    return clientes.filter((c) => normalizeStatus(c.visit_status) !== "visitado").length;
  }, [clientes]);

  const progress = Array.isArray(clientes) && clientes.length > 0 ? Math.round((visitedCount / clientes.length) * 100) : 0;

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

  const filteredAssignedList = useMemo(() => {
    const base = assignedViewFilter === "assigned" ? assignedToMe : createdByMe;
    if (!assignedSearch) return base;
    const q = assignedSearch.toLowerCase();
    return base.filter((c) => {
      const haystack = `${c.nombre || ""} ${c.identificador || ""} ${c.shipping_contact_name || ""} ${c.shipping_address || ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [assignedViewFilter, assignedToMe, createdByMe, assignedSearch]);

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
      const apiCall = modalType === "start" ? startClientVisit : endClientVisit;
      const response = await apiCall(activeClient.id, payload);
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

    return (
      <div
        key={cliente.id}
        className="relative flex flex-col rounded-2xl border border-gray-100 bg-white/80 p-4 shadow-sm backdrop-blur hover:shadow-md transition hover:-translate-y-0.5 cursor-pointer"
        onClick={() => openReportModal(cliente)}
      >
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

        {/* Widget de check‑in / check‑out en cabecera */}
        <MyClientRequestsWidget
          total={Array.isArray(clientes) ? clientes.length : 0}
          visited={visitedCount}
          pending={pendingCount}
          onFilterChange={setStatusFilter}
        />
      </header>

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
              Revisa rápidamente los clientes que tienes asignados o que tú mismo registraste y fueron aprobados.
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
              className={`px-3 py-1 rounded-full transition ${
                assignedViewFilter === "assigned"
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-500"
              }`}
            >
              Asignados a mí ({Array.isArray(assignedToMe) ? assignedToMe.length : 0})
            </button>
            <button
              type="button"
              onClick={() => setAssignedViewFilter("created")}
              className={`px-3 py-1 rounded-full transition ${
                assignedViewFilter === "created"
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-500"
              }`}
            >
              Registrados por mí ({Array.isArray(createdByMe) ? createdByMe.length : 0})
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
              : "No tienes clientes registrados por ti que coincidan con el filtro."}
          </p>
        )}
      </Card>

      <Modal
        open={modalType === "start" || modalType === "end"}
        onClose={closeModal}
        title={modalType === "start" ? "Confirmar inicio de visita" : "Confirmar cierre de visita"}
        maxWidth="max-w-xl"
      >
        {activeClient && (
          <div className="space-y-4 text-sm text-gray-700">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-gray-500">Cliente</p>
                <p className="text-base font-semibold text-gray-900">{activeClient.nombre}</p>
                <p className="text-xs text-gray-500">{activeClient.shipping_contact_name}</p>
              </div>
              <span
                className={`px-3 py-[4px] text-xs font-semibold rounded-full ${
                  activeStatusMeta.chip
                }`}
              >
                {activeStatusMeta.label}
              </span>
            </div>

            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Hora</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatTime(visitModal.timestamp || new Date())}
              </p>
              <p className="mt-1 flex items-center gap-2 text-xs text-gray-600">
                <FiNavigation className="text-blue-600" />
                {visitModal.loadingLocation
                  ? "Obteniendo GPS..."
                  : visitModal.coords
                  ? `Ubicación: ${visitModal.coords.latitude?.toFixed(5)}, ${visitModal.coords.longitude?.toFixed(5)}`
                  : "Ubicación no disponible"}
              </p>
              {visitModal.error && (
                <p className="mt-1 flex items-center gap-2 text-xs text-amber-700">
                  <FiAlertTriangle /> {visitModal.error}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700">Observaciones (opcional)</label>
              <textarea
                value={visitModal.note}
                onChange={(e) => setVisitModal((prev) => ({ ...prev, note: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                rows={3}
                placeholder="Comentario rápido, evidencia o notas internas"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={closeModal}>
                Cancelar
              </Button>
              <Button
                icon={modalType === "start" ? FiMapPin : FiCheckCircle}
                onClick={handleConfirmVisit}
                className="min-w-[140px] justify-center"
              >
                {submittingVisit ? "Guardando..." : modalType === "start" ? "Confirmar inicio" : "Confirmar salida"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={modalType === "report"}
        onClose={closeModal}
        title="Reporte de visita"
        maxWidth="max-w-3xl"
      >
        {activeClient && (
          <div className="space-y-4 text-sm text-gray-700">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500">Cliente</p>
                <p className="text-lg font-semibold text-gray-900">{activeClient.nombre}</p>
                <p className="text-xs text-gray-500">{activeClient.shipping_address}</p>
              </div>
              <div className="text-right">
                <span
                  className={`px-3 py-[4px] text-xs font-semibold rounded-full ${
                    activeStatusMeta.chip
                  }`}
                >
                  {activeStatusMeta.label}
                </span>
                <p className="mt-1 text-[11px] text-gray-500">ID #{activeClient.id}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm">
                <p className="text-xs text-gray-500">Hora de entrada</p>
                <p className="text-base font-semibold text-gray-900">{formatTime(activeClient.hora_entrada)}</p>
                {activeClient.lat_entrada && activeClient.lng_entrada && (
                  <a
                    href={`https://www.google.com/maps?q=${activeClient.lat_entrada},${activeClient.lng_entrada}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    <FiMapPin /> Ver ubicación
                  </a>
                )}
              </div>
              <div className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm">
                <p className="text-xs text-gray-500">Hora de salida</p>
                <p className="text-base font-semibold text-gray-900">{formatTime(activeClient.hora_salida)}</p>
                {activeClient.lat_salida && activeClient.lng_salida && (
                  <a
                    href={`https://www.google.com/maps?q=${activeClient.lat_salida},${activeClient.lng_salida}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    <FiMapPin /> Ver ubicación
                  </a>
                )}
              </div>
              <div className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm">
                <p className="text-xs text-gray-500">Duración</p>
                <p className="text-base font-semibold text-gray-900">
                  {formatDuration(activeClient.duracion_minutos ?? calculateDuration(activeClient))}
                </p>
                <p className="text-[11px] text-gray-500">Calculada automáticamente</p>
              </div>
            </div>

            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs font-semibold text-gray-700">Asignado a</p>
              <p className="text-sm text-gray-800">
                {(() => {
                  const asignadosArray = normalizeAsignados(activeClient.asignados);
                  return asignadosArray.length > 0 ? asignadosArray.join(", ") : "Sin asignar";
                })()}
              </p>
              <p className="mt-2 text-xs font-semibold text-gray-700">Contacto</p>
              <p className="text-sm text-gray-800">{activeClient.shipping_contact_name || "Sin contacto"}</p>
              <p className="text-xs text-gray-600">{activeClient.shipping_phone || "Sin teléfono"}</p>
            </div>

            {activeClient.observaciones && (
              <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold text-gray-700">Observaciones</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{activeClient.observaciones}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {normalizeStatus(activeClient.visit_status) === "en_visita" && (
                <Button icon={FiCheckCircle} onClick={() => openVisitFlow(activeClient, "end")}>
                  Finalizar visita
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ClientesPage;
