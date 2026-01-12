import React from 'react';
import { FiCheck, FiX, FiUpload, FiCalendar, FiTruck, FiFileText, FiAlertTriangle } from 'react-icons/fi';

/**
 * PurchaseActionBar - Componente para mostrar acciones disponibles según rol y estado
 * Incluye validaciones RBAC y bloqueos por estado/documentos
 */
const PurchaseActionBar = ({
  purchase,
  userRole,
  onApprove,
  onReject,
  onSubmitCorrections,
  onUploadContract,
  onRequestDates,
  onSubmitDates,
  onMarkDispatchReady,
  onGenerateAct,
  onUploadSignedOffer,
  onStartBusinessCase,
  loading = {}
}) => {

  // Determinar acciones disponibles según rol y estado
  const getAvailableActions = () => {
    if (!purchase || !userRole) return [];

    const actions = [];
    const status = purchase.status;
    const role = userRole.toLowerCase();

    // Gerencia General
    if (role.includes('gerencia') || role.includes('gerencia_general')) {
      if (status === 'pending_manager_contract_approval') {
        actions.push({
          id: 'approve',
          label: 'Aprobar Contrato',
          icon: FiCheck,
          variant: 'success',
          handler: onApprove,
          loading: loading.approve,
          tooltip: 'Aprobar la creación del contrato'
        });
        actions.push({
          id: 'reject',
          label: 'Rechazar',
          icon: FiX,
          variant: 'danger',
          handler: onReject,
          loading: loading.reject,
          tooltip: 'Rechazar y solicitar correcciones'
        });
      }
    }

    // BackOffice Comercial
    if (role.includes('backoffice') && role.includes('comercial')) {
      if (status === 'contract_rejected_needs_correction') {
        actions.push({
          id: 'submit_corrections',
          label: 'Enviar Correcciones',
          icon: FiUpload,
          variant: 'primary',
          handler: onSubmitCorrections,
          loading: loading.submitCorrections,
          tooltip: 'Subir documentos corregidos'
        });
      }

      if (status === 'contract_approved_pending_upload') {
        actions.push({
          id: 'upload_contract',
          label: 'Subir Contrato',
          icon: FiFileText,
          variant: 'primary',
          handler: onUploadContract,
          loading: loading.uploadContract,
          tooltip: 'Subir el contrato generado'
        });
      }
    }

    // Jefe Operaciones
    if (role.includes('jefe_operaciones')) {
      if (status === 'pending_operations_schedule') {
        actions.push({
          id: 'request_dates',
          label: 'Solicitar Fechas Entrega',
          icon: FiCalendar,
          variant: 'primary',
          handler: onRequestDates,
          loading: loading.requestDates,
          tooltip: 'Solicitar fechas de entrega al asesor comercial'
        });
      }
    }

    // Asesor Comercial
    if (role.includes('asesor') || role.includes('comercial')) {
      if (status === 'pending_operations_schedule') {
        actions.push({
          id: 'submit_dates',
          label: 'Enviar Fechas Entrega',
          icon: FiCalendar,
          variant: 'primary',
          handler: onSubmitDates,
          loading: loading.submitDates,
          tooltip: 'Confirmar fechas de entrega'
        });
      }

      // Validar bloqueo por cliente no aprobado
      const canUploadOffer = status === 'pending_client_signature' || status === 'offer_sent';
      if (canUploadOffer) {
        const hasClientApproved = purchase.client_approved_at;
        const hasLopdp = true; // Esto vendría del checklist computado

        if (!hasClientApproved || !hasLopdp) {
          actions.push({
            id: 'upload_signed_offer_blocked',
            label: 'Subir Oferta Firmada',
            icon: FiAlertTriangle,
            variant: 'blocked',
            handler: null,
            tooltip: 'Bloqueado: Cliente no aprobado o sin consentimiento LOPDP',
            blocked: true
          });
        } else {
          actions.push({
            id: 'upload_signed_offer',
            label: 'Subir Oferta Firmada',
            icon: FiUpload,
            variant: 'primary',
            handler: onUploadSignedOffer,
            loading: loading.uploadSignedOffer,
            tooltip: 'Subir la oferta firmada por el cliente'
          });
        }
      }
    }

    // Jefe Logística
    if (role.includes('jefe_logistica')) {
      if (status === 'awaiting_dispatch') {
        actions.push({
          id: 'mark_dispatch_ready',
          label: 'Marcar Despacho Listo',
          icon: FiTruck,
          variant: 'primary',
          handler: onMarkDispatchReady,
          loading: loading.markDispatchReady,
          tooltip: 'Confirmar que el despacho está listo'
        });
      }

      if (status === 'delivered_pending_signatures') {
        actions.push({
          id: 'generate_act',
          label: 'Generar Acta Entrega',
          icon: FiFileText,
          variant: 'primary',
          handler: onGenerateAct,
          loading: loading.generateAct,
          tooltip: 'Generar y subir acta de entrega-recepción'
        });
      }
    }

    // BackOffice para comodato
    if (role.includes('backoffice') && role.includes('comercial')) {
      if (purchase.offer_kind === 'comodato' && status === 'sent_to_acp') {
        actions.push({
          id: 'start_business_case',
          label: 'Iniciar Business Case',
          icon: FiFileText,
          variant: 'primary',
          handler: onStartBusinessCase,
          loading: loading.startBusinessCase,
          tooltip: 'Iniciar proceso de Business Case para comodato'
        });
      }
    }

    return actions;
  };

  const getButtonClasses = (variant, blocked = false) => {
    if (blocked) {
      return 'inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-400 bg-gray-100 cursor-not-allowed';
    }

    switch (variant) {
      case 'success':
        return 'inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50';
      case 'danger':
        return 'inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50';
      case 'primary':
      default:
        return 'inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50';
    }
  };

  const actions = getAvailableActions();

  if (actions.length === 0) {
    return (
      <div className="bg-gray-50 p-4 rounded-lg">
        <p className="text-sm text-gray-500 text-center">
          No hay acciones disponibles para su rol en este estado
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg border">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Acciones Disponibles</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {actions.map((action) => {
          const Icon = action.icon;
          const isDisabled = action.loading || action.blocked;

          return (
            <div key={action.id} className="relative">
              <button
                onClick={action.handler}
                disabled={isDisabled}
                className={getButtonClasses(action.variant, action.blocked)}
                title={action.tooltip}
              >
                <Icon className="w-4 h-4 mr-2" />
                {action.loading ? 'Procesando...' : action.label}
              </button>

              {action.blocked && (
                <div className="absolute -top-2 -right-2">
                  <FiAlertTriangle className="w-5 h-5 text-orange-500" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Estado actual */}
      <div className="mt-4 pt-4 border-t">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <strong>Estado actual:</strong>
            <span className="ml-2 px-2 py-1 bg-gray-100 rounded text-xs">
              {purchase.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Desconocido'}
            </span>
          </div>

          <div className="text-sm text-gray-600">
            <strong>Rol:</strong>
            <span className="ml-2 text-blue-600 font-medium">
              {userRole.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </span>
          </div>
        </div>
      </div>

      {/* Mensaje de ayuda */}
      {actions.some(a => a.blocked) && (
        <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded">
          <div className="flex">
            <FiAlertTriangle className="w-5 h-5 text-orange-400 mr-2" />
            <div className="text-sm text-orange-800">
              <strong>Acciones bloqueadas:</strong> Complete los requisitos previos
              (aprobación de cliente, consentimiento LOPDP) antes de continuar.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseActionBar;