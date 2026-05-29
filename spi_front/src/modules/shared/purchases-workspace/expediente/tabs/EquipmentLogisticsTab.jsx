import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FiPackage, FiTruck, FiCalendar, FiLoader, FiUpload } from 'react-icons/fi';
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
  registerPrivatePurchaseSerial,
  requestDeliveryDates as requestPrivateDeliveryDates,
  submitDeliveryDates as submitPrivateDeliveryDates,
  updatePrivatePurchaseDispatchDetails,
  uploadPrivatePurchaseDeliveryAct,
  uploadPrivatePurchaseDeliveryGuides,
} from '../../../../../core/api/privatePurchasesApi';

const EASE_OUT = [0.23, 1, 0.32, 1];

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

  const isPrivate = type === 'private' || purchase?.purchase_type === 'private';
  const serialStatus = purchase?.serial_status || 'not_applicable_yet';
  const statusInfo = SERIAL_STATUSES[serialStatus] || SERIAL_STATUSES.not_applicable_yet;
  const canRegisterSerial = serialStatus === 'received_pending_serial';

  const handleRequestDeliveryDates = async () => {
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

  return (
    <div className="flex flex-col min-w-0">
      {/* Header del tab */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
        <div>
          <h2 className="text-lg font-semibold text-ink-slate">Logística Equipo</h2>
          <p className="text-xs text-warm-ash mt-0.5">Flujo: Comercial → Operaciones → Logística</p>
        </div>
        <TabBadge status={statusInfo.variant === 'green' ? 'completado' : 'pendiente'} />
      </div>

      <div className="p-6 space-y-6">
        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {/* Fechas de entrega */}
        <div className="bg-white rounded-xl border border-soft-border p-5 shadow-ambient">
          <div className="flex items-center gap-2 mb-4">
            <FiCalendar className="text-action-blue" size={18} />
            <h3 className="text-sm font-semibold text-ink-slate">Fechas de entrega</h3>
          </div>
          <div className="space-y-4">
            {/* Solicitar fechas — Comercial + Backoffice + Managers */}
            <RoleGatedAction
              allowedRoles={[
                'comercial', 'asesor_comercial', 'analista_comercial',
                'backoffice', 'backoffice_comercial',
                'acp_comercial', 'gerencia', 'gerencia_general', 'jefe_comercial', 'jefe_de_comercial',
              ]}
              userRoles={userRoles}
            >
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-ink-slate mb-2">Notas (opcional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notas sobre la solicitud de fechas"
                    className="w-full px-4 py-3 border border-fog rounded-md text-sm text-ink-slate focus:outline-none focus:border-action-blue focus:ring-2 focus:ring-sky-signal/20"
                    rows={2}
                  />
                </div>
                <button
                  onClick={handleRequestDeliveryDates}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-action-blue text-white rounded-xl font-medium hover:bg-blue-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <FiLoader className="animate-spin" size={16} />
                      Solicitando...
                    </div>
                  ) : (
                    'Solicitar Fechas de Entrega'
                  )}
                </button>
              </div>
            </RoleGatedAction>

            {/* Confirmar fechas (Operaciones/Logística) */}
            <RoleGatedAction
              allowedRoles={['jefe_operaciones', 'operaciones', 'jefe_logistica', 'logistica']}
              userRoles={userRoles}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-slate mb-2">Inicio de entrega</label>
                  <input
                    type="date"
                    value={deliveryStart}
                    onChange={(e) => setDeliveryStart(e.target.value)}
                    className="w-full px-4 py-3 border border-fog rounded-md text-sm text-ink-slate focus:outline-none focus:border-action-blue focus:ring-2 focus:ring-sky-signal/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-slate mb-2">Fin de entrega</label>
                  <input
                    type="date"
                    value={deliveryEnd}
                    onChange={(e) => setDeliveryEnd(e.target.value)}
                    className="w-full px-4 py-3 border border-fog rounded-md text-sm text-ink-slate focus:outline-none focus:border-action-blue focus:ring-2 focus:ring-sky-signal/20"
                  />
                </div>
              </div>
              <button
                onClick={handleSubmitDeliveryDates}
                disabled={loading || !deliveryStart || !deliveryEnd}
                className="w-full px-4 py-3 bg-action-blue text-white rounded-xl font-medium hover:bg-blue-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <FiLoader className="animate-spin" size={16} />
                    Confirmando...
                  </div>
                ) : (
                  'Confirmar Fechas de Entrega'
                )}
              </button>
            </RoleGatedAction>
          </div>
        </div>

        {/* Llegada del equipo */}
        <div className="bg-white rounded-xl border border-soft-border p-5 shadow-ambient">
          <div className="flex items-center gap-2 mb-4">
            <FiTruck className="text-action-blue" size={18} />
            <h3 className="text-sm font-semibold text-ink-slate">Llegada del equipo</h3>
          </div>
          <div className="space-y-4">
            <RoleGatedAction
              allowedRoles={['jefe_logistica', 'logistica', 'jefe_operaciones', 'operaciones']}
              userRoles={userRoles}
            >
              <button
                onClick={handleMarkEquipmentArrived}
                disabled={loading}
                className="w-full px-4 py-3 bg-action-blue text-white rounded-xl font-medium hover:bg-blue-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <FiLoader className="animate-spin" size={16} />
                    Marcando...
                  </div>
                ) : (
                  'Marcar Equipo Llegado'
                )}
              </button>
            </RoleGatedAction>
          </div>
        </div>

        {isPrivate && (
          <div className="bg-white rounded-xl border border-soft-border p-5 shadow-ambient">
            <div className="flex items-center gap-2 mb-4">
              <FiUpload className="text-action-blue" size={18} />
              <h3 className="text-sm font-semibold text-ink-slate">Guias de entrega</h3>
            </div>
            <div className="space-y-3">
              <label
                className="relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-paper-white px-4 py-6 text-center cursor-pointer hover:border-action-blue hover:bg-blue-50/40 transition-all"
              >
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(event) => setGuideFiles(Array.from(event.target.files || []))}
                  className="hidden"
                />
                <FiUpload className="text-warm-ash" size={20} />
                {guideFiles.length > 0 ? (
                  <span className="text-sm font-medium text-ink-slate">
                    {guideFiles.length} archivo{guideFiles.length > 1 ? 's' : ''} seleccionado{guideFiles.length > 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className="text-sm text-warm-ash">Seleccionar guías (PDF, imágenes)</span>
                )}
                <span className="text-xs text-warm-ash">Podés seleccionar varios archivos a la vez</span>
              </label>
              <RoleGatedAction allowedRoles={['jefe_operaciones', 'operaciones', 'jefe_logistica', 'logistica']} userRoles={userRoles}>
                <button
                  type="button"
                  onClick={handleUploadGuides}
                  disabled={guideLoading || guideFiles.length === 0}
                  className="w-full min-h-11 inline-flex items-center justify-center gap-2 bg-action-blue text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
                >
                  {guideLoading ? (
                    <><FiLoader className="animate-spin" size={15} />Subiendo...</>
                  ) : (
                    <><FiUpload size={14} />Subir guías de entrega</>
                  )}
                </button>
              </RoleGatedAction>
            </div>
          </div>
        )}

        {isPrivate && (
          <div className="bg-white rounded-xl border border-soft-border p-5 shadow-ambient">
            <h3 className="text-sm font-semibold text-ink-slate mb-4">Acta de entrega privada</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <input
                type="date"
                value={dispatchDate}
                onChange={(event) => setDispatchDate(event.target.value)}
                className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm"
              />
              <textarea
                value={dispatchObservations}
                onChange={(event) => setDispatchObservations(event.target.value)}
                placeholder="Observaciones del acta (una por linea)"
                className="min-h-10 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <textarea
              value={dispatchNotes}
              onChange={(event) => setDispatchNotes(event.target.value)}
              placeholder="Notas de despacho"
              className="w-full min-h-10 rounded-xl border border-slate-200 px-3 py-2 text-sm mb-3"
            />
            <RoleGatedAction allowedRoles={['jefe_logistica', 'logistica', 'jefe_operaciones', 'operaciones']} userRoles={userRoles}>
              <button
                type="button"
                onClick={handleSaveDispatchDetails}
                disabled={loading}
                className="w-full min-h-11 px-4 py-3 bg-action-blue text-white rounded-xl font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
              >
                Guardar datos de despacho
              </button>
            </RoleGatedAction>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                value={deliveryActAssignedName}
                onChange={(event) => setDeliveryActAssignedName(event.target.value)}
                placeholder="Nombre del tecnico asignado"
                className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm"
              />
              <input
                type="email"
                value={deliveryActAssignedEmail}
                onChange={(event) => setDeliveryActAssignedEmail(event.target.value)}
                placeholder="Correo del tecnico asignado"
                className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm"
              />
            </div>
            <RoleGatedAction allowedRoles={['jefe_tecnico', 'jefe_servicio_tecnico']} userRoles={userRoles}>
              <button
                type="button"
                onClick={handleAssignActTechnician}
                disabled={loading || !deliveryActAssignedName.trim() || !deliveryActAssignedEmail.trim()}
                className="mt-3 w-full min-h-11 px-4 py-3 bg-action-blue text-white rounded-xl font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
              >
                Asignar tecnico para acta
              </button>
            </RoleGatedAction>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-ink-slate mb-2">Acta firmada por logística</p>
                {/* CP-05: base logistica NO genera/sube actas — solo jefe_logistica + managers */}
                <RoleGatedAction
                  allowedRoles={['jefe_logistica', 'acp_comercial', 'gerencia', 'gerencia_general', 'jefe_comercial', 'jefe_de_comercial']}
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
                    disabled={purchase?.status !== 'delivery_act_tech_assigned'}
                    uploadedLink={purchase?.delivery_act_logistics_signed_document_id
                      ? `https://drive.google.com/file/d/${purchase.delivery_act_logistics_signed_document_id}/view`
                      : null}
                    uploadedLabel="Acta firmada por logística"
                    errorMessage={
                      !purchase?.delivery_act_logistics_signed_document_id && purchase?.status !== 'delivery_act_tech_assigned'
                        ? 'Disponible cuando el técnico ha sido asignado al acta.'
                        : undefined
                    }
                  />
                </RoleGatedAction>
              </div>
              <div>
                <p className="text-xs font-medium text-ink-slate mb-2">Acta final (técnico asignado)</p>
                <RoleGatedAction allowedRoles={['tecnico', 'jefe_tecnico', 'jefe_servicio_tecnico']} userRoles={userRoles}>
                  <FileUploadZone
                    id="final-act-file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    label="Subir acta final"
                    description="PDF o imagen"
                    file={finalActFile}
                    onFileChange={setFinalActFile}
                    onUpload={handleUploadFinalAct}
                    uploading={guideLoading && !!finalActFile}
                    disabled={purchase?.status !== 'delivery_act_logistics_signed'}
                    uploadedLink={purchase?.delivery_act_document_id
                      ? `https://drive.google.com/file/d/${purchase.delivery_act_document_id}/view`
                      : null}
                    uploadedLabel="Acta final de entrega"
                    errorMessage={
                      !purchase?.delivery_act_document_id && purchase?.status !== 'delivery_act_logistics_signed'
                        ? 'Disponible cuando el acta de logística ya fue firmada y cargada.'
                        : undefined
                    }
                  />
                </RoleGatedAction>
              </div>
            </div>
          </div>
        )}

        {/* Estado del serial */}
        <div className="bg-white rounded-xl border border-soft-border p-5 shadow-ambient">
          <h3 className="text-sm font-semibold text-ink-slate mb-4">Estado del serial</h3>
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              statusInfo.variant === 'green' ? 'bg-green-soft text-operative-green' :
              statusInfo.variant === 'amber' ? 'bg-amber-soft text-caution-amber' :
              'bg-fog text-ink-slate'
            }`}>
              {statusInfo.label}
            </div>
          </div>
        </div>

        {/* Registro de serial (solo si está permitido) */}
        {canRegisterSerial && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, ease: EASE_OUT }}
            className="bg-white rounded-xl border border-soft-border p-5 shadow-ambient"
          >
            <div className="flex items-center gap-2 mb-4">
              <FiPackage className="text-action-blue" size={18} />
              <h3 className="text-sm font-semibold text-ink-slate">Registrar número de serie</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-slate mb-2">Número de serie</label>
                <input
                  type="text"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="Ingrese el número de serie"
                  className="w-full px-4 py-3 border border-fog rounded-md text-sm text-ink-slate focus:outline-none focus:border-action-blue focus:ring-2 focus:ring-sky-signal/20"
                />
              </div>
              <RoleGatedAction
                allowedRoles={['jefe_logistica', 'logistica', 'jefe_operaciones']}
                userRoles={userRoles}
              >
                <button
                  onClick={handleRegisterSerial}
                  disabled={loading || !serialNumber.trim()}
                  className="w-full px-4 py-3 bg-action-blue text-white rounded-xl font-medium hover:bg-blue-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Registrando...' : 'Registrar serial'}
                </button>
              </RoleGatedAction>
            </div>
          </motion.div>
        )}

        {/* Listo para despacho */}
        <div className="bg-white rounded-xl border border-soft-border p-5 shadow-ambient">
          <div className="flex items-center gap-2 mb-4">
            <FiPackage className="text-action-blue" size={18} />
            <h3 className="text-sm font-semibold text-ink-slate">Despacho</h3>
          </div>
          <div className="space-y-4">
            <RoleGatedAction
              allowedRoles={['jefe_logistica', 'logistica', 'jefe_operaciones']}
              userRoles={userRoles}
            >
              <button
                onClick={handleMarkDispatchReady}
                disabled={loading || isPrivate}
                className="w-full px-4 py-3 bg-action-blue text-white rounded-xl font-medium hover:bg-blue-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <FiLoader className="animate-spin" size={16} />
                    Marcando...
                  </div>
                ) : (
                  'Marcar Listo para Despacho'
                )}
              </button>
            </RoleGatedAction>

            <RoleGatedAction
              allowedRoles={['jefe_logistica', 'logistica', 'jefe_operaciones', 'operaciones']}
              userRoles={userRoles}
            >
              <button
                onClick={handleCompleteDelivery}
                disabled={loading}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <FiLoader className="animate-spin" size={16} />
                    Completando...
                  </div>
                ) : (
                  'Completar Entrega'
                )}
              </button>
            </RoleGatedAction>
          </div>
        </div>

        {/* Mensaje si no se puede registrar serial */}
        {!canRegisterSerial && (
          <div className="bg-amber-soft rounded-xl border border-amber-200 p-5">
            <div className="flex items-center gap-2 mb-2">
              <FiPackage className="text-caution-amber" size={18} />
              <h3 className="text-sm font-semibold text-ink-slate">Serial no disponible aún</h3>
            </div>
            <p className="text-xs text-warm-ash">
              El serial se registra solo cuando el equipo llega físicamente.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EquipmentLogisticsTab;
