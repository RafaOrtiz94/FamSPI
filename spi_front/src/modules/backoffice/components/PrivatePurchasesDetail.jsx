// src/modules/backoffice/components/PrivatePurchasesDetail.jsx
import React, { useEffect, useState } from "react";
import { FiArrowLeft, FiSend, FiUpload, FiUserPlus, FiShare } from "react-icons/fi";
import { motion } from "framer-motion";

import { useApi } from "../../../core/hooks/useApi";
import { useAuth } from "../../../core/auth/AuthContext";
import { useUI } from "../../../core/ui/UIContext";
import { getPrivatePurchaseById, sendOffer, uploadSignedOffer, registerClient, forwardToACP } from "../../../core/api/privatePurchasesApi";

import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import Modal from "../../../core/ui/components/Modal";
import FileUploader from "../../../core/ui/components/FileUploader";

const DetailSection = ({ title, children }) => (
  <section className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 dark:border-gray-700 dark:bg-gray-900/40 mb-4">
    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</p>
    <div className="mt-2 space-y-2 text-sm text-gray-700 dark:text-gray-200">{children}</div>
  </section>
);

const FileUploadModal = ({ isOpen, onClose, onSubmit, title, helperText }) => {
  const [file, setFile] = useState(null);

  const handleFileSelect = (files) => {
    if (files.length > 0) setFile(files[0]);
  };

  const handleSubmit = () => {
    if (file) {
      onSubmit(file);
      setFile(null);
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <FileUploader onFilesSelected={handleFileSelect} helper={helperText} accept="application/pdf" />
        {file && <div className="text-sm text-gray-600">Archivo seleccionado: {file.name}</div>}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!file}>Enviar</Button>
        </div>
      </div>
    </Modal>
  );
};

const PrivatePurchasesDetail = ({ item, onBack }) => {
  const { user } = useAuth();
  const { showToast, showLoader, hideLoader, askConfirm } = useUI();
  const [isOfferModalOpen, setOfferModalOpen] = useState(false);
  const [isSignedOfferModalOpen, setSignedOfferModalOpen] = useState(false);

  const { data: detail, loading, error, execute: fetchDetail } = useApi(getPrivatePurchaseById, {
    errorMsg: "Error al cargar el detalle.",
  });

  const { execute: submitOffer } = useApi(sendOffer, { successMsg: "Oferta enviada." });
  const { execute: submitSignedOffer } = useApi(uploadSignedOffer, { successMsg: "Oferta firmada subida." });
  const { execute: submitRegisterClient } = useApi(registerClient, { successMsg: "Cliente registrado." });
  const { execute: submitForwardToACP } = useApi(forwardToACP, { successMsg: "Enviado a ACP." });

  useEffect(() => {
    if (item?.id) fetchDetail(item.id);
  }, [item, fetchDetail]);

  const handleGenericSubmit = async (apiCall, successCallback, ...params) => {
    showLoader();
    try {
      await apiCall(item.id, ...params);
      fetchDetail(item.id);
      if (successCallback) successCallback();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      hideLoader();
    }
  };

  const handleFileSubmit = (file, apiCall, successCallback) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      const base64 = reader.result;
      handleGenericSubmit(apiCall, successCallback, {
        signed_offer_base64: base64,
        file_name: file.name,
        mime_type: file.type,
      });
    };
  };

  const handleRegisterClient = () => askConfirm("¿Confirmas que el cliente ha sido registrado?", () => handleGenericSubmit(submitRegisterClient));
  const handleForwardToACP = () => askConfirm("¿Enviar esta solicitud a ACP?", () => handleGenericSubmit(submitForwardToACP));

  if (loading) return <div>Cargando...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  const { client_snapshot = {}, equipment = [], notes, status, created_at, offer_kind } = detail || {};

  const canSendOffer = user?.role === "backoffice_comercial" && status === "pending_backoffice";
  const canUploadSignedOffer = ["comercial", "jefe_comercial", "gerencia"].includes(user?.role) &&
                                ["pending_manager_signature", "pending_client_signature"].includes(status);
  const canRegisterClient = user?.role === "comercial" && status === "offer_signed";
  const canForwardToACP = user?.role === "backoffice_comercial" && status === "client_registered";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex justify-between items-center mb-4">
        <Button onClick={onBack} icon={FiArrowLeft} variant="secondary">Volver</Button>
        <div className="flex gap-2">
          {canSendOffer && <Button onClick={() => setOfferModalOpen(true)} icon={FiSend}>Enviar Oferta</Button>}
          {canUploadSignedOffer && <Button onClick={() => setSignedOfferModalOpen(true)} icon={FiUpload}>Subir Oferta Firmada</Button>}
          {canRegisterClient && <Button onClick={handleRegisterClient} icon={FiUserPlus}>Registrar Cliente</Button>}
          {canForwardToACP && <Button onClick={handleForwardToACP} icon={FiShare}>Enviar a ACP</Button>}
        </div>
      </div>

      <Card>
        <div className="p-6">
          <h2 className="text-xl font-bold">Detalle #{item.id.substring(0, 8)}</h2>
          <p className="text-sm text-gray-500">Cliente: {client_snapshot.commercial_name}</p>
          <div className="mt-6">
            <DetailSection title="Info">
              <p><strong>Estado:</strong> {status}</p>
              <p><strong>Fecha:</strong> {new Date(created_at).toLocaleString()}</p>
              <p><strong>Tipo:</strong> {offer_kind}</p>
              {notes && <p><strong>Notas:</strong> {notes}</p>}
            </DetailSection>
            <DetailSection title="Equipos">
              {equipment.length > 0 ? (
                <ul>{equipment.map((e, i) => <li key={i}>{e.name} ({e.quantity})</li>)}</ul>
              ) : <p>No hay equipos.</p>}
            </DetailSection>
          </div>
        </div>
      </Card>

      <FileUploadModal isOpen={isOfferModalOpen} onClose={() => setOfferModalOpen(false)}
        onSubmit={(file) => handleFileSubmit(file, submitOffer, () => setOfferModalOpen(false))}
        title="Enviar Oferta" helperText="Selecciona la oferta (PDF)" />
      <FileUploadModal isOpen={isSignedOfferModalOpen} onClose={() => setSignedOfferModalOpen(false)}
        onSubmit={(file) => handleFileSubmit(file, submitSignedOffer, () => setSignedOfferModalOpen(false))}
        title="Subir Oferta Firmada" helperText="Selecciona la oferta firmada (PDF)" />
    </motion.div>
  );
};

export default PrivatePurchasesDetail;
