import React, { useState, useEffect } from 'react';
import { FiPackage, FiLoader, FiUpload, FiAlertTriangle, FiCheck } from 'react-icons/fi';
import WorkflowStep from '../../components/WorkflowStep';
import RoleGatedAction from '../../components/RoleGatedAction';
import TabBadge from '../../components/TabBadge';
import FileUploadZone from '../../../../../core/ui/components/FileUploadZone';
import {
  registerEquipmentPurchaseSerial,
  requestDeliveryDates,
  submitDeliveryDates,
  markEquipmentArrived,
  markDispatchReady,
  completeDelivery,
} from '../../../../../core/api/equipmentPurchasesApi';
import { getEquipmentPurchaseApiError } from '../../../../../core/api/equipmentPurchasesApi';
import {
  completeDelivery as completePrivateDelivery,
  assignPrivatePurchaseDeliveryActTechnician,
  finalizePrivatePurchaseDeliveryAct,
  getPrivatePurchaseById,
  markPrivatePurchaseEquipmentArrived,
  markReadyForDelivery as markPrivateReadyForDelivery,
  registerPrivatePurchaseSerial,
  requestDeliveryDates as requestPrivateDeliveryDates,
  submitDeliveryDates as submitPrivateDeliveryDates,
  updatePrivatePurchaseDispatchDetails,
  uploadPrivatePurchaseDeliveryAct,
  uploadPrivatePurchaseDeliveryGuides,
  getPrivatePurchaseTechnicianSchedule,
  updatePrivatePurchaseInstallationWorkflow,
} from '../../../../../core/api/privatePurchasesApi';
import { PURCHASE_ROLE_GROUPS } from '../../purchaseRoleGroups';

const OPERATIONS_ROLES = [...PURCHASE_ROLE_GROUPS.operaciones, ...PURCHASE_ROLE_GROUPS.gerencia, ...PURCHASE_ROLE_GROUPS.jefe_comercial, ...PURCHASE_ROLE_GROUPS.acp_comercial];
const LOGISTICS_ROLES = [...PURCHASE_ROLE_GROUPS.logistica, ...PURCHASE_ROLE_GROUPS.gerencia, ...PURCHASE_ROLE_GROUPS.jefe_comercial, ...PURCHASE_ROLE_GROUPS.acp_comercial];

const SERIAL_STATUSES = {
  not_applicable_yet: { label: 'No aplica aún', variant: 'neutral' },
  pending_reception: { label: 'Pendiente recepción', variant: 'amber' },
  received_pending_serial: { label: 'Recibido — pendiente serial', variant: 'amber' },
  serial_registered: { label: 'Serial registrado', variant: 'green' },
};

const fileToBase64Payload = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const result = String(reader.result || '');
    const payload = result.includes(',') ? result.split(',')[1] : result;
    if (!payload?.trim()) reject(new Error('El archivo esta vacio o no se pudo procesar'));
    else resolve(payload);
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const EquipmentLogisticsTab = ({ purchase, type, userRoles, hasRole, refresh }) => {
  const [loading, setLoading] = useState(false);
  const [guideLoading, setGuideLoading] = useState(false);
  const [error, setError] = useState(null);
  const [serialNumber, setSerialNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryStart, setDeliveryStart] = useState('');
  const [deliveryEnd, setDeliveryEnd] = useState('');
  const [guideFiles, setGuideFiles] = useState([]);
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [dispatchDate, setDispatchDate] = useState('');
  const [dispatchObservations, setDispatchObservations] = useState('');
  const [deliveryActAssignedName, setDeliveryActAssignedName] = useState('');
  const [deliveryActAssignedEmail, setDeliveryActAssignedEmail] = useState('');
  const [logisticsSignedActFile, setLogisticsSignedActFile] = useState(null);
  const [finalActFile, setFinalActFile] = useState(null);

  // installation_workflow.dispatch_request / .logistics_validation -- distinto
  // de dispatch_items_json/delivery_act_dispatched_at (paso "Registrar datos de
  // despacho" de mas abajo). Son dos workflows separados con nombres parecidos:
  // este es un prerequisito del cierre de instalacion (acta final), el otro es
  // para generar el acta de despacho en si.
  const [iwDispatchRequiredDate, setIwDispatchRequiredDate] = useState('');
  const [iwDispatchNotes, setIwDispatchNotes] = useState('');
  const [iwDispatchRequiresNotice, setIwDispatchRequiresNotice] = useState(false);
  const [iwDispatchClientAddress, setIwDispatchClientAddress] = useState(
    () => purchase?.client_snapshot?.shipping_address || purchase?.client_snapshot?.address || '',
  );
  const [iwLogisticsGuideRef, setIwLogisticsGuideRef] = useState('');
  const [iwLogisticsProformaRef, setIwLogisticsProformaRef] = useState('');
  const [iwLogisticsNotes, setIwLogisticsNotes] = useState('');

  // Paso 7: lista real de tecnicos para asignar al acta (mismo patron que
  // "Planificar visita" en Tecnica, sin la parte de fecha/carga de trabajo).
  const [actTechnicians, setActTechnicians] = useState([]);
  const [actTechniciansLoading, setActTechniciansLoading] = useState(false);
  const [selectedActTechId, setSelectedActTechId] = useState('');

  const isPrivate = type === 'private' || purchase?.purchase_type === 'private';
  const serialStatus = purchase?.serial_status || 'not_applicable_yet';
  const statusInfo = SERIAL_STATUSES[serialStatus] || SERIAL_STATUSES.not_applicable_yet;
  const canRegisterSerial = serialStatus === 'received_pending_serial';

  // Lista real de tecnicos (mismo endpoint que "Planificar visita" en Tecnica);
  // se usa solo la lista, no la carga de trabajo por dia (aqui no hay fecha).
  useEffect(() => {
    if (!isPrivate || !purchase?.id) return;
    let cancelled = false;
    setActTechniciansLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    getPrivatePurchaseTechnicianSchedule(today)
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data?.technicians) ? data.technicians : [];
        setActTechnicians(list.filter((t) => ['tecnico', 'ing_servicio'].includes(String(t.role || '').toLowerCase())));
      })
      .catch(() => { if (!cancelled) setActTechnicians([]); })
      .finally(() => { if (!cancelled) setActTechniciansLoading(false); });
    return () => { cancelled = true; };
  }, [isPrivate, purchase?.id]);

  // Fecha tentativa de entrega registrada por ACP en Disponibilidad — se muestra
  // aqui como referencia para que Operaciones coordine con el cliente.
  const providerDeliveryHistory = Array.isArray(purchase?.provider_delivery_dates_history)
    ? purchase.provider_delivery_dates_history
    : [];
  const latestProviderDeliveryDate = providerDeliveryHistory.length
    ? providerDeliveryHistory[providerDeliveryHistory.length - 1]
    : null;
  const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium' }).format(date);
  };

  // La inspeccion de ambiente (F.ST-07) es obligatoria antes de solicitar fecha
  // de entrega -- mismo criterio que ahora exige el backend (requestDeliveryDates).
  // Excepcion: comodato con Business Case vinculado usa su propio mecanismo.
  const inspectionHandledByBusinessCase = isPrivate &&
    String(purchase?.offer_kind || '').toLowerCase() === 'comodato' &&
    Boolean(purchase?.business_case_id || purchase?.extra?.auto_business_case_id);
  const siteInspectionMissing = isPrivate && !inspectionHandledByBusinessCase && !purchase?.inspection_request_id;
  const siteInspectionNotReady = isPrivate && !inspectionHandledByBusinessCase &&
    Boolean(purchase?.inspection_request_id) && !purchase?.site_inspection_ready_for_installation;
  const canRequestDeliveryDates = !siteInspectionMissing && !siteInspectionNotReady;

  const handleRequestDeliveryDates = async () => {
    if (isPrivate && !canRequestDeliveryDates) return; // falta inspeccion de ambiente, backend rechaza
    setLoading(true);
    setError(null);
    try {
      if (isPrivate) await requestPrivateDeliveryDates(purchase.id);
      else {
        await requestDeliveryDates(purchase.id, {
          notes,
          expected_updated_at: purchase.updated_at,
        });
      }
      setNotes('');
      await refresh();
    } catch (err) {
      const errInfo = getEquipmentPurchaseApiError(err);
      setError(errInfo.message);
      console.error('Error requesting delivery dates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDeliveryDates = async () => {
    if (!deliveryStart || !deliveryEnd) return;
    if (isPrivate && hasDeliveryDates) return; // ya establecidas, backend rechaza con DOC_ALREADY_EXISTS
    setLoading(true);
    setError(null);
    try {
      if (isPrivate) {
        await submitPrivateDeliveryDates(purchase.id, {
          delivery_start_at: deliveryStart,
          delivery_end_at: deliveryEnd,
        }, notes);
      } else {
        await submitDeliveryDates(purchase.id, {
          delivery_start_at: deliveryStart,
          delivery_end_at: deliveryEnd,
          notes,
          expected_updated_at: purchase.updated_at,
        });
      }
      setNotes('');
      setDeliveryStart('');
      setDeliveryEnd('');
      await refresh();
    } catch (err) {
      const errInfo = getEquipmentPurchaseApiError(err);
      setError(errInfo.message);
      console.error('Error submitting delivery dates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkEquipmentArrived = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isPrivate) await markPrivatePurchaseEquipmentArrived(purchase.id);
      else {
        await markEquipmentArrived(purchase.id, {
          notes,
          expected_updated_at: purchase.updated_at,
        });
      }
      setNotes('');
      await refresh();
    } catch (err) {
      const errInfo = getEquipmentPurchaseApiError(err);
      setError(errInfo.message);
      console.error('Error marking equipment arrived:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkReadyForDelivery = async () => {
    if (!isPrivate) return;
    if (step4Done) return; // ya esta en dispatch_ready o mas alla; backend rechaza la auto-transicion
    setLoading(true);
    setError(null);
    try {
      await markPrivateReadyForDelivery(purchase.id);
      await refresh();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'No se pudo marcar como listo para entrega');
      console.error('Error marking ready for delivery:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkDispatchReady = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isPrivate) {
        throw new Error('En compras privadas el despacho se gestiona con guias de entrega y completar entrega.');
      }
      await markDispatchReady(purchase.id, {
        notes,
        expected_updated_at: purchase.updated_at,
      });
      setNotes('');
      await refresh();
    } catch (err) {
      const errInfo = getEquipmentPurchaseApiError(err);
      setError(errInfo.message);
      console.error('Error marking dispatch ready:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteDelivery = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isPrivate) await completePrivateDelivery(purchase.id, notes);
      else {
        await completeDelivery(purchase.id, {
          notes,
          expected_updated_at: purchase.updated_at,
        });
      }
      setNotes('');
      await refresh();
    } catch (err) {
      const errInfo = getEquipmentPurchaseApiError(err);
      setError(errInfo.message);
      console.error('Error completing delivery:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSerial = async () => {
    if (!serialNumber.trim()) return;
    setLoading(true);
    setError(null);
    try {
      if (isPrivate) {
        await registerPrivatePurchaseSerial(purchase.id, {
          serialNumber,
          expected_updated_at: purchase.updated_at,
        });
      } else {
        await registerEquipmentPurchaseSerial(purchase.id, {
          serialNumber,
          expected_updated_at: purchase.updated_at,
        });
      }
      setSerialNumber('');
      await refresh();
    } catch (err) {
      const errInfo = getEquipmentPurchaseApiError(err);
      setError(errInfo.message);
      console.error('Error registering serial:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadGuides = async () => {
    if (!guideFiles.length) return;
    setGuideLoading(true);
    setError(null);
    try {
      const guides = await Promise.all(guideFiles.map(async (file) => ({
        file_base64: await fileToBase64Payload(file),
        file_name: file.name,
        mime_type: file.type || 'application/pdf',
      })));
      await uploadPrivatePurchaseDeliveryGuides(purchase.id, guides);
      setGuideFiles([]);
      await refresh();
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'No se pudieron subir las guias de entrega');
    } finally {
      setGuideLoading(false);
    }
  };

  const refreshPrivatePurchaseDetail = async () => {
    if (!isPrivate || !purchase?.id) return;
    try {
      await getPrivatePurchaseById(purchase.id);
      await refresh();
    } catch (_) {
      await refresh();
    }
  };

  const handleSaveDispatchDetails = async () => {
    if (!isPrivate) return;
    setLoading(true);
    setError(null);
    try {
      await updatePrivatePurchaseDispatchDetails(purchase.id, {
        items: Array.isArray(purchase?.dispatch_items_json) ? purchase.dispatch_items_json : [],
        notes: dispatchNotes,
        dispatched_at: dispatchDate || null,
        observations: dispatchObservations,
      });
      await refreshPrivatePurchaseDetail();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'No se pudieron guardar los datos de despacho');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestDispatch = async () => {
    if (!isPrivate || !iwDispatchRequiredDate || !iwDispatchClientAddress.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await updatePrivatePurchaseInstallationWorkflow(purchase.id, {
        action: 'dispatch_request',
        payload: {
          required_date: iwDispatchRequiredDate,
          requires_notice: iwDispatchRequiresNotice,
          notes: iwDispatchNotes,
          client_address: iwDispatchClientAddress.trim(),
        },
        expected_updated_at: purchase.updated_at,
      });
      await refreshPrivatePurchaseDetail();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'No se pudo registrar la solicitud de despacho');
    } finally {
      setLoading(false);
    }
  };

  const handleValidateLogistics = async () => {
    if (!isPrivate || !iwLogisticsGuideRef.trim() || !iwLogisticsProformaRef.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await updatePrivatePurchaseInstallationWorkflow(purchase.id, {
        action: 'logistics_validation',
        payload: {
          status: 'validated',
          guide_reference: iwLogisticsGuideRef.trim(),
          proforma_reference: iwLogisticsProformaRef.trim(),
          notes: iwLogisticsNotes,
        },
        expected_updated_at: purchase.updated_at,
      });
      await refreshPrivatePurchaseDetail();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'No se pudo validar logística');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadLogisticsSignedAct = async () => {
    if (!isPrivate || !logisticsSignedActFile) return;
    setGuideLoading(true);
    setError(null);
    try {
      const fileBase64 = await fileToBase64Payload(logisticsSignedActFile);
      await uploadPrivatePurchaseDeliveryAct(purchase.id, {
        act_base64: fileBase64,
        file_name: logisticsSignedActFile.name,
        mime_type: logisticsSignedActFile.type || 'application/pdf',
      });
      setLogisticsSignedActFile(null);
      await refreshPrivatePurchaseDetail();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'No se pudo subir el acta firmada por logistica');
    } finally {
      setGuideLoading(false);
    }
  };

  const handleAssignActTechnician = async () => {
    if (!isPrivate) return;
    if (!deliveryActAssignedName.trim() || !deliveryActAssignedEmail.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await assignPrivatePurchaseDeliveryActTechnician(purchase.id, {
        assigned_to_name: deliveryActAssignedName.trim(),
        assigned_to_email: deliveryActAssignedEmail.trim(),
      });
      await refreshPrivatePurchaseDetail();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'No se pudo asignar tecnico');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadFinalAct = async () => {
    if (!isPrivate || !finalActFile) return;
    setGuideLoading(true);
    setError(null);
    try {
      const fileBase64 = await fileToBase64Payload(finalActFile);
      await finalizePrivatePurchaseDeliveryAct(purchase.id, {
        act_base64: fileBase64,
        file_name: finalActFile.name,
        mime_type: finalActFile.type || 'application/pdf',
      });
      setFinalActFile(null);
      await refreshPrivatePurchaseDetail();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'No se pudo subir el acta final');
    } finally {
      setGuideLoading(false);
    }
  };

  /*
   * roleStepStatus — igual criterio que TechnicalTab: si el usuario tiene el
   * rol dueño del paso, ve active/pending normal; si no, ve completed cuando
   * ya paso, waiting cuando es el turno de otro rol, pending si aun no llega.
   */
  const roleStepStatus = (done, active, ownerRoles) => {
    if (done) return 'completed';
    const isMyStep = Array.isArray(ownerRoles) && userRoles.some((r) => ownerRoles.includes(r));
    if (isMyStep) return active ? 'active' : 'pending';
    return active ? 'waiting' : 'pending';
  };

  /*
   * Gating basado en campos de datos reales (no en el nombre exacto del status
   * intermedio, que difiere de forma sutil entre publico y privado) -- cada
   * paso se marca "done" cuando el campo que esa accion escribe ya existe.
   */
  const status = purchase?.status || '';

  // ── Publico: usa el status principal, ya mapeado 1 a 1 por accion ──────
  const PUBLIC_STAGES = ['contract_available', 'delivery_dates_requested', 'delivery_dates_submitted', 'waiting_dispatch', 'dispatch_ready', 'delivered_signed', 'completed'];
  const publicIdx = PUBLIC_STAGES.indexOf(status);
  const publicAtOrPast = (stage) => publicIdx === -1 || PUBLIC_STAGES.indexOf(stage) === -1 || publicIdx >= PUBLIC_STAGES.indexOf(stage);

  // delivery_dates_json tiene DEFAULT '{}'::jsonb en la BD (no NULL) -- un objeto
  // vacio es truthy en JS, asi que un simple Boolean(...) marcaba este paso como
  // "hecho" desde el primer render, sin que nadie pidiera/confirmara fecha nunca.
  // Mismo criterio que usa el backend (setDeliveryDates) para su chequeo de idempotencia.
  const hasDeliveryDates = Boolean(
    purchase?.delivery_dates_json &&
    (Array.isArray(purchase.delivery_dates_json)
      ? purchase.delivery_dates_json.length > 0
      : Object.keys(purchase.delivery_dates_json).length > 0),
  );

  // Privado: solicitar/confirmar fecha con el cliente ya NO depende de que el
  // equipo haya llegado fisicamente -- son dos acciones independientes (backend
  // ya no exige equipment_arrived_at para requestDeliveryDates).
  const step1Done = isPrivate ? (status !== 'contract_available') : publicAtOrPast('delivery_dates_requested');
  const step1Active = isPrivate ? (status === 'contract_available') : status === 'contract_available';

  const step2Done = isPrivate ? hasDeliveryDates : publicAtOrPast('delivery_dates_submitted');
  const step2Active = step1Done && !step2Done;

  // Privado: paso paralelo (no bloquea ni depende de los pasos de fecha), marcar
  // equipo llegado -- llegada fisica y coordinacion de fecha con el cliente son
  // cosas distintas que pueden pasar en cualquier orden. Publico: si es secuencial
  // (el backend exige equipo llegado antes de "listo para despacho").
  const step3Done = isPrivate ? Boolean(purchase?.equipment_arrived_at) : publicAtOrPast('waiting_dispatch');
  const step3Active = isPrivate ? !step3Done : (step2Done && !step3Done);

  // Privado: "listo para entrega" (markReadyForDelivery) depende de fechas
  // confirmadas, no de la llegada del equipo (backend no lo exige). Publico:
  // "listo para despacho" si depende de que el equipo haya llegado (step3).
  //
  // Bug: antes se usaba delivery_act_dispatched_at como señal de "hecho", pero
  // ese campo lo escribe un paso POSTERIOR (Registrar datos de despacho, paso 6),
  // no markReadyForDelivery. Como nunca se marcaba done, el boton seguia
  // habilitado despues del primer click y un segundo click reintentaba la misma
  // transicion (dispatch_ready -> dispatch_ready), que el backend rechaza.
  const PRIVATE_POST_DISPATCH_STAGES = [
    'dispatch_ready', 'delivery_act_draft_ready', 'delivery_act_tech_assigned',
    'delivery_act_logistics_signed', 'delivery_act_generated', 'delivered_signed', 'completed',
  ];
  const step4Done = isPrivate ? PRIVATE_POST_DISPATCH_STAGES.includes(status) : publicAtOrPast('dispatch_ready');
  const step4Active = isPrivate ? (step2Done && !step4Done) : (step3Done && !step4Done);

  // Privado: guias de entrega. Publico: listo para despacho (ya cubierto por step4).
  const hasGuides = Boolean(purchase?.delivery_guides_json?.length);
  const step5Done = isPrivate ? hasGuides : publicAtOrPast('delivered_signed') || publicAtOrPast('completed');
  const step5Active = step4Done && !step5Done;

  const hasDispatchDetails = Boolean(purchase?.dispatch_items_json?.length || purchase?.dispatch_notes);
  const step6Done = hasDispatchDetails;
  const step6Active = step5Done && !step6Done;

  // Paso 7/8: prerequisitos del cierre de instalacion (installation_workflow) --
  // distintos de dispatch_items_json de arriba. Sin UI hasta ahora, bloqueaban
  // "Subir acta final" con INSTALLATION_CLOSURE_BLOCKED sin forma de resolverse.
  const iw = purchase?.installation_workflow || {};
  const step7Done = Boolean(iw?.dispatch_request?.required_date && iw?.dispatch_request?.items?.length);
  const step7Active = step6Done && !step7Done;

  const step8Done = iw?.logistics_validation?.status === 'validated';
  const step8Active = step7Done && !step8Done;

  const hasActTechnician = Boolean(purchase?.delivery_act_assigned_to_email);
  const step9Done = hasActTechnician;
  const step9Active = step8Done && !step9Done;

  const hasLogisticsSignedAct = Boolean(purchase?.delivery_act_logistics_signed_document_id);
  const step10Done = hasLogisticsSignedAct;
  const step10Active = step9Done && !step10Done;

  const hasFinalAct = Boolean(purchase?.delivery_act_document_id);
  const step11Done = hasFinalAct;
  const step11Active = step10Done && !step11Done;

  const deliveryCompleteDone = isPrivate ? hasFinalAct && ['delivered', 'delivered_signed', 'completed'].includes(status) : publicAtOrPast('delivered_signed') || publicAtOrPast('completed');
  const deliveryCompleteActive = isPrivate ? (step11Done && !deliveryCompleteDone) : (step5Done && !deliveryCompleteDone);

  return (
    <div className="flex flex-col min-w-0">
      {/* Header del tab */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
        <div>
          <h2 className="text-lg font-semibold text-ink-slate">Logística Equipo</h2>
          <p className="text-xs text-warm-ash mt-0.5">Flujo: Operaciones → Logística → Técnico</p>
        </div>
        <TabBadge status={statusInfo.variant === 'green' ? 'completado' : 'pendiente'} />
      </div>

      <div className="p-6 space-y-3">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">{error}</div>
        )}

        {isPrivate ? (
          <>
            {/* Paso 1: Operaciones solicita fecha de entrega — independiente de si el
                equipo ya llego fisicamente. La fecha tentativa que registro ACP en
                Disponibilidad se muestra aqui como referencia. */}
            <WorkflowStep
              stepNumber={1}
              title="Solicitar fecha de entrega"
              actor="Operaciones"
              status={roleStepStatus(step1Done, step1Active, OPERATIONS_ROLES)}
            >
              {latestProviderDeliveryDate && (
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-action-blue/20 bg-action-blue/5 px-3 py-2 text-xs text-ink-slate">
                  <FiPackage size={13} className="text-action-blue shrink-0" />
                  <span>
                    Fecha tentativa registrada por ACP: <strong>{formatDate(latestProviderDeliveryDate.date)}</strong>
                    {latestProviderDeliveryDate.notes && <span className="text-warm-ash"> — {latestProviderDeliveryDate.notes}</span>}
                  </span>
                </div>
              )}
              {(siteInspectionMissing || siteInspectionNotReady) && (
                <div className="mb-3 flex items-start gap-2 rounded-xl border border-caution-amber/40 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <FiAlertTriangle size={14} className="text-caution-amber shrink-0 mt-0.5" />
                  <span>
                    {siteInspectionMissing
                      ? 'Falta solicitar la inspección de ambiente antes de poder solicitar fecha de entrega.'
                      : 'La inspección de ambiente aún no está conforme para instalación. No se puede solicitar fecha de entrega hasta resolverla.'}
                  </span>
                </div>
              )}
              <RoleGatedAction allowedRoles={OPERATIONS_ROLES} userRoles={userRoles}>
                <div className="space-y-3">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notas sobre la solicitud de fechas (opcional)"
                    className="w-full px-4 py-3 border border-fog rounded-md text-sm text-ink-slate focus:outline-none focus:border-action-blue focus:ring-2 focus:ring-sky-signal/20"
                    rows={2}
                  />
                  <button
                    onClick={handleRequestDeliveryDates}
                    disabled={loading || !canRequestDeliveryDates}
                    className="w-full min-h-11 px-4 py-3 bg-action-blue text-white rounded-xl font-medium hover:bg-blue-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
                  >
                    {loading ? <span className="inline-flex items-center gap-2"><FiLoader className="animate-spin" size={16} />Solicitando...</span> : 'Solicitar Fechas de Entrega'}
                  </button>
                </div>
              </RoleGatedAction>
            </WorkflowStep>

            {/* Paso 2: Operaciones confirma fechas */}
            <WorkflowStep
              stepNumber={2}
              title="Confirmar fechas de entrega"
              actor="Operaciones"
              status={roleStepStatus(step2Done, step2Active, OPERATIONS_ROLES)}
            >
              {latestProviderDeliveryDate && (
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-action-blue/20 bg-action-blue/5 px-3 py-2 text-xs text-ink-slate">
                  <FiPackage size={13} className="text-action-blue shrink-0" />
                  <span>
                    Fecha tentativa registrada por ACP: <strong>{formatDate(latestProviderDeliveryDate.date)}</strong>
                    {latestProviderDeliveryDate.notes && <span className="text-warm-ash"> — {latestProviderDeliveryDate.notes}</span>}
                  </span>
                </div>
              )}
              <RoleGatedAction allowedRoles={OPERATIONS_ROLES} userRoles={userRoles}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-ink-slate mb-2">Inicio de entrega</label>
                    <input type="date" value={deliveryStart} onChange={(e) => setDeliveryStart(e.target.value)} className="w-full px-4 py-3 border border-fog rounded-md text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-slate mb-2">Fin de entrega</label>
                    <input type="date" value={deliveryEnd} onChange={(e) => setDeliveryEnd(e.target.value)} className="w-full px-4 py-3 border border-fog rounded-md text-sm" />
                  </div>
                </div>
                <button
                  onClick={handleSubmitDeliveryDates}
                  disabled={loading || !deliveryStart || !deliveryEnd || hasDeliveryDates}
                  className="w-full min-h-11 px-4 py-3 bg-action-blue text-white rounded-xl font-medium hover:bg-blue-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
                >
                  {loading ? <span className="inline-flex items-center gap-2"><FiLoader className="animate-spin" size={16} />Confirmando...</span> : 'Confirmar Fechas de Entrega'}
                </button>
              </RoleGatedAction>
            </WorkflowStep>

            {/* Paso 3: Operaciones marca equipo llegado — independiente de los pasos
                de fecha (puede pasar antes, durante o despues). */}
            <WorkflowStep
              stepNumber={3}
              title="Marcar equipo llegado"
              actor="Operaciones"
              status={roleStepStatus(step3Done, step3Active, OPERATIONS_ROLES)}
              completedAt={purchase?.equipment_arrived_at}
            >
              <RoleGatedAction allowedRoles={OPERATIONS_ROLES} userRoles={userRoles}>
                <button
                  onClick={handleMarkEquipmentArrived}
                  disabled={loading}
                  className="w-full min-h-11 px-4 py-3 bg-action-blue text-white rounded-xl font-medium hover:bg-blue-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
                >
                  {loading ? <span className="inline-flex items-center gap-2"><FiLoader className="animate-spin" size={16} />Marcando...</span> : 'Marcar Equipo Llegado'}
                </button>
              </RoleGatedAction>
            </WorkflowStep>

            {/* Paso 4: Logística marca listo para entrega */}
            <WorkflowStep
              stepNumber={4}
              title="Marcar listo para entrega"
              actor="Logística"
              status={roleStepStatus(step4Done, step4Active, LOGISTICS_ROLES)}
              completedAt={purchase?.delivery_act_dispatched_at}
            >
              <RoleGatedAction allowedRoles={LOGISTICS_ROLES} userRoles={userRoles}>
                <button
                  onClick={handleMarkReadyForDelivery}
                  disabled={loading || step4Done}
                  className="w-full min-h-11 px-4 py-3 bg-action-blue text-white rounded-xl font-medium hover:bg-blue-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
                >
                  {loading ? <span className="inline-flex items-center gap-2"><FiLoader className="animate-spin" size={16} />Marcando...</span> : 'Marcar Listo para Entrega'}
                </button>
              </RoleGatedAction>
            </WorkflowStep>

            {/* Paso 5: Logística sube guías de entrega */}
            <WorkflowStep
              stepNumber={5}
              title="Subir guías de entrega"
              actor="Logística"
              status={roleStepStatus(step5Done, step5Active, LOGISTICS_ROLES)}
            >
              <RoleGatedAction allowedRoles={LOGISTICS_ROLES} userRoles={userRoles}>
                <div className="space-y-3">
                  <label className="relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-paper-white px-4 py-6 text-center cursor-pointer hover:border-action-blue hover:bg-blue-50/40 transition-all">
                    <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setGuideFiles(Array.from(event.target.files || []))} className="hidden" />
                    <FiUpload className="text-warm-ash" size={20} />
                    {guideFiles.length > 0 ? (
                      <span className="text-sm font-medium text-ink-slate">{guideFiles.length} archivo{guideFiles.length > 1 ? 's' : ''} seleccionado{guideFiles.length > 1 ? 's' : ''}</span>
                    ) : (
                      <span className="text-sm text-warm-ash">Seleccionar guías (PDF, imágenes)</span>
                    )}
                  </label>
                  <button
                    type="button"
                    onClick={handleUploadGuides}
                    disabled={guideLoading || guideFiles.length === 0}
                    className="w-full min-h-11 inline-flex items-center justify-center gap-2 bg-action-blue text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
                  >
                    {guideLoading ? <><FiLoader className="animate-spin" size={15} />Subiendo...</> : <><FiUpload size={14} />Subir guías de entrega</>}
                  </button>
                </div>
              </RoleGatedAction>
            </WorkflowStep>

            {/* Paso 6: Logística guarda datos de despacho */}
            <WorkflowStep
              stepNumber={6}
              title="Registrar datos de despacho"
              actor="Logística"
              status={roleStepStatus(step6Done, step6Active, LOGISTICS_ROLES)}
            >
              <RoleGatedAction allowedRoles={LOGISTICS_ROLES} userRoles={userRoles}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <input type="date" value={dispatchDate} onChange={(event) => setDispatchDate(event.target.value)} className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm" />
                  <textarea value={dispatchObservations} onChange={(event) => setDispatchObservations(event.target.value)} placeholder="Observaciones del acta (una por linea)" className="min-h-10 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                </div>
                <textarea value={dispatchNotes} onChange={(event) => setDispatchNotes(event.target.value)} placeholder="Notas de despacho" className="w-full min-h-10 rounded-xl border border-slate-200 px-3 py-2 text-sm mb-3" />
                <button
                  type="button"
                  onClick={handleSaveDispatchDetails}
                  disabled={loading}
                  className="w-full min-h-11 px-4 py-3 bg-action-blue text-white rounded-xl font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
                >
                  Guardar datos de despacho
                </button>
              </RoleGatedAction>
            </WorkflowStep>

            {/* Paso 7: Operaciones solicita despacho (installation_workflow.dispatch_request)
                -- prerequisito para poder cerrar la instalacion (acta final). Antes no
                tenia UI en ningun lado, aunque el backend ya lo soportaba. */}
            <WorkflowStep
              stepNumber={7}
              title="Solicitar despacho"
              actor="Operaciones"
              status={roleStepStatus(step7Done, step7Active, OPERATIONS_ROLES)}
            >
              <RoleGatedAction allowedRoles={OPERATIONS_ROLES} userRoles={userRoles}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-ink-slate">Fecha requerida de despacho</span>
                    <input
                      type="date"
                      value={iwDispatchRequiredDate}
                      onChange={(event) => setIwDispatchRequiredDate(event.target.value)}
                      className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm"
                    />
                  </label>
                  <label className="flex items-center gap-2 mt-6">
                    <input
                      type="checkbox"
                      checked={iwDispatchRequiresNotice}
                      onChange={(event) => setIwDispatchRequiresNotice(event.target.checked)}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                    <span className="text-xs text-ink-slate">Requiere aviso previo (mín. 15 días)</span>
                  </label>
                </div>
                <label className="flex flex-col gap-1.5 mb-3">
                  <span className="text-xs font-medium text-ink-slate">Dirección de instalación</span>
                  <input
                    type="text"
                    value={iwDispatchClientAddress}
                    onChange={(event) => setIwDispatchClientAddress(event.target.value)}
                    placeholder="Dirección donde se instalará el equipo"
                    className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm"
                  />
                </label>
                <textarea
                  value={iwDispatchNotes}
                  onChange={(event) => setIwDispatchNotes(event.target.value)}
                  placeholder="Notas de la solicitud de despacho (opcional)"
                  className="w-full min-h-10 rounded-xl border border-slate-200 px-3 py-2 text-sm mb-3"
                />
                <button
                  type="button"
                  onClick={handleRequestDispatch}
                  disabled={loading || !iwDispatchRequiredDate || !iwDispatchClientAddress.trim()}
                  className="w-full min-h-11 px-4 py-3 bg-action-blue text-white rounded-xl font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
                >
                  Solicitar despacho
                </button>
              </RoleGatedAction>
            </WorkflowStep>

            {/* Paso 8: Logística valida guía y proforma (installation_workflow.logistics_validation)
                -- mismo motivo que el paso anterior: existia en el backend, sin UI. */}
            <WorkflowStep
              stepNumber={8}
              title="Validar logística"
              actor="Logística"
              status={roleStepStatus(step8Done, step8Active, LOGISTICS_ROLES)}
            >
              <RoleGatedAction allowedRoles={LOGISTICS_ROLES} userRoles={userRoles}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <input
                    type="text"
                    value={iwLogisticsGuideRef}
                    onChange={(event) => setIwLogisticsGuideRef(event.target.value)}
                    placeholder="Referencia de guía de remisión"
                    className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm"
                  />
                  <input
                    type="text"
                    value={iwLogisticsProformaRef}
                    onChange={(event) => setIwLogisticsProformaRef(event.target.value)}
                    placeholder="Referencia de proforma"
                    className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm"
                  />
                </div>
                <textarea
                  value={iwLogisticsNotes}
                  onChange={(event) => setIwLogisticsNotes(event.target.value)}
                  placeholder="Notas de la validación (opcional)"
                  className="w-full min-h-10 rounded-xl border border-slate-200 px-3 py-2 text-sm mb-3"
                />
                <button
                  type="button"
                  onClick={handleValidateLogistics}
                  disabled={loading || !iwLogisticsGuideRef.trim() || !iwLogisticsProformaRef.trim()}
                  className="w-full min-h-11 px-4 py-3 bg-action-blue text-white rounded-xl font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
                >
                  Validar logística
                </button>
              </RoleGatedAction>
            </WorkflowStep>

            {/* Paso 9: Jefe Técnico asigna técnico para el acta */}
            <WorkflowStep
              stepNumber={9}
              title="Asignar técnico para acta"
              actor="Jefe Técnico"
              status={roleStepStatus(step9Done, step9Active, PURCHASE_ROLE_GROUPS.jefe_tecnico)}
            >
              <RoleGatedAction allowedRoles={PURCHASE_ROLE_GROUPS.jefe_tecnico} userRoles={userRoles}>
                {actTechniciansLoading ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-warm-ash">
                    <FiLoader className="animate-spin" size={14} />
                    Cargando técnicos…
                  </div>
                ) : actTechnicians.length === 0 ? (
                  <p className="text-xs text-warm-ash py-2">Sin técnicos disponibles.</p>
                ) : (
                  <div className="space-y-1.5 mb-3 max-h-64 overflow-y-auto pr-0.5">
                    {actTechnicians.map((tech) => {
                      const isSelected = String(tech.id) === String(selectedActTechId);
                      return (
                        <button
                          key={tech.id}
                          type="button"
                          onClick={() => {
                            setSelectedActTechId(String(tech.id));
                            setDeliveryActAssignedName(tech.fullname || tech.name || '');
                            setDeliveryActAssignedEmail(tech.email || '');
                          }}
                          className={[
                            'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all duration-100 text-left',
                            isSelected
                              ? 'border-action-blue bg-action-blue/5 shadow-[0_0_0_2px_rgba(59,130,246,0.12)]'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                          ].join(' ')}
                        >
                          <div className={[
                            'w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold',
                            isSelected ? 'bg-action-blue text-white' : 'bg-slate-100 text-slate-600',
                          ].join(' ')}>
                            {isSelected ? <FiCheck size={13} /> : (tech.fullname || tech.name || '?')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-medium truncate leading-tight ${isSelected ? 'text-action-blue' : 'text-ink-slate'}`}>
                              {tech.fullname || tech.name || tech.email}
                            </p>
                            <p className="text-[10px] text-warm-ash truncate">{tech.email}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleAssignActTechnician}
                  disabled={loading || !deliveryActAssignedName.trim() || !deliveryActAssignedEmail.trim()}
                  className="w-full min-h-11 px-4 py-3 bg-action-blue text-white rounded-xl font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
                >
                  Asignar tecnico para acta
                </button>
              </RoleGatedAction>
            </WorkflowStep>

            {/* Paso 10: Logística sube acta firmada (CP-05: solo jefe_logistica + managers, no logistica base) */}
            <WorkflowStep
              stepNumber={10}
              title="Subir acta firmada por logística"
              actor="Jefe Logística"
              status={roleStepStatus(step10Done, step10Active, ['jefe_logistica', ...PURCHASE_ROLE_GROUPS.acp_comercial, ...PURCHASE_ROLE_GROUPS.gerencia, ...PURCHASE_ROLE_GROUPS.jefe_comercial])}
            >
              <RoleGatedAction
                allowedRoles={['jefe_logistica', ...PURCHASE_ROLE_GROUPS.acp_comercial, ...PURCHASE_ROLE_GROUPS.gerencia, ...PURCHASE_ROLE_GROUPS.jefe_comercial]}
                userRoles={userRoles}
              >
                <FileUploadZone
                  id="logistics-signed-act-file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  label="Subir acta logística"
                  description="PDF o imagen"
                  file={logisticsSignedActFile}
                  onFileChange={setLogisticsSignedActFile}
                  onUpload={handleUploadLogisticsSignedAct}
                  uploading={guideLoading && !!logisticsSignedActFile}
                  disabled={!step9Done}
                  uploadedLink={purchase?.delivery_act_logistics_signed_document_id ? `https://drive.google.com/file/d/${purchase.delivery_act_logistics_signed_document_id}/view` : null}
                  uploadedLabel="Acta firmada por logística"
                  errorMessage={!hasLogisticsSignedAct && !step9Done ? 'Disponible cuando el técnico ha sido asignado al acta.' : undefined}
                />
              </RoleGatedAction>
            </WorkflowStep>

            {/* Paso 11: Técnico sube acta final. Bug: usaba PURCHASE_ROLE_GROUPS.tecnico
                (incluye jefe_tecnico/jefe_servicio/etc), pero el backend
                (uploadDeliveryActFinalSigned) solo acepta tecnico/ing_servicio --
                jefe_tecnico veia el boton habilitado y el backend lo rechazaba con 403. */}
            <WorkflowStep
              stepNumber={11}
              title="Subir acta final"
              actor="Técnico"
              status={roleStepStatus(step11Done, step11Active, ['tecnico', 'ing_servicio', 'jefe_servicio'])}
            >
              {(purchase?.delivery_act_assigned_to_name || purchase?.delivery_act_assigned_to_email) && (
                <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-action-blue/20 bg-action-blue/5 px-3 py-2.5">
                  <div className="w-8 h-8 rounded-full bg-action-blue text-white flex items-center justify-center shrink-0 text-xs font-bold">
                    {(purchase.delivery_act_assigned_to_name || purchase.delivery_act_assigned_to_email)[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-warm-ash">Técnico asignado — solo esta persona puede subir el acta final</p>
                    <p className="text-sm font-medium text-ink-slate truncate">
                      {purchase.delivery_act_assigned_to_name || purchase.delivery_act_assigned_to_email}
                    </p>
                    {purchase.delivery_act_assigned_to_name && purchase.delivery_act_assigned_to_email && (
                      <p className="text-[11px] text-warm-ash truncate">{purchase.delivery_act_assigned_to_email}</p>
                    )}
                  </div>
                </div>
              )}
              <RoleGatedAction allowedRoles={['tecnico', 'ing_servicio', 'jefe_servicio']} userRoles={userRoles}>
                <FileUploadZone
                  id="final-act-file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  label="Subir acta final"
                  description="PDF o imagen"
                  file={finalActFile}
                  onFileChange={setFinalActFile}
                  onUpload={handleUploadFinalAct}
                  uploading={guideLoading && !!finalActFile}
                  disabled={!step10Done}
                  uploadedLink={purchase?.delivery_act_document_id ? `https://drive.google.com/file/d/${purchase.delivery_act_document_id}/view` : null}
                  uploadedLabel="Acta final de entrega"
                  errorMessage={!hasFinalAct && !step10Done ? 'Disponible cuando el acta de logística ya fue firmada y cargada.' : undefined}
                />
              </RoleGatedAction>
            </WorkflowStep>

            {/* Paso 12: Logística completa entrega */}
            <WorkflowStep
              stepNumber={12}
              title="Completar entrega"
              actor="Logística"
              status={roleStepStatus(deliveryCompleteDone, deliveryCompleteActive, LOGISTICS_ROLES)}
            >
              <RoleGatedAction allowedRoles={LOGISTICS_ROLES} userRoles={userRoles}>
                <button
                  onClick={handleCompleteDelivery}
                  disabled={loading}
                  className="w-full min-h-11 px-4 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
                >
                  {loading ? <span className="inline-flex items-center gap-2"><FiLoader className="animate-spin" size={16} />Completando...</span> : 'Completar Entrega'}
                </button>
              </RoleGatedAction>
            </WorkflowStep>
          </>
        ) : (
          <>
            {/* Publico — Paso 1: Operaciones solicita fechas */}
            <WorkflowStep
              stepNumber={1}
              title="Solicitar fecha de entrega"
              actor="Operaciones"
              status={roleStepStatus(step1Done, step1Active, OPERATIONS_ROLES)}
            >
              <RoleGatedAction allowedRoles={OPERATIONS_ROLES} userRoles={userRoles}>
                <div className="space-y-3">
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas (opcional)" className="w-full px-4 py-3 border border-fog rounded-md text-sm" rows={2} />
                  <button
                    onClick={handleRequestDeliveryDates}
                    disabled={loading}
                    className="w-full min-h-11 px-4 py-3 bg-action-blue text-white rounded-xl font-medium hover:bg-blue-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
                  >
                    {loading ? <span className="inline-flex items-center gap-2"><FiLoader className="animate-spin" size={16} />Solicitando...</span> : 'Solicitar Fechas de Entrega'}
                  </button>
                </div>
              </RoleGatedAction>
            </WorkflowStep>

            {/* Publico — Paso 2: Operaciones confirma fechas */}
            <WorkflowStep
              stepNumber={2}
              title="Confirmar fechas de entrega"
              actor="Operaciones"
              status={roleStepStatus(step2Done, step2Active, OPERATIONS_ROLES)}
            >
              <RoleGatedAction allowedRoles={OPERATIONS_ROLES} userRoles={userRoles}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <input type="date" value={deliveryStart} onChange={(e) => setDeliveryStart(e.target.value)} className="w-full px-4 py-3 border border-fog rounded-md text-sm" />
                  <input type="date" value={deliveryEnd} onChange={(e) => setDeliveryEnd(e.target.value)} className="w-full px-4 py-3 border border-fog rounded-md text-sm" />
                </div>
                <button
                  onClick={handleSubmitDeliveryDates}
                  disabled={loading || !deliveryStart || !deliveryEnd}
                  className="w-full min-h-11 px-4 py-3 bg-action-blue text-white rounded-xl font-medium hover:bg-blue-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
                >
                  {loading ? <span className="inline-flex items-center gap-2"><FiLoader className="animate-spin" size={16} />Confirmando...</span> : 'Confirmar Fechas de Entrega'}
                </button>
              </RoleGatedAction>
            </WorkflowStep>

            {/* Publico — Paso 3: Logística marca equipo llegado */}
            <WorkflowStep
              stepNumber={3}
              title="Marcar equipo llegado"
              actor="Logística"
              status={roleStepStatus(step3Done, step3Active, LOGISTICS_ROLES)}
            >
              <RoleGatedAction allowedRoles={LOGISTICS_ROLES} userRoles={userRoles}>
                <button
                  onClick={handleMarkEquipmentArrived}
                  disabled={loading}
                  className="w-full min-h-11 px-4 py-3 bg-action-blue text-white rounded-xl font-medium hover:bg-blue-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
                >
                  {loading ? <span className="inline-flex items-center gap-2"><FiLoader className="animate-spin" size={16} />Marcando...</span> : 'Marcar Equipo Llegado'}
                </button>
              </RoleGatedAction>
            </WorkflowStep>

            {/* Publico — Paso 4: Logística marca listo para despacho */}
            <WorkflowStep
              stepNumber={4}
              title="Marcar listo para despacho"
              actor="Logística"
              status={roleStepStatus(step4Done, step4Active, LOGISTICS_ROLES)}
            >
              <RoleGatedAction allowedRoles={LOGISTICS_ROLES} userRoles={userRoles}>
                <button
                  onClick={handleMarkDispatchReady}
                  disabled={loading}
                  className="w-full min-h-11 px-4 py-3 bg-action-blue text-white rounded-xl font-medium hover:bg-blue-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
                >
                  {loading ? <span className="inline-flex items-center gap-2"><FiLoader className="animate-spin" size={16} />Marcando...</span> : 'Marcar Listo para Despacho'}
                </button>
              </RoleGatedAction>
            </WorkflowStep>

            {/* Publico — Paso 5: Logística completa entrega */}
            <WorkflowStep
              stepNumber={5}
              title="Completar entrega"
              actor="Logística"
              status={roleStepStatus(deliveryCompleteDone, deliveryCompleteActive, LOGISTICS_ROLES)}
            >
              <RoleGatedAction allowedRoles={LOGISTICS_ROLES} userRoles={userRoles}>
                <button
                  onClick={handleCompleteDelivery}
                  disabled={loading}
                  className="w-full min-h-11 px-4 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
                >
                  {loading ? <span className="inline-flex items-center gap-2"><FiLoader className="animate-spin" size={16} />Completando...</span> : 'Completar Entrega'}
                </button>
              </RoleGatedAction>
            </WorkflowStep>
          </>
        )}

        {/* Serial: en paralelo al flujo principal, no bloquea ni bloquea pasos */}
        <div className="bg-white rounded-xl border border-soft-border p-5 shadow-ambient">
          <div className="flex items-center gap-2 mb-4">
            <FiPackage className="text-action-blue" size={18} />
            <h3 className="text-sm font-semibold text-ink-slate">Número de serie</h3>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              statusInfo.variant === 'green' ? 'bg-green-soft text-operative-green' :
              statusInfo.variant === 'amber' ? 'bg-amber-soft text-caution-amber' :
              'bg-fog text-ink-slate'
            }`}>
              {statusInfo.label}
            </div>
          </div>
          {canRegisterSerial && (
            <RoleGatedAction allowedRoles={LOGISTICS_ROLES} userRoles={userRoles}>
              <div className="space-y-3">
                <input
                  type="text"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="Ingrese el número de serie"
                  className="w-full px-4 py-3 border border-fog rounded-md text-sm text-ink-slate focus:outline-none focus:border-action-blue focus:ring-2 focus:ring-sky-signal/20"
                />
                <button
                  onClick={handleRegisterSerial}
                  disabled={loading || !serialNumber.trim()}
                  className="w-full min-h-11 px-4 py-3 bg-action-blue text-white rounded-xl font-medium hover:bg-blue-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
                >
                  {loading ? 'Registrando...' : 'Registrar serial'}
                </button>
              </div>
            </RoleGatedAction>
          )}
        </div>
      </div>
    </div>
  );
};

export default EquipmentLogisticsTab;
