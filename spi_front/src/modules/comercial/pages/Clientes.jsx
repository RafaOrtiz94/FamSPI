import React, { useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiClock, FiExternalLink, FiSearch, FiUsers, FiMapPin } from "react-icons/fi";

import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import { useUI } from "../../../core/ui/useUI";
import { useAuth } from "../../../core/auth/useAuth";
import { assignClient, fetchClients, updateVisitStatus } from "../../../core/api/clientsApi";
import { getUsers } from "../../../core/api/usersApi";
import { getFilesByRequest } from "../../../core/api/filesApi";
import MyClientRequestsWidget from "../components/MyClientRequestsWidget";

const todayStr = new Date().toISOString().slice(0, 10);

const roleIsManager = (role) =>
  ["jefe_comercial", "gerencia", "gerente", "admin", "administrador", "ti"].includes(role);

const advisorRoles = new Set(["comercial", "acp_comercial", "backoffice"]);

const ClientesPage = () => {
  const { showToast } = useUI();
  const { role } = useAuth();
  const isManager = roleIsManager(role);

  const [clientes, setClientes] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState({});
  const [advisors, setAdvisors] = useState([]);
  const [filesCache, setFilesCache] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [filesLoading, setFilesLoading] = useState(false);

  const loadAdvisors = async () => {
    try {
      const users = await getUsers();
      const filtered = (users || []).filter((u) => advisorRoles.has(u.role?.toLowerCase?.()));
      setAdvisors(filtered);
    } catch (error) {
      console.error(error);
    }
  };

  const loadClientes = async () => {
    setLoading(true);
    try {
      const data = await fetchClients({ q: query || undefined, date: todayStr });
      setClientes(data || []);
    } catch (error) {
      console.error(error);
      showToast("No pudimos cargar tus clientes", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClientes();
  }, [query]);

  useEffect(() => {
    if (isManager) loadAdvisors();
  }, [isManager]);

  const visitedCount = useMemo(
    () => clientes.filter((c) => c.visit_status === "visited").length,
    [clientes],
  );

  const pendingCount = useMemo(
    () => clientes.length - visitedCount,
    [clientes, visitedCount],
  );

  const progress = clientes.length ? Math.round((visitedCount / clientes.length) * 100) : 0;

  const filteredClientes = useMemo(() => {
    if (!query) return clientes;
    return clientes.filter((c) => {
      const haystack = `${c.nombre || ""} ${c.identificador || ""} ${c.shipping_contact_name || ""}`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    });
  }, [clientes, query]);

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

  const handleVisitStatus = async (clientId, status) => {
    try {
      await updateVisitStatus(clientId, { status, date: todayStr });
      setClientes((prev) => prev.map((c) => (c.id === clientId ? { ...c, visit_status: status } : c)));
    } catch (error) {
      console.error(error);
      showToast("No se pudo actualizar la visita", "error");
    }
  };

  const toggleFiles = async (clientId) => {
    const next = expanded === clientId ? null : clientId;
    setExpanded(next);
    if (next && !filesCache[clientId]) {
      try {
        setFilesLoading(true);
        const files = await getFilesByRequest(clientId);
        setFilesCache((prev) => ({ ...prev, [clientId]: files }));
      } catch (error) {
        console.error(error);
        showToast("No pudimos cargar los archivos del cliente", "error");
      } finally {
        setFilesLoading(false);
      }
    }
  };

  const renderDocs = (clientId) => {
    const docs = filesCache[clientId] || [];
    if (!docs.length) {
      return <p className="text-sm text-gray-500">Sin documentos adjuntos</p>;
    }
    const ficha = docs.filter((d) => d.original_name?.toLowerCase().includes("ficha"));
    const manual = docs.filter((d) => d.original_name?.toLowerCase().includes("manual"));
    const otros = docs.filter(
      (d) => !ficha.includes(d) && !manual.includes(d),
    );

    const renderGroup = (title, items) => (
      <div className="space-y-1">
        <p className="text-xs font-semibold text-gray-600">{title}</p>
        {items.length ? (
          items.map((doc) => (
            <a
              key={doc.id}
              href={doc.download_url || doc.webViewLink || doc.webContentLink}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 text-sm flex items-center gap-2 hover:underline"
            >
              <FiExternalLink /> {doc.original_name || doc.name || "Archivo"}
            </a>
          ))
        ) : (
          <p className="text-xs text-gray-500">No disponible</p>
        )}
      </div>
    );

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {renderGroup("Fichas técnicas", ficha)}
        {renderGroup("Manuales", manual)}
        {renderGroup("Otros", otros)}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FiUsers className="text-blue-600" /> Gestión de Clientes
          </h1>
          <p className="text-sm text-gray-500">
            Clientes aprobados que puedes gestionar, con acceso rápido a fichas técnicas y visitas diarias.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 flex flex-col gap-2">
          <p className="text-sm text-gray-500">Total accesibles</p>
          <p className="text-3xl font-bold text-gray-900">{clientes.length}</p>
          <p className="text-xs text-gray-500">Clientes aprobados filtrados a tu rol</p>
        </Card>
        <Card className="p-4 flex flex-col gap-2">
          <p className="text-sm text-gray-500">Visitados hoy</p>
          <p className="text-3xl font-bold text-green-600">{visitedCount}</p>
          <div className="h-2 bg-gray-200 rounded-full">
            <div
              className="h-2 bg-green-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500">Progreso diario {progress}%</p>
        </Card>
        <Card className="p-4 flex flex-col gap-2">
          <p className="text-sm text-gray-500">Pendientes de visita</p>
          <p className="text-3xl font-bold text-amber-600">{pendingCount}</p>
          <p className="text-xs text-gray-500">Clientes por visitar en el día</p>
        </Card>
      </div>

      <Card className="p-5">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, RUC o contacto..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </Card>

      <MyClientRequestsWidget />

      <Card className="p-5">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Cliente</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Contacto</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Visita de hoy</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Asignados</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Archivos</th>
                {isManager && <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Asignar</th>}
              </tr>
            </thead>
            <tbody>
              {filteredClientes.length ? (
                filteredClientes.map((cliente) => (
                  <React.Fragment key={cliente.id}>
                    <tr className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-gray-900">{cliente.nombre}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <FiMapPin /> {cliente.shipping_address || "Sin dirección"}
                        </p>
                        <p className="text-xs text-gray-500">ID #{cliente.id}</p>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        <p>{cliente.shipping_contact_name || "—"}</p>
                        <p className="text-xs text-gray-500">{cliente.shipping_phone || ""}</p>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant={cliente.visit_status === "visited" ? "success" : "ghost"}
                            onClick={() => handleVisitStatus(cliente.id, "visited")}
                          >
                            <FiCheckCircle className="mr-1" /> Visitado
                          </Button>
                          {cliente.visit_status !== "visited" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleVisitStatus(cliente.id, "pending")}
                            >
                              <FiClock className="mr-1" /> Pendiente
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Estado actual: {cliente.visit_status === "visited" ? "Visitado" : "Pendiente"}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        {cliente.asignados?.length ? cliente.asignados.join(", ") : "Sin asignar"}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2 flex-wrap">
                          {cliente.drive_folder_id && (
                            <a
                              href={`https://drive.google.com/drive/folders/${cliente.drive_folder_id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 text-sm hover:underline"
                            >
                              Carpeta en Drive
                            </a>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => toggleFiles(cliente.id)}>
                            Ver fichas/manuales
                          </Button>
                        </div>
                      </td>
                      {isManager && (
                        <td className="py-3 px-4">
                          <div className="flex flex-col md:flex-row gap-2 items-start md:items-center">
                            <select
                              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                              value={assignments[cliente.id] || ""}
                              onChange={(e) =>
                                setAssignments((prev) => ({ ...prev, [cliente.id]: e.target.value }))
                              }
                            >
                              <option value="">Selecciona asesor</option>
                              {advisors.map((u) => (
                                <option key={u.id} value={u.email}>
                                  {u.fullname || u.name || u.email}
                                </option>
                              ))}
                            </select>
                            <Button size="sm" onClick={() => handleAssign(cliente.id)}>
                              Asignar
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                    {expanded === cliente.id && (
                      <tr className="bg-gray-50">
                        <td colSpan={isManager ? 6 : 5} className="p-4">
                          {filesLoading ? (
                            <p className="text-sm text-gray-500">Cargando archivos...</p>
                          ) : (
                            renderDocs(cliente.id)
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={isManager ? 6 : 5} className="py-10 text-center text-gray-500">
                    {loading ? "Cargando clientes..." : "No se encontraron clientes"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default ClientesPage;
