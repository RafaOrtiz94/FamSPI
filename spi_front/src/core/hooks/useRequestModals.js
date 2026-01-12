import { useState, useCallback } from "react";

/**
 * Hook personalizado para manejar modales de solicitudes
 * Centraliza la lógica de apertura y cierre de modales de diferentes tipos
 */

export const useRequestModals = () => {
  // Estados para cada tipo de modal
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [newPublicPurchaseModalOpen, setNewPublicPurchaseModalOpen] = useState(false);
  const [privatePurchaseModalOpen, setPrivatePurchaseModalOpen] = useState(false);
  const [businessCaseModalOpen, setBusinessCaseModalOpen] = useState(false);
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [equipmentModalOpen, setEquipmentModalOpen] = useState(false);

  // Estados para datos de edición
  const [editingRequest, setEditingRequest] = useState(null);

  // Función para abrir modal específico
  const openModal = useCallback((type, requestData = null) => {
    setEditingRequest(requestData);

    switch (type) {
      case 'CLIENT':
        setClientModalOpen(true);
        break;
      case 'PUBLIC_PURCHASE':
        setPurchaseModalOpen(true);
        break;
      case 'NEW_PUBLIC_PURCHASE':
        setNewPublicPurchaseModalOpen(true);
        break;
      case 'PRIVATE_PURCHASE':
        setPrivatePurchaseModalOpen(true);
        break;
      case 'BUSINESS_CASE':
        setBusinessCaseModalOpen(true);
        break;
      case 'MAINTENANCE':
        setMaintenanceModalOpen(true);
        break;
      case 'PERMISSION':
        setPermissionModalOpen(true);
        break;
      case 'EQUIPMENT':
        setEquipmentModalOpen(true);
        break;
      default:
        console.warn(`Tipo de modal desconocido: ${type}`);
    }
  }, []);

  // Función para cerrar modal específico
  const closeModal = useCallback((type) => {
    switch (type) {
      case 'CLIENT':
        setClientModalOpen(false);
        break;
      case 'PUBLIC_PURCHASE':
        setPurchaseModalOpen(false);
        break;
      case 'NEW_PUBLIC_PURCHASE':
        setNewPublicPurchaseModalOpen(false);
        break;
      case 'PRIVATE_PURCHASE':
        setPrivatePurchaseModalOpen(false);
        break;
      case 'BUSINESS_CASE':
        setBusinessCaseModalOpen(false);
        break;
      case 'MAINTENANCE':
        setMaintenanceModalOpen(false);
        break;
      case 'PERMISSION':
        setPermissionModalOpen(false);
        break;
      case 'EQUIPMENT':
        setEquipmentModalOpen(false);
        break;
      default:
        // Cerrar todos los modales
        setClientModalOpen(false);
        setPurchaseModalOpen(false);
        setNewPublicPurchaseModalOpen(false);
        setPrivatePurchaseModalOpen(false);
        setBusinessCaseModalOpen(false);
        setMaintenanceModalOpen(false);
        setPermissionModalOpen(false);
        setEquipmentModalOpen(false);
    }
    setEditingRequest(null);
  }, []);

  // Función para cerrar todos los modales
  const closeAllModals = useCallback(() => {
    setClientModalOpen(false);
    setPurchaseModalOpen(false);
    setNewPublicPurchaseModalOpen(false);
    setPrivatePurchaseModalOpen(false);
    setBusinessCaseModalOpen(false);
    setMaintenanceModalOpen(false);
    setPermissionModalOpen(false);
    setEquipmentModalOpen(false);
    setEditingRequest(null);
  }, []);

  // Estados de todos los modales
  const modalStates = {
    clientModalOpen,
    purchaseModalOpen,
    newPublicPurchaseModalOpen,
    privatePurchaseModalOpen,
    businessCaseModalOpen,
    maintenanceModalOpen,
    permissionModalOpen,
    equipmentModalOpen,
  };

  // Funciones de control
  const modalControls = {
    openModal,
    closeModal,
    closeAllModals,
  };

  return {
    ...modalStates,
    ...modalControls,
    editingRequest,
  };
};

export default useRequestModals;
