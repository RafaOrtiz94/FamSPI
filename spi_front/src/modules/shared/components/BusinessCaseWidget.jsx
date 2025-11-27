import React, { useEffect, useMemo, useState } from "react";
import { FiExternalLink, FiRefreshCw, FiSend, FiPlus, FiClipboard, FiDatabase } from "react-icons/fi";
import {
  addBusinessCaseItem,
  listBusinessCaseItems,
  listEquipmentPurchases,
  updateBusinessCaseFields,
} from "../../../core/api/equipmentPurchasesApi";
import Button from "../../../core/ui/components/Button";
import Card from "../../../core/ui/components/Card";
import { useAuth } from "../../../core/auth/AuthContext";
import { useUI } from "../../../core/ui/useUI";

const FIELD_GROUPS = [
  {
    title: "Identificación",
    description: "Datos generales del proceso y ubicación",
    fields: [
      { label: "TIPO DE CLIENTE", placeholder: "Público / Privado" },
      { label: "ENTIDAD CONTRATANTE", placeholder: "Entidad contratante" },
      { label: "CLIENTE", placeholder: "Razón social o nombre comercial" },
      { label: "Provincia /Ciudad", placeholder: "Provincia / Ciudad" },
      { label: "Código del Proceso", placeholder: "Código interno o referencia" },
      { label: "Objeto de contratación", placeholder: "Objeto o alcance" },
    ],
  },
  {
    title: "Ambiente de laboratorio",
    description: "Carga operacional y controles de calidad",
    fields: [
      { label: "Número de días por semana que trabaja el laboratorio", placeholder: "5" },
      { label: "Turnos por dia", placeholder: "2" },
      { label: "Horas por turno", placeholder: "8" },
      { label: "Controles de calidad por turno", placeholder: "2" },
      { label: "Niveles de Control", placeholder: "2 niveles" },
      { label: "Frecuencia de controles de calidad  (Rutina)", placeholder: "Semanal" },
      { label: "Pruebas Especiales", placeholder: "Lista de pruebas" },
      { label: "Frecuencia de controles de calidad pruebas especiales", placeholder: "Mensual" },
    ],
  },
  {
    title: "Equipamiento",
    description: "Inventario requerido y estado del equipo",
    fields: [
      { label: "Nombre de Equipo Principal", placeholder: "Analizador" },
      { label: "Estado de equipo principal (nuevo / usado/ año de fabricación) TDR", placeholder: "Nuevo" },
      { label: "Estado de equipo: Propio / Alquilado /Nuevo /Reservado/ Serie (FAM)", placeholder: "Reservado" },
      { label: "Imagen reserva de equipo", placeholder: "URL o referencia" },
      { label: "Nombre de Equipo Back up", placeholder: "Equipo respaldo" },
      { label: "Estado de equipo back up (nuevo / usado/ año de fabricación)", placeholder: "Usado 2022" },
      { label: "Se debe instalar a la par del equipo principal? SI/NO", placeholder: "Sí/No" },
      { label: "Ubicación de los equipos a instalar", placeholder: "Área o sala" },
      { label: "Permite equipo provisional", placeholder: "Sí/No" },
      { label: "Requiere equipo complementario) SI/NO", placeholder: "Sí/No" },
      { label: "Equipo complementario, para que prueba", placeholder: "Detalle" },
    ],
  },
  {
    title: "LIS",
    description: "Integraciones y flujos informáticos",
    fields: [
      { label: "Incluye LIS : Si / No", placeholder: "Sí/No" },
      { label: "Proveedor del sistema a trabajar", placeholder: "Proveedor" },
      { label: "Incluye Hadware: Si/No", placeholder: "Sí/No" },
      { label: "Número de pacientes MENSUAL", placeholder: "1200" },
      { label: "Interfaz a sistema actual", placeholder: "Sí/No" },
      { label: "Nombre del sistema", placeholder: "Sistema actual" },
      { label: "Proveedor", placeholder: "Proveedor actual" },
      { label: "Incluye Hadware: Si/No ", placeholder: "Sí/No" },
      { label: "Interfaz de equipos", placeholder: "Descripción" },
      { label: "Modelo / Proveedor", placeholder: "Modelo / Proveedor" },
      { label: "Modelo / Proveedor ", placeholder: "Modelo / Proveedor" },
      { label: "Modelo / Proveedor  ", placeholder: "Modelo / Proveedor" },
    ],
  },
  {
    title: "Requerimiento del BC",
    description: "Plazos y proyecciones de entrega",
    fields: [
      { label: "Plazo", placeholder: "30 días" },
      { label: "Proyección de plazo", placeholder: "60 días" },
      { label: "Total/Parcial - tiempo/Parcial a necesidad del laboratorio", placeholder: "Total" },
      { label: "Determinacion Efectiva Si/No", placeholder: "Sí/No" },
      { label: "Cobro de arriendo de equipamento", placeholder: "Monto o condición" },
      { label: "Compromiso de compra", placeholder: "Compromiso u observación" },
      { label: "Presupuesto Referencial de proceso", placeholder: "Valor referencial" },
      { label: "Observaciones", placeholder: "Notas adicionales" },
      { label: "Observaciones de Jefe de Operaciones", placeholder: "Notas operativas" },
    ],
  },
];

const ROLE_FIELD_MAP = {
  gerencia: [
    ...FIELD_GROUPS.flatMap((group) => group.fields.map((f) => f.label)),
    "Cobro de arriendo de equipamento",
    "Compromiso de compra",
  ],
  acp_comercial: [
    ...FIELD_GROUPS.flatMap((group) => group.fields.map((f) => f.label)),
    "Presupuesto Referencial de proceso",
    "Observaciones",
  ],
  jefe_comercial: [
    ...FIELD_GROUPS.flatMap((group) => group.fields.map((f) => f.label)),
    "Presupuesto Referencial de proceso",
    "Observaciones",
  ],
  jefe_operaciones: [
    ...FIELD_GROUPS.flatMap((group) => group.fields.map((f) => f.label)),
    "Cobro de arriendo de equipamento",
    "Compromiso de compra",
    "Presupuesto Referencial de proceso",
    "Observaciones",
    "Observaciones de Jefe de Operaciones",
  ],
};

const STATUS_LABELS = {
  waiting_proforma: "Esperando proforma",
  proforma_received: "Proforma recibida",
  waiting_signed_proforma: "Esperando proforma firmada",
  pending_contract: "Pendiente contrato",
  completed: "Completado",
};

const BusinessCaseWidget = ({ title = "Business Case", compact = false }) => {
  const { user } = useAuth();
  const { showToast } = useUI();
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const [itemsByRequest, setItemsByRequest] = useState({});
  const [itemsLoading, setItemsLoading] = useState({});
  const [newItem, setNewItem] = useState({});

  const normalizedRole = useMemo(() => (user?.role || "").toLowerCase(), [user]);

  const allowedLabels = useMemo(() => {
    const base = FIELD_GROUPS.flatMap((group) => group.fields.map((f) => f.label));
    return new Set(ROLE_FIELD_MAP[normalizedRole] || base);
  }, [normalizedRole]);

  const canEditPrices = normalizedRole === "jefe_operaciones";

  const buildDraftFromRequest = (req) => {
    const extra = req.extra || {};
    return {
      "TIPO DE CLIENTE": extra.tipo_cliente || "",
      "ENTIDAD CONTRATANTE": extra.entidad_contratante || "",
      CLIENTE: req.client_name || "",
      "Provincia /Ciudad": extra.ciudad || extra.provincia || "",
      "Código del Proceso": extra.codigo_proceso || "",
      "Objeto de contratación": extra.objeto_contratacion || "",
      "Número de días por semana que trabaja el laboratorio": extra.dias_lab || "",
      "Turnos por dia": extra.turnos_dia || "",
      "Horas por turno": extra.horas_turno || "",
      "Controles de calidad por turno": extra.controles_por_turno || "",
      "Niveles de Control": extra.niveles_control || "",
      "Frecuencia de controles de calidad  (Rutina)": extra.frecuencia_calidad || "",
      "Pruebas Especiales": extra.pruebas_especiales || "",
      "Frecuencia de controles de calidad pruebas especiales": extra.frecuencia_especiales || "",
      "Nombre de Equipo Principal": extra.equipo_principal || "",
      "Estado de equipo principal (nuevo / usado/ año de fabricación) TDR": extra.estado_equipo_principal || "",
      "Estado de equipo: Propio / Alquilado /Nuevo /Reservado/ Serie (FAM)": extra.estado_equipo_propiedad || "",
      "Imagen reserva de equipo": extra.imagen_reserva_equipo || "",
      "Nombre de Equipo Back up": extra.equipo_backup || "",
      "Estado de equipo back up (nuevo / usado/ año de fabricación)": extra.estado_equipo_backup || "",
      "Se debe instalar a la par del equipo principal? SI/NO": extra.backup_paralelo || "",
      "Ubicación de los equipos a instalar": extra.ubicacion_equipos || "",
      "Permite equipo provisional": extra.permite_equipo_provisional || "",
      "Requiere equipo complementario) SI/NO": extra.requiere_equipo_complementario || "",
      "Equipo complementario, para que prueba": extra.equipo_complementario_para || "",
      "Incluye LIS : Si / No": extra.incluye_lis || "",
      "Proveedor del sistema a trabajar": extra.proveedor_lis || "",
      "Incluye Hadware: Si/No": extra.incluye_hardware || "",
      "Número de pacientes MENSUAL": extra.pacientes_mensual || "",
      "Interfaz a sistema actual": extra.interfaz_sistema_actual || "",
      "Nombre del sistema": extra.nombre_sistema || "",
      Proveedor: extra.proveedor_sistema || "",
      "Incluye Hadware: Si/No ": extra.incluye_hardware_actual || "",
      "Interfaz de equipos": extra.interfaz_equipos || "",
      "Modelo / Proveedor": extra.interfaz_modelo_1 || "",
      "Modelo / Proveedor ": extra.interfaz_modelo_2 || "",
      "Modelo / Proveedor  ": extra.interfaz_modelo_3 || "",
      Plazo: extra.plazo || "",
      "Proyección de plazo": extra.proyeccion_plazo || "",
      "Total/Parcial - tiempo/Parcial a necesidad del laboratorio": extra.entregas_plan || "",
      "Determinacion Efectiva Si/No": extra.determinacion_efectiva || "",
      "Cobro de arriendo de equipamento": extra.cobro_arriendo || "",
      "Compromiso de compra": extra.compromiso_compra || "",
      "Presupuesto Referencial de proceso": extra.presupuesto_referencial || "",
      Observaciones: extra.observaciones || "",
      "Observaciones de Jefe de Operaciones": extra.observaciones_operaciones || "",
    };
  };

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await listEquipmentPurchases();
      setRequests(data || []);
      const nextDrafts = {};
      (data || []).forEach((req) => {
        nextDrafts[req.id] = buildDraftFromRequest(req);
      });
      setDrafts(nextDrafts);
    } catch (error) {
      console.error(error);
      showToast("No se pudieron cargar los Business Case", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const filteredRequests = useMemo(() => {
    const q = (query || "").toLowerCase();
    const bcReady = requests.filter((req) => req.status && req.status !== "pending_provider_assignment");
    if (!q) return bcReady;
    return bcReady.filter((req) =>
      [req.client_name, req.assigned_to_name, req.assigned_to_email, req.provider_email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [query, requests]);

  const visibleRequests = compact ? filteredRequests.slice(0, 3) : filteredRequests;

  const handleSave = async (id) => {
    const current = drafts[id] || {};
    const payload = Object.fromEntries(
      Object.entries(current).filter(([label]) => allowedLabels.has(label)),
    );

    if (!Object.keys(payload).length) {
      showToast("No hay campos editables para tu rol", "warning");
      return;
    }

    setSaving(true);
    try {
      await updateBusinessCaseFields(id, payload);
      showToast("Business Case actualizado", "success");
    } catch (error) {
      console.error(error);
      showToast("No se pudieron guardar los campos", "error");
    } finally {
      setSaving(false);
    }
  };

  const loadItems = async (id) => {
    setItemsLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const items = await listBusinessCaseItems(id);
      setItemsByRequest((prev) => ({ ...prev, [id]: items }));
    } catch (error) {
      console.error(error);
      showToast("No se pudieron cargar las inversiones adicionales", "error");
    } finally {
      setItemsLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleAddItem = async (id) => {
    const draft = newItem[id] || {};
    if (!draft.name) {
      showToast("Ingresa un concepto para la inversión adicional", "warning");
      return;
    }

    try {
      await addBusinessCaseItem(id, draft);
      showToast("Inversión registrada", "success");
      setNewItem((prev) => ({ ...prev, [id]: {} }));
      await loadItems(id);
    } catch (error) {
      console.error(error);
      showToast("No se pudo guardar la inversión", "error");
    }
  };

  const fieldGroups = useMemo(
    () =>
      FIELD_GROUPS.map((group) => ({
        ...group,
        fields: group.fields.filter((field) => allowedLabels.has(field.label)),
      })).filter((group) => group.fields.length > 0),
    [allowedLabels],
  );

  return (
    <Card className="p-4 border border-gray-200">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
        <div>
          <p className="text-xs uppercase text-gray-500 font-semibold">{title}</p>
          <h3 className="text-lg font-semibold text-gray-900">Seguimiento de Business Case</h3>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Buscar por cliente o responsable"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <Button variant="secondary" icon={FiRefreshCw} onClick={loadRequests} loading={loading}>
            Actualizar
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando Business Case...</p>
      ) : visibleRequests.length === 0 ? (
        <p className="text-sm text-gray-500">No hay solicitudes en etapa de Business Case.</p>
      ) : (
        <div className="space-y-3">
          {visibleRequests.map((req) => (
            <div key={req.id} className="border border-gray-100 rounded-lg p-3 bg-white shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <FiClipboard className="text-blue-500" /> {req.client_name}
                  </p>
                  <p className="text-xs text-gray-500">Asignado a: {req.assigned_to_name || req.assigned_to_email || "Sin asignar"}</p>
                  <p className="text-xs text-gray-500">
                    Estado: {STATUS_LABELS[req.status] || req.status || "-"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {req.business_case_link && (
                    <a
                      href={req.business_case_link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg border border-blue-100"
                    >
                      <FiExternalLink /> Abrir en Sheets
                    </a>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setExpanded((prev) => (prev === req.id ? null : req.id));
                      if (!itemsByRequest[req.id]) {
                        loadItems(req.id);
                      }
                    }}
                  >
                    Detalles BC
                  </Button>
                </div>
              </div>

              {expanded === req.id && (
                <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="space-y-3">
                    {fieldGroups.map((group) => (
                      <div key={group.title} className="border border-gray-100 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <FiDatabase className="text-gray-500" />
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{group.title}</p>
                            <p className="text-xs text-gray-500">{group.description}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {group.fields.map((field) => (
                            <label key={field.label} className="text-xs text-gray-600 space-y-1">
                              <span className="block font-semibold">{field.label}</span>
                              <input
                                type="text"
                                value={(drafts[req.id] || {})[field.label] || ""}
                                onChange={(e) =>
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [req.id]: { ...(prev[req.id] || {}), [field.label]: e.target.value },
                                  }))
                                }
                                placeholder={field.placeholder}
                                className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm"
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-end">
                      <Button
                        icon={FiSend}
                        loading={saving}
                        onClick={() => handleSave(req.id)}
                        disabled={saving}
                      >
                        Guardar campos
                      </Button>
                    </div>
                  </div>

                  <div className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Inversiones adicionales</p>
                        <p className="text-xs text-gray-500">Productos y servicios extra del Business Case</p>
                      </div>
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => loadItems(req.id)}
                        loading={!!itemsLoading[req.id]}
                      >
                        Recargar
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input
                          className="border border-gray-200 rounded-lg px-2 py-2 text-sm"
                          placeholder="Concepto"
                          value={(newItem[req.id] || {}).name || ""}
                          onChange={(e) => setNewItem((prev) => ({ ...prev, [req.id]: { ...(prev[req.id] || {}), name: e.target.value } }))}
                        />
                        <input
                          className="border border-gray-200 rounded-lg px-2 py-2 text-sm"
                          placeholder="Estado"
                          value={(newItem[req.id] || {}).status || ""}
                          onChange={(e) => setNewItem((prev) => ({ ...prev, [req.id]: { ...(prev[req.id] || {}), status: e.target.value } }))}
                        />
                        <input
                          className="border border-gray-200 rounded-lg px-2 py-2 text-sm"
                          placeholder="Características"
                          value={(newItem[req.id] || {}).characteristics || ""}
                          onChange={(e) =>
                            setNewItem((prev) => ({
                              ...prev,
                              [req.id]: { ...(prev[req.id] || {}), characteristics: e.target.value },
                            }))
                          }
                        />
                        <input
                          className="border border-gray-200 rounded-lg px-2 py-2 text-sm"
                          placeholder="Cantidad"
                          type="number"
                          value={(newItem[req.id] || {}).quantity || ""}
                          onChange={(e) =>
                            setNewItem((prev) => ({
                              ...prev,
                              [req.id]: { ...(prev[req.id] || {}), quantity: e.target.value },
                            }))
                          }
                        />
                        {canEditPrices && (
                          <>
                            <input
                              className="border border-gray-200 rounded-lg px-2 py-2 text-sm"
                              placeholder="Precio"
                              type="number"
                              value={(newItem[req.id] || {}).price || ""}
                              onChange={(e) =>
                                setNewItem((prev) => ({
                                  ...prev,
                                  [req.id]: { ...(prev[req.id] || {}), price: e.target.value },
                                }))
                              }
                            />
                            <input
                              className="border border-gray-200 rounded-lg px-2 py-2 text-sm"
                              placeholder="Total"
                              type="number"
                              value={(newItem[req.id] || {}).total || ""}
                              onChange={(e) =>
                                setNewItem((prev) => ({
                                  ...prev,
                                  [req.id]: { ...(prev[req.id] || {}), total: e.target.value },
                                }))
                              }
                            />
                          </>
                        )}
                      </div>
                      <div className="flex justify-end">
                        <Button size="sm" icon={FiPlus} onClick={() => handleAddItem(req.id)}>
                          Registrar inversión
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 bg-white rounded-lg border border-gray-200 p-2 max-h-56 overflow-y-auto">
                      {itemsLoading[req.id] ? (
                        <p className="text-sm text-gray-500">Cargando inversiones...</p>
                      ) : (itemsByRequest[req.id] || []).length ? (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-500">
                              <th className="py-1 px-2 text-left">Concepto</th>
                              <th className="py-1 px-2 text-left">Estado</th>
                              <th className="py-1 px-2 text-left">Cantidad</th>
                              {canEditPrices && <th className="py-1 px-2 text-left">Precio</th>}
                              {canEditPrices && <th className="py-1 px-2 text-left">Total</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {(itemsByRequest[req.id] || []).map((item) => (
                              <tr key={item.id} className="border-t">
                                <td className="py-1 px-2 font-semibold text-gray-900">{item.name}</td>
                                <td className="py-1 px-2 text-gray-700">{item.status || "-"}</td>
                                <td className="py-1 px-2 text-gray-700">{item.quantity ?? "-"}</td>
                                {canEditPrices && <td className="py-1 px-2 text-gray-700">{item.price ?? "-"}</td>}
                                {canEditPrices && <td className="py-1 px-2 text-gray-700">{item.total ?? "-"}</td>}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-sm text-gray-500">Sin inversiones registradas.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default BusinessCaseWidget;
