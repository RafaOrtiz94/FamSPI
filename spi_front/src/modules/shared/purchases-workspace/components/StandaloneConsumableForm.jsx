import React, { useEffect, useMemo, useState } from "react";
import { FiCheck, FiChevronDown, FiChevronUp, FiLoader, FiPackage, FiSearch, FiSend, FiUserPlus, FiX } from "react-icons/fi";

import { fetchClients } from "../../../../core/api/clientsApi";
import { previewStandaloneConsumableCatalog, requestClientAssignment } from "../../../../core/api/consumableFilesApi";
import { getEquipmentModels } from "../../../../core/api/equipmentManagementApi";
import Modal from "../../../../core/ui/components/Modal";
import { useUI } from "../../../../core/ui/UIContext";
import NewClientRequestForm from "../../../comercial/components/NewClientRequestForm";

const CATEGORY_LABELS = {
  chemistry: "Quimica",
  immunology: "Inmunologia",
  hematology: "Hematologia",
  bgm: "Gasometria",
};

export const createStandaloneFormState = () => ({
  processName: "",
  processCode: "",
  clientId: null,
  clientLabel: "",
  sameEntityAsClient: false,
  contractingEntity: "",
  contractObject: "",
  equipmentIds: [],
});

export const buildStandaloneFormStateFromFile = (file) => {
  const standalone = file?.metadata?.standalone && typeof file.metadata.standalone === "object"
    ? file.metadata.standalone
    : {};
  return {
    processName: file?.process_name || "",
    processCode: file?.process_code || "",
    clientId: standalone.client_id || file?.client_id || null,
    clientLabel: standalone.client_name || standalone.client_snapshot?.name || "",
    sameEntityAsClient: Boolean(standalone.same_entity_as_client),
    contractingEntity: standalone.contracting_entity || "",
    contractObject: standalone.contract_object || "",
    equipmentIds: Array.isArray(standalone.selected_equipment_ids)
      ? standalone.selected_equipment_ids.map((value) => Number(value)).filter(Number.isFinite)
      : [],
  };
};

const inputClassName = "min-h-11 w-full rounded-xl border border-[#D1D5DB] bg-white px-3 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 disabled:bg-[#F9FAFB] disabled:text-[#6B7280]";

// ponytail: GET /clients (listAccessibleClients) devuelve cr.commercial_name AS nombre,
// no nombre_comercial/razon_social (esos son columnas de la tabla legacy clients).
const getClientLabel = (client) => client?.nombre || `Cliente #${client?.id}`;

const getActiveAssignment = (client) => (
  (client?.assignment_details || []).find((entry) => entry?.is_active) || null
);

const normalizeEquipment = (equipment) => ({
  id: Number(equipment.id),
  label: equipment.name || equipment.model || `Equipo ${equipment.id}`,
  category: String(equipment.category || "").trim().toLowerCase(),
});

const ClientActionButtons = ({ clientId, assignedAdvisor, onRegister, onRequestAssignment, requesting }) => (
  <div className="flex flex-wrap gap-2">
    {assignedAdvisor ? (
      <span
        title={assignedAdvisor.email || undefined}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#BBF7D0] bg-[#F0FDF4] px-3 text-xs font-medium text-[#166534]"
      >
        <FiUserPlus size={13} />
        Asignado a {assignedAdvisor.name}
      </span>
    ) : clientId ? (
      <button
        type="button"
        onClick={onRequestAssignment}
        disabled={requesting}
        title="Solicitar asignacion de este cliente a jefe de operaciones"
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-3 text-xs font-medium text-[#1D4ED8] hover:bg-[#DBEAFE] active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
      >
        {requesting ? <FiLoader size={13} className="animate-spin" /> : <FiSend size={13} />}
        Solicitar asignacion
      </button>
    ) : (
      <button
        type="button"
        onClick={onRegister}
        title="Abrir solicitud de registro de este cliente"
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-3 text-xs font-medium text-[#92400E] hover:bg-[#FEF3C7] active:scale-[0.97]"
      >
        <FiUserPlus size={13} />
        Registrar cliente
      </button>
    )}
  </div>
);

const LockedField = ({ label, value: fieldValue }) => (
  <div className="space-y-2">
    <span className="text-xs font-medium text-[#1F2937]">{label}</span>
    <div className="min-h-11 w-full rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2.5 text-sm text-[#1F2937]">
      {fieldValue || "Sin dato"}
    </div>
  </div>
);

const StandaloneConsumableForm = ({
  value,
  onChange,
  disabled = false,
  showProcessFields = true,
  bcLocked = false,
  bcAssignedAdvisor = null,
}) => {
  const [clientQuery, setClientQuery] = useState("");
  const [clientResults, setClientResults] = useState([]);
  const [manualAssignedAdvisor, setManualAssignedAdvisor] = useState(null);
  const assignedAdvisor = bcLocked ? bcAssignedAdvisor : manualAssignedAdvisor;
  const [clientsLoading, setClientsLoading] = useState(false);
  const [equipmentQuery, setEquipmentQuery] = useState("");
  const [equipmentOptions, setEquipmentOptions] = useState([]);
  const [equipmentLoading, setEquipmentLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [equipmentPickerOpen, setEquipmentPickerOpen] = useState(!(value?.equipmentIds || []).length);
  const [registerClientModalOpen, setRegisterClientModalOpen] = useState(false);
  const [assignRequesting, setAssignRequesting] = useState(false);
  const { showToast } = useUI();

  const handleRequestAssignment = async () => {
    if (!value?.clientId) return;
    setAssignRequesting(true);
    try {
      await requestClientAssignment({ clientId: value.clientId, clientLabel: value.clientLabel });
      showToast("Solicitud de asignacion enviada a jefe de operaciones", "success");
    } catch (assignError) {
      showToast(assignError?.response?.data?.message || assignError?.message || "No se pudo enviar la solicitud", "error");
    } finally {
      setAssignRequesting(false);
    }
  };

  const selectedEquipmentIds = useMemo(
    () => (Array.isArray(value?.equipmentIds) ? value.equipmentIds : []),
    [value?.equipmentIds],
  );

  useEffect(() => {
    let cancelled = false;
    setEquipmentLoading(true);
    getEquipmentModels(equipmentQuery.trim() ? { search: equipmentQuery.trim() } : {})
      .then((rows) => {
        if (!cancelled) {
          setEquipmentOptions((Array.isArray(rows) ? rows : []).map(normalizeEquipment));
        }
      })
      .catch(() => {
        if (!cancelled) setEquipmentOptions([]);
      })
      .finally(() => {
        if (!cancelled) setEquipmentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [equipmentQuery]);

  useEffect(() => {
    let cancelled = false;
    if (!clientQuery.trim() || clientQuery.trim().length < 2) {
      setClientResults([]);
      return () => {};
    }
    const timer = setTimeout(() => {
      setClientsLoading(true);
      fetchClients({ q: clientQuery.trim() })
        .then((response) => {
          if (!cancelled) setClientResults(Array.isArray(response?.clients) ? response.clients : []);
        })
        .catch(() => {
          if (!cancelled) setClientResults([]);
        })
        .finally(() => {
          if (!cancelled) setClientsLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [clientQuery]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedEquipmentIds.length) {
      setPreview(null);
      return () => {};
    }
    const timer = setTimeout(() => {
      setPreviewLoading(true);
      previewStandaloneConsumableCatalog({ equipmentIds: selectedEquipmentIds })
        .then((response) => {
          if (!cancelled) setPreview(response);
        })
        .catch(() => {
          if (!cancelled) setPreview(null);
        })
        .finally(() => {
          if (!cancelled) setPreviewLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedEquipmentIds]);

  const selectedEquipment = useMemo(() => {
    const byId = new Map(equipmentOptions.map((item) => [Number(item.id), item]));
    return selectedEquipmentIds.map((id) => byId.get(Number(id)) || { id: Number(id), label: `Equipo ${id}`, category: "" });
  }, [equipmentOptions, selectedEquipmentIds]);

  const setField = (field, nextValue) => {
    onChange?.({
      ...value,
      [field]: nextValue,
    });
  };

  const handleSelectClient = (client) => {
    const clientLabel = getClientLabel(client);
    const activeAssignment = getActiveAssignment(client);
    onChange?.({
      ...value,
      clientId: Number(client.id),
      clientLabel,
      contractingEntity: value?.sameEntityAsClient ? clientLabel : value?.contractingEntity,
    });
    setManualAssignedAdvisor(activeAssignment ? {
      name: activeAssignment.assigned_to_name,
      email: activeAssignment.assigned_to_email,
    } : null);
    setClientQuery("");
    setClientResults([]);
  };

  const handleClearClient = () => {
    onChange?.({
      ...value,
      clientId: null,
      clientLabel: "",
      sameEntityAsClient: false,
    });
    setManualAssignedAdvisor(null);
  };

  const toggleEquipment = (equipmentId) => {
    const normalizedId = Number(equipmentId);
    const currentIds = Array.isArray(value?.equipmentIds) ? value.equipmentIds : [];
    const nextIds = currentIds.includes(normalizedId)
      ? currentIds.filter((id) => Number(id) !== normalizedId)
      : [...currentIds, normalizedId];
    setField("equipmentIds", nextIds);
  };

  return (
    <div className="space-y-5">
      {showProcessFields && (
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-medium text-[#1F2937]">Nombre del proceso</span>
            <input
              value={value?.processName || ""}
              onChange={(event) => setField("processName", event.target.value)}
              disabled={disabled}
              className={inputClassName}
            />
          </label>
          {bcLocked ? (
            <LockedField label="Codigo del proceso" value={value?.processCode} />
          ) : (
            <label className="space-y-2">
              <span className="text-xs font-medium text-[#1F2937]">Codigo del proceso</span>
              <input
                value={value?.processCode || ""}
                onChange={(event) => setField("processCode", event.target.value)}
                disabled={disabled}
                className={inputClassName}
              />
            </label>
          )}
        </div>
      )}

      {bcLocked ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <LockedField label="Entidad contratante" value={value?.contractingEntity} />
          <div className="space-y-2">
            <LockedField label="Cliente" value={value?.clientLabel} />
            <ClientActionButtons
              clientId={value?.clientId}
              assignedAdvisor={assignedAdvisor}
              onRegister={() => setRegisterClientModalOpen(true)}
              onRequestAssignment={handleRequestAssignment}
              requesting={assignRequesting}
            />
          </div>
        </div>
      ) : (
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <label className="space-y-2">
          <span className="text-xs font-medium text-[#1F2937]">Entidad contratante</span>
          <input
            value={value?.sameEntityAsClient && value?.clientLabel ? value.clientLabel : value?.contractingEntity || ""}
            onChange={(event) => setField("contractingEntity", event.target.value)}
            disabled={disabled || (value?.sameEntityAsClient && Boolean(value?.clientLabel))}
            placeholder="Ej. Hospital General Puyo"
            className={inputClassName}
          />
        </label>
        <div className="space-y-2">
          <span className="text-xs font-medium text-[#1F2937]">Cliente</span>
          <ClientActionButtons
            clientId={value?.clientId}
            assignedAdvisor={assignedAdvisor}
            onRegister={() => setRegisterClientModalOpen(true)}
            onRequestAssignment={handleRequestAssignment}
            requesting={assignRequesting}
          />
          {value?.clientId ? (
            <div className="flex min-h-11 items-center justify-between rounded-xl border border-[#D1D5DB] bg-[#F9FAFB] px-3 text-sm text-[#1F2937]">
              <div className="min-w-0">
                <p className="truncate font-medium">{value.clientLabel || `Cliente #${value.clientId}`}</p>
                <p className="text-xs text-[#6B7280]">Cliente vinculado al expediente</p>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={handleClearClient}
                  className="inline-flex min-h-9 items-center justify-center rounded-full border border-[#E5E7EB] px-3 text-xs font-medium text-[#475569] hover:bg-white active:scale-[0.97]"
                >
                  Limpiar
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <FiSearch size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  value={clientQuery}
                  onChange={(event) => setClientQuery(event.target.value)}
                  disabled={disabled}
                  placeholder="Buscar cliente por nombre o razon social"
                  className={`${inputClassName} pl-9`}
                />
              </div>
              {clientsLoading ? (
                <div className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-xs text-[#6B7280]">
                  <FiLoader size={14} className="animate-spin text-[#2563EB]" />
                  Buscando clientes...
                </div>
              ) : null}
              {clientResults.length ? (
                <div className="max-h-44 overflow-y-auto rounded-2xl border border-[#E5E7EB] bg-white">
                  {clientResults.slice(0, 8).map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => handleSelectClient(client)}
                      className="flex w-full cursor-pointer items-start justify-between gap-3 border-b border-[#F1F5F9] px-3 py-3 text-left last:border-b-0 hover:bg-[#F8FAFC] active:scale-[0.99]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#1F2937]">{getClientLabel(client)}</p>
                        <p className="truncate text-xs text-[#6B7280]">
                          {getActiveAssignment(client)?.assigned_to_name
                            ? `Asignado a ${getActiveAssignment(client).assigned_to_name}`
                            : client?.shipping_city || "Sin ciudad"}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#DBEAFE] px-2.5 py-1 text-[11px] font-semibold text-[#1D4ED8]">Elegir</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-xs text-[#475569]">
            <input
              type="checkbox"
              checked={Boolean(value?.sameEntityAsClient)}
              onChange={(event) => {
                const checked = event.target.checked;
                onChange?.({
                  ...value,
                  sameEntityAsClient: checked,
                  contractingEntity: checked && value?.clientLabel ? value.clientLabel : value?.contractingEntity,
                });
              }}
              disabled={disabled || !value?.clientId}
              className="h-4 w-4 rounded border-[#CBD5E1] text-[#2563EB] focus:ring-[#0EA5E9]/20"
            />
            Cliente y entidad contratante son la misma
          </label>
        </div>
      </div>
      )}

      {bcLocked ? (
        <LockedField label="Objeto de contratacion" value={value?.contractObject} />
      ) : (
        <label className="space-y-2">
          <span className="text-xs font-medium text-[#1F2937]">Objeto de contratacion *</span>
          <textarea
            value={value?.contractObject || ""}
            onChange={(event) => setField("contractObject", event.target.value)}
            disabled={disabled}
            rows={3}
            placeholder="Describe el objeto de contratacion en un solo parrafo."
            className="w-full rounded-xl border border-[#D1D5DB] bg-white px-3 py-3 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 disabled:bg-[#F9FAFB] disabled:text-[#6B7280]"
          />
        </label>
      )}

      <div className="space-y-3 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
        <button
          type="button"
          onClick={() => setEquipmentPickerOpen((current) => !current)}
          className="flex w-full cursor-pointer items-start justify-between gap-3 text-left"
        >
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-semibold text-[#1F2937]">
              Equipos vinculados {selectedEquipmentIds.length ? `(${selectedEquipmentIds.length})` : ""}
            </h4>
            <p className="text-xs text-[#6B7280]">
              Selecciona uno o varios equipos. El sistema agrupa automaticamente reactivos, calibradores, controles y materiales por area.
            </p>
          </div>
          <span className="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[#475569] hover:bg-white">
            {equipmentPickerOpen ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
          </span>
        </button>

        {!equipmentPickerOpen && (
          <div className="flex flex-wrap gap-2">
            {selectedEquipment.map((equipment) => (
              <span
                key={equipment.id}
                className="inline-flex items-center gap-2 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1.5 text-xs font-medium text-[#1D4ED8]"
              >
                <FiPackage size={12} />
                <span>{equipment.label}</span>
              </span>
            ))}
            {!selectedEquipment.length ? (
              <span className="text-xs text-[#6B7280]">Aun no has seleccionado equipos.</span>
            ) : null}
          </div>
        )}

        {equipmentPickerOpen && (
        <>
        <div className="relative">
          <FiSearch size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            value={equipmentQuery}
            onChange={(event) => setEquipmentQuery(event.target.value)}
            disabled={disabled}
            placeholder="Buscar equipo por nombre, modelo o categoria"
            className={`${inputClassName} pl-9`}
          />
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-3">
            <div className="max-h-56 overflow-y-auto rounded-2xl border border-[#E5E7EB] bg-white">
              {equipmentLoading ? (
                <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-[#6B7280]">
                  <FiLoader size={14} className="animate-spin text-[#2563EB]" />
                  Cargando equipos...
                </div>
              ) : equipmentOptions.length ? (
                equipmentOptions.map((equipment) => {
                  const selected = selectedEquipmentIds.includes(Number(equipment.id));
                  return (
                    <button
                      key={equipment.id}
                      type="button"
                      onClick={() => toggleEquipment(equipment.id)}
                      disabled={disabled}
                      className={`flex w-full cursor-pointer items-start justify-between gap-3 border-b border-[#F1F5F9] px-3 py-3 text-left last:border-b-0 active:scale-[0.99] ${
                        selected ? "bg-[#EFF6FF]" : "hover:bg-[#F8FAFC]"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#1F2937]">{equipment.label}</p>
                        <p className="truncate text-xs text-[#6B7280]">{CATEGORY_LABELS[equipment.category] || equipment.category || "Sin categoria"}</p>
                      </div>
                      <span className={`inline-flex min-h-8 items-center justify-center rounded-full px-2.5 text-[11px] font-semibold ${
                        selected ? "bg-[#DBEAFE] text-[#1D4ED8]" : "bg-[#F1F5F9] text-[#475569]"
                      }`}>
                        {selected ? <FiCheck size={12} /> : "Agregar"}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="flex min-h-28 items-center justify-center px-4 text-center text-sm text-[#6B7280]">
                  No se encontraron equipos con ese criterio.
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedEquipment.map((equipment) => (
                <span
                  key={equipment.id}
                  className="inline-flex items-center gap-2 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1.5 text-xs font-medium text-[#1D4ED8]"
                >
                  <FiPackage size={12} />
                  <span>{equipment.label}</span>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => toggleEquipment(equipment.id)}
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[#1D4ED8] hover:bg-[#DBEAFE]"
                    >
                      <FiX size={11} />
                    </button>
                  )}
                </span>
              ))}
              {!selectedEquipment.length ? (
                <span className="text-xs text-[#6B7280]">Aun no has seleccionado equipos.</span>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h5 className="text-sm font-semibold text-[#1F2937]">Vista previa de consumibles</h5>
                <p className="text-xs text-[#6B7280]">Se agrupan por area y tipo de insumo.</p>
              </div>
              {previewLoading ? <FiLoader size={15} className="animate-spin text-[#2563EB]" /> : null}
            </div>
            {!preview?.sections?.length ? (
              <div className="mt-4 rounded-2xl border border-dashed border-[#D1D5DB] bg-[#F8FAFC] px-4 py-6 text-center">
                <p className="text-sm font-medium text-[#475569]">Selecciona equipos para visualizar la estructura.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {preview.sections.map((section) => (
                  <div key={section.area_code} className="rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#1F2937]">{section.label}</p>
                        <p className="text-xs text-[#6B7280]">{section.total_items} insumo(s)</p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        {Object.entries(section.items_by_type || {})
                          .filter(([, items]) => Array.isArray(items) && items.length)
                          .map(([type, items]) => (
                            <span key={type} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#475569]">
                              {type} · {items.length}
                            </span>
                          ))}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(section.equipment || []).map((equipment) => (
                        <span key={equipment.id} className="rounded-full border border-[#D1D5DB] bg-white px-2.5 py-1 text-[11px] font-medium text-[#334155]">
                          {equipment.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </>
        )}
      </div>

      <Modal
        open={registerClientModalOpen}
        onClose={() => setRegisterClientModalOpen(false)}
        title="Solicitud de registro de cliente"
        maxWidth="max-w-3xl"
      >
        <NewClientRequestForm
          onCancel={() => setRegisterClientModalOpen(false)}
          onSuccess={() => {
            setRegisterClientModalOpen(false);
            showToast("Solicitud de registro enviada. El cliente quedara disponible cuando se apruebe.", "success");
          }}
        />
      </Modal>
    </div>
  );
};

export default StandaloneConsumableForm;
