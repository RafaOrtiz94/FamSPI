import React, { useEffect, useMemo, useState } from "react";
import { createEquipmentPurchase, getEquipmentPurchaseMeta } from "../../../core/api/equipmentPurchasesApi";
import { useAuth } from "../../../core/auth/AuthContext";
import Button from "../../../core/ui/components/Button";
import Modal from "../../../core/ui/components/Modal";
import { useUI } from "../../../core/ui/useUI";
import BusinessCaseWidget from "../../shared/components/BusinessCaseWidget";
import NewBusinessCaseCard from "../components/NewBusinessCaseCard";

const BusinessCasePage = () => {
  const { user } = useAuth();
  const { showToast } = useUI();
  const [creationOpen, setCreationOpen] = useState(false);
  const [metaLoading, setMetaLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [meta, setMeta] = useState({ clients: [], equipment: [], acpUsers: [] });
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState({ clientId: "", equipmentId: "", notes: "", assignedTo: "" });

  const selectedClient = useMemo(
    () => meta.clients.find((client) => `${client.id}` === `${form.clientId}`),
    [meta.clients, form.clientId],
  );

  const selectedEquipment = useMemo(
    () => meta.equipment.find((equipment) => `${equipment.id}` === `${form.equipmentId}`),
    [meta.equipment, form.equipmentId],
  );

  useEffect(() => {
    if (!form.assignedTo && meta.acpUsers?.length) {
      setForm((prev) => ({ ...prev, assignedTo: meta.acpUsers[0].id }));
    }
  }, [meta.acpUsers, form.assignedTo]);

  useEffect(() => {
    if (!creationOpen) return;
    const loadMeta = async () => {
      setMetaLoading(true);
      try {
        const metaRes = await getEquipmentPurchaseMeta();
        setMeta({
          clients: metaRes.clients || [],
          equipment: metaRes.equipment || [],
          acpUsers: metaRes.acp_users || [],
        });
      } catch (error) {
        console.error(error);
        showToast("No se pudieron cargar clientes y equipos", "error");
      } finally {
        setMetaLoading(false);
      }
    };

    loadMeta();
  }, [creationOpen, showToast]);

  const handleOpenModal = () => {
    setCreationOpen(true);
  };

  const handleCloseModal = () => {
    setCreationOpen(false);
    setForm({ clientId: "", equipmentId: "", notes: "", assignedTo: meta.acpUsers?.[0]?.id || "" });
  };

  const handleSubmit = async () => {
    if (!form.clientId || !form.equipmentId) {
      showToast("Selecciona cliente y equipo para crear el Business Case", "warning");
      return;
    }

    const assigneeId = form.assignedTo || meta.acpUsers?.[0]?.id || user?.id || null;

    if (!assigneeId) {
      showToast("No se pudo asignar la solicitud", "error");
      return;
    }

    setCreating(true);
    try {
      const equipmentPayload = selectedEquipment
        ? [
          {
            id: selectedEquipment.id,
            name: selectedEquipment.name,
            sku: selectedEquipment.sku,
            serial: selectedEquipment.serial,
            type: "new",
          },
        ]
        : [];

      await createEquipmentPurchase({
        client_id: form.clientId,
        client_name: selectedClient?.name,
        client_email: selectedClient?.client_email,
        assigned_to: assigneeId,
        equipment: equipmentPayload,
        notes: form.notes || undefined,
      });

      showToast("Business Case creado y enviado", "success");
      setRefreshKey((prev) => prev + 1);
      handleCloseModal();
    } catch (error) {
      console.error(error);
      showToast("No se pudo crear el Business Case", "error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Business Case</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <NewBusinessCaseCard onClick={handleOpenModal} />
        </div>
      </div>

      <BusinessCaseWidget showCommercialStartCards={false} refreshKey={refreshKey} />

      <Modal open={creationOpen} onClose={handleCloseModal} title="Nuevo Business Case" maxWidth="max-w-2xl">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.clientId}
              onChange={(e) => setForm((prev) => ({ ...prev, clientId: e.target.value }))}
              disabled={metaLoading}
            >
              <option value="">Selecciona un cliente</option>
              {meta.clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Equipo</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.equipmentId}
              onChange={(e) => setForm((prev) => ({ ...prev, equipmentId: e.target.value }))}
              disabled={metaLoading}
            >
              <option value="">Selecciona un equipo</option>
              {meta.equipment.map((equipment) => (
                <option key={equipment.id} value={equipment.id}>
                  {equipment.name || equipment.sku || equipment.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Detalles adicionales para el equipo o el cliente"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={handleCloseModal} disabled={creating}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} loading={creating} disabled={metaLoading || creating}>
              Crear Business Case
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default BusinessCasePage;
