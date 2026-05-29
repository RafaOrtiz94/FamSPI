import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiBriefcase,
  FiCheckCircle,
  FiXCircle,
  FiAlertCircle,
  FiLoader,
  FiPackage,
  FiUser,
  FiExternalLink,
  FiMail,
  FiPhone,
  FiMapPin,
  FiFileText,
  FiCalendar,
  FiTag,
} from 'react-icons/fi';
import TabBadge from '../../components/TabBadge';
import { setPurchaseType, setPrivateModality } from '../../../../../core/api/equipmentPurchasesApi';
import { getEquipmentPurchaseApiError } from '../../../../../core/api/equipmentPurchasesApi';

const EASE_OUT = [0.23, 1, 0.32, 1];

/* ─── helpers ────────────────────────────────────────────────────────── */
const equipmentLabel = (e) => e?.model || e?.name || e?.equipment_name || e?.label || 'Equipo';

/* Modalidades para expedientes públicos reclasificados */
const PRIVATE_MODALITIES = [
  { value: 'direct_sale',                 label: 'Venta directa',                        description: 'Venta directa sin Business Case' },
  { value: 'rental',                       label: 'Alquiler',                              description: 'Alquiler sin Business Case' },
  { value: 'rental_with_domain_transfer',  label: 'Alquiler con transferencia de dominio', description: 'Alquiler con transferencia de dominio' },
  { value: 'comodato',                     label: 'Comodato',                              description: 'Requiere Business Case' },
];

/* Labels para compras privadas puras (offer_kind) */
const OFFER_KIND_LABELS = {
  venta:                          'Venta directa',
  alquiler:                       'Alquiler',
  alquiler_transferencia_dominio: 'Alquiler con transferencia de dominio',
  comodato:                       'Comodato',
};

/* Badges para el tipo de disponibilidad del equipo */
const EQUIP_TYPE_CONFIG = {
  new:              { label: 'Nuevo',                    cls: 'bg-green-soft text-operative-green border-green-200' },
  cu:               { label: 'Condición de uso',          cls: 'bg-amber-soft text-caution-amber border-amber-200'  },
  import_new:       { label: 'Nuevo vía importación',    cls: 'bg-red-50 text-alert-red border-red-200'            },
  new_available:    { label: 'Nuevo disponible',          cls: 'bg-green-soft text-operative-green border-green-200' },
  cu_available:     { label: 'Condición de uso',          cls: 'bg-amber-soft text-caution-amber border-amber-200'  },
  import_available: { label: 'Importación',               cls: 'bg-red-50 text-alert-red border-red-200'            },
  not_available:    { label: 'No disponible',             cls: 'bg-slate-100 text-slate-500 border-slate-200'       },
};

/* Roles que pueden EDITAR tipo/modalidad (solo expedientes públicos) */
const TYPE_EDIT_ROLES = ['jefe_comercial', 'jefe_de_comercial', 'gerencia', 'gerencia_general'];

/* ─── Pequeño campo de detalle ────────────────────────────────────────── */
const DetailField = ({ icon: Icon, label, value }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5">
      {Icon && <Icon size={13} className="text-warm-ash shrink-0 mt-0.5" />}
      <div className="min-w-0">
        <p className="text-[10px] text-warm-ash uppercase tracking-wide font-medium">{label}</p>
        <p className="text-sm text-ink-slate font-medium break-words">{value}</p>
      </div>
    </div>
  );
};

/* ─── Formateo de fecha ───────────────────────────────────────────────── */
const fmtDate = (iso) => {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
  } catch { return null; }
};

/* ═══════════════════════════════════════════════════════════════════════ */

const CommercialTab = ({ purchase, type, userRoles, hasRole, refresh }) => {
  const [selectedModality, setSelectedModality] = useState(purchase?.private_modality || null);
  const [loading,          setLoading]           = useState(false);
  const [error,            setError]             = useState(null);

  /* ── derived flags ──────────────────────────────────────────────────── */
  const isPurePrivate      = type === 'private';
  const isPublicExpediente = type === 'public';
  const isPurchasePublic   = purchase?.purchase_type === 'public'  || isPublicExpediente;
  const isPurchasePrivate  = purchase?.purchase_type === 'private' || isPurePrivate;

  const effectiveModality = isPurePrivate
    ? (purchase?.offer_kind || null)
    : (purchase?.private_modality || null);

  const effectiveModalityLabel = isPurePrivate
    ? (OFFER_KIND_LABELS[effectiveModality] || effectiveModality || 'Sin definir')
    : (PRIVATE_MODALITIES.find((m) => m.value === effectiveModality)?.label || 'Sin definir');

  const requiresBusinessCase = isPurePrivate
    ? purchase?.offer_kind === 'comodato'
    : Boolean(purchase?.requires_business_case);

  const isComodato = effectiveModality === 'comodato'
    || purchase?.private_modality === 'comodato'
    || purchase?.offer_kind === 'comodato';

  const canEditType     = isPublicExpediente && userRoles.some((r) => TYPE_EDIT_ROLES.includes(r));
  const canEditModality = canEditType;

  /* ── datos de cliente ────────────────────────────────────────────────── */
  const snapshot      = purchase?.client_snapshot || purchase?.client_data || {};
  // client_request: datos canónicos del cliente cuando ya está registrado en el sistema.
  // Se adjunta por _attachClientRequestSnapshot en el backend.
  const clientRequest = snapshot.client_request || null;
  const isRegistered  = Boolean(purchase?.client_registered_at || snapshot?.registered_client_id || clientRequest?.id);

  const clientName = clientRequest?.commercial_name
    || snapshot.commercial_name
    || snapshot.legal_person_business_name
    || purchase?.equipment?.[0]?.provider_name
    || purchase?.provider_name
    || '—';

  // Email: del cliente registrado (client_requests.client_email) o del snapshot inicial
  const clientEmail   = clientRequest?.client_email  || snapshot.email  || null;
  // Teléfono: del cliente registrado o del snapshot inicial
  const clientPhone   = clientRequest?.establishment_cellphone || clientRequest?.establishment_phone
    || snapshot.phone || null;
  // RUC/Cédula
  const clientRuc     = clientRequest?.ruc_cedula || snapshot.ruc_cedula || null;
  // Contacto
  const clientContact = clientRequest?.shipping_contact_name || snapshot.contact_person || null;
  // Dirección
  const clientAddress = clientRequest?.establishment_address || clientRequest?.shipping_address || snapshot.address || null;

  /* ¿Hay datos completos del cliente? */
  const hasFullClientData = Boolean(clientRuc || clientEmail || clientPhone || clientContact);

  /* Tipo de cliente legible */
  const clientTypeLabel =
    snapshot.client_type === 'persona_juridica' ? 'Persona jurídica' :
    snapshot.client_type === 'persona_natural'  ? 'Persona natural'  :
    snapshot.client_type ? snapshot.client_type : null;

  /* ── equipo ──────────────────────────────────────────────────────────── */
  const equipmentItems = Array.isArray(purchase?.equipment) ? purchase.equipment : [];

  /* ── BC info ─────────────────────────────────────────────────────────── */
  const bcId  = purchase?.extra?.auto_business_case_id || purchase?.business_case_id || null;
  const bcUrl = bcId ? `/dashboard/business-case/workspace/${bcId}` : null;

  /* ── handlers ──────────────────────────────────────────────────────── */
  const handleSetPurchaseType = async (newType) => {
    if (newType === purchase?.purchase_type) return;
    setLoading(true);
    setError(null);
    try {
      await setPurchaseType(purchase.id, { purchaseType: newType, expected_updated_at: purchase.updated_at });
      await refresh();
    } catch (err) {
      setError(getEquipmentPurchaseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetPrivateModality = async (modality) => {
    if (modality === purchase?.private_modality) return;
    setLoading(true);
    setError(null);
    try {
      await setPrivateModality(purchase.id, { privateModality: modality, expected_updated_at: purchase.updated_at });
      setSelectedModality(modality);
      await refresh();
    } catch (err) {
      setError(getEquipmentPurchaseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  /* ── render ─────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
        <div>
          <h2 className="text-lg font-semibold text-ink-slate">Comercial</h2>
          <p className="text-xs text-warm-ash mt-0.5">Detalle de la solicitud, cliente y equipos</p>
        </div>
        <TabBadge status={requiresBusinessCase ? 'pendiente' : 'completado'} />
      </div>

      <div className="p-6 space-y-5">
        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <FiAlertCircle className="text-alert-red mt-0.5 shrink-0" size={18} />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            SECCIÓN A — Resumen de la solicitud
        ═══════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-xl border border-soft-border p-5 shadow-ambient">
          <div className="flex items-center gap-2 mb-4">
            <FiFileText className="text-action-blue" size={15} />
            <h3 className="text-sm font-semibold text-ink-slate">Resumen de la solicitud</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
            <DetailField
              icon={FiBriefcase}
              label="Tipo de compra"
              value={isPurchasePublic ? 'Compra pública' : isPurchasePrivate ? 'Compra privada' : '—'}
            />
            <DetailField
              icon={FiTag}
              label="Modalidad"
              value={effectiveModalityLabel}
            />
            {purchase?.status && (
              <DetailField
                icon={null}
                label="Estado actual"
                value={purchase.status}
              />
            )}
            {purchase?.offer_valid_until && (
              <DetailField
                icon={FiCalendar}
                label="Vigencia de oferta"
                value={fmtDate(purchase.offer_valid_until)}
              />
            )}
            {purchase?.created_at && (
              <DetailField
                icon={FiCalendar}
                label="Fecha de solicitud"
                value={fmtDate(purchase.created_at)}
              />
            )}
            {purchase?.created_by_email && (
              <DetailField
                icon={FiUser}
                label="Solicitado por"
                value={purchase.created_by_email}
              />
            )}
          </div>

          {purchase?.notes && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-[10px] text-warm-ash uppercase tracking-wide font-medium mb-1">Notas</p>
              <p className="text-sm text-ink-slate leading-relaxed">{purchase.notes}</p>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            SECCIÓN B — Información del cliente
        ═══════════════════════════════════════════════════════════════ */}
        {clientName !== '—' && (
          <div className="bg-white rounded-xl border border-soft-border p-5 shadow-ambient">
            <div className="flex items-center gap-2 mb-4">
              <FiUser className="text-action-blue" size={15} />
              <h3 className="text-sm font-semibold text-ink-slate">
                {isPurchasePublic ? 'Proveedor / Cliente' : 'Información del cliente'}
              </h3>
              {clientTypeLabel && (
                <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                  {clientTypeLabel}
                </span>
              )}
            </div>

            {/* Badge de registrado */}
            {isRegistered && (
              <div className="flex items-center gap-1.5 mb-3 text-xs text-operative-green font-medium">
                <FiCheckCircle size={13} />
                Cliente registrado en el sistema
              </div>
            )}

            {hasFullClientData ? (
              /* Datos completos */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                {clientName !== '—' && (
                  <DetailField
                    icon={FiBriefcase}
                    label="Nombre / Razón social"
                    value={clientName}
                  />
                )}
                {clientRuc && (
                  <DetailField icon={FiFileText} label="RUC / Cédula" value={clientRuc} />
                )}
                {clientEmail && (
                  <DetailField icon={FiMail} label="Correo" value={clientEmail} />
                )}
                {clientPhone && (
                  <DetailField icon={FiPhone} label="Teléfono / Celular" value={clientPhone} />
                )}
                {clientContact && (
                  <DetailField icon={FiUser} label="Persona de contacto" value={clientContact} />
                )}
                {clientAddress && (
                  <div className="sm:col-span-2">
                    <DetailField icon={FiMapPin} label="Dirección" value={clientAddress} />
                  </div>
                )}
              </div>
            ) : (
              /* Solo nombre */
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="w-8 h-8 rounded-full bg-action-blue/10 flex items-center justify-center shrink-0">
                  <FiUser size={14} className="text-action-blue" />
                </div>
                <p className="text-sm font-semibold text-ink-slate">{clientName}</p>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            SECCIÓN C — Equipo solicitado
        ═══════════════════════════════════════════════════════════════ */}
        {equipmentItems.length > 0 && (
          <div className="bg-white rounded-xl border border-soft-border p-5 shadow-ambient">
            <div className="flex items-center gap-2 mb-4">
              <FiPackage className="text-action-blue" size={15} />
              <h3 className="text-sm font-semibold text-ink-slate">Equipo solicitado</h3>
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                {equipmentItems.length} ítem{equipmentItems.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="space-y-2">
              {equipmentItems.map((item, i) => {
                /* Tipo del equipo: de creación (item.type) o de respuesta del proveedor (item.available_type) */
                const rawType = item.available_type || item.type || null;
                const typeCfg = rawType ? EQUIP_TYPE_CONFIG[rawType] : null;

                return (
                  <div
                    key={item.id || i}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100"
                  >
                    {/* Número */}
                    <span className="w-6 h-6 rounded-full bg-action-blue/10 text-action-blue text-[10px] font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>

                    {/* Nombre + detalles */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink-slate truncate">{equipmentLabel(item)}</p>
                      {(item.sku || item.category) && (
                        <p className="text-[11px] text-warm-ash mt-0.5">
                          {[item.sku && `SKU: ${item.sku}`, item.category].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>

                    {/* Cantidad */}
                    {item.quantity && item.quantity > 1 && (
                      <span className="text-xs text-warm-ash font-mono shrink-0">×{item.quantity}</span>
                    )}

                    {/* Badge de tipo de disponibilidad */}
                    {typeCfg ? (
                      <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${typeCfg.cls}`}>
                        {typeCfg.label}
                      </span>
                    ) : rawType && (
                      <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-slate-100 text-slate-500 border-slate-200">
                        {rawType}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            SECCIÓN 1 — Tipo de compra (editable o solo lectura)
        ═══════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-xl border border-soft-border p-5 shadow-ambient">
          <h3 className="text-sm font-semibold text-ink-slate mb-4">Tipo de compra</h3>

          {canEditType ? (
            <div className="flex flex-col sm:flex-row gap-3">
              {['public', 'private'].map((t) => {
                const isActive = t === 'public' ? isPurchasePublic : isPurchasePrivate;
                const label    = t === 'public' ? 'Compra pública' : 'Compra privada';
                return (
                  <button
                    key={t}
                    onClick={() => handleSetPurchaseType(t)}
                    disabled={loading}
                    className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-action-blue text-white shadow-lifted ring-2 ring-action-blue ring-offset-2'
                        : 'bg-white border border-fog text-ink-slate hover:bg-paper-white hover:shadow-lifted'
                    } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      {loading ? <FiLoader className="animate-spin" size={16} /> : <FiBriefcase size={16} />}
                      {label}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
              <FiBriefcase className="text-action-blue shrink-0" size={16} />
              <div>
                <p className="text-xs text-warm-ash">Tipo asignado</p>
                <p className="text-sm font-semibold text-ink-slate">
                  {isPurchasePublic ? 'Compra pública' : isPurchasePrivate ? 'Compra privada' : 'Sin definir'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            SECCIÓN 2 — Modalidad (solo compras privadas)
        ═══════════════════════════════════════════════════════════════ */}
        {isPurchasePrivate && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="bg-white rounded-xl border border-soft-border p-5 shadow-ambient"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-ink-slate">Modalidad</h3>
              {isPurePrivate && (
                <span className="text-[11px] text-warm-ash px-2 py-0.5 rounded-full bg-slate-100">
                  Definida en la solicitud
                </span>
              )}
            </div>

            {canEditModality ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {PRIVATE_MODALITIES.map((modality) => (
                  <button
                    key={modality.value}
                    onClick={() => handleSetPrivateModality(modality.value)}
                    disabled={loading}
                    className={`p-4 rounded-xl text-left transition-all duration-150 border cursor-pointer ${
                      selectedModality === modality.value
                        ? 'border-action-blue bg-action-blue/5 shadow-lifted ring-2 ring-action-blue ring-offset-1'
                        : 'border-soft-border hover:bg-paper-white hover:shadow-lifted'
                    } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-ink-slate">{modality.label}</div>
                        <div className="text-xs text-warm-ash mt-1">{modality.description}</div>
                      </div>
                      {selectedModality === modality.value && (
                        <FiCheckCircle className="text-action-blue shrink-0" size={18} />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
                <FiBriefcase className="text-action-blue shrink-0" size={16} />
                <div>
                  <p className="text-xs text-warm-ash">Modalidad</p>
                  <p className="text-sm font-semibold text-ink-slate">{effectiveModalityLabel}</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            SECCIÓN 3 — Resumen ACP / Compra pública (BC link)
        ═══════════════════════════════════════════════════════════════ */}
        {isPurchasePublic && bcUrl && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="bg-white rounded-xl border border-soft-border p-5 shadow-ambient"
          >
            <div className="flex items-center gap-2 mb-3">
              <FiBriefcase className="text-action-blue" size={15} />
              <h3 className="text-sm font-semibold text-ink-slate">Business Case vinculado</h3>
            </div>
            <a
              href={bcUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-action-blue hover:underline font-medium"
            >
              <FiExternalLink size={13} />
              Abrir Business Case
            </a>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            SECCIÓN 4 — Business Case (comodato privado)
        ═══════════════════════════════════════════════════════════════ */}
        {isPurchasePrivate && requiresBusinessCase && isComodato && (() => {
          const bcStage      = purchase?.auto_business_case_stage || purchase?.extra?.business_case_decision?.outcome || null;
          const privateBcId  = purchase?.extra?.auto_business_case_id || purchase?.business_case_id;
          const privateBcUrl = privateBcId ? `/dashboard/business-case/workspace/${privateBcId}` : null;

          const STAGE_CONFIG = {
            factible:            { label: 'Factible',      bg: 'bg-green-50 border-green-200', badge: 'bg-operative-green text-white', icon: <FiCheckCircle size={16} />, description: 'El Business Case fue aprobado. La solicitud puede continuar.' },
            cerrado_no_factible: { label: 'No factible',   bg: 'bg-red-50 border-red-200',     badge: 'bg-alert-red text-white',       icon: <FiXCircle size={16} />,     description: 'El Business Case fue rechazado.' },
            no_factible:         { label: 'No factible',   bg: 'bg-red-50 border-red-200',     badge: 'bg-alert-red text-white',       icon: <FiXCircle size={16} />,     description: 'El Business Case fue rechazado.' },
            esperando_calculos:  { label: 'En evaluación', bg: 'bg-amber-50 border-amber-200', badge: 'bg-caution-amber text-white',   icon: <FiAlertCircle size={16} />, description: 'Se están revisando los cálculos de factibilidad.' },
          };

          const cfg = STAGE_CONFIG[bcStage] || {
            label: privateBcId ? 'En progreso' : 'Pendiente',
            description: privateBcId ? 'El Business Case aún no tiene resultado.' : 'Aún no hay Business Case vinculado.',
            bg: 'bg-slate-50 border-slate-200',
            badge: 'bg-slate-400 text-white',
            icon: <FiAlertCircle size={16} />,
          };

          return (
            <motion.div
              key="bc-section"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              className="bg-white rounded-xl border border-soft-border p-5 shadow-ambient"
            >
              <div className="flex items-center gap-2 mb-4">
                <FiBriefcase className="text-action-blue" size={18} />
                <h3 className="text-sm font-semibold text-ink-slate">Business Case</h3>
              </div>

              <div className={`mb-4 flex items-start gap-3 rounded-xl border p-4 ${cfg.bg}`}>
                <span className={`mt-0.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${cfg.badge}`}>
                  {cfg.icon}
                  {cfg.label}
                </span>
                <p className="text-xs text-slate-700 leading-relaxed">{cfg.description}</p>
              </div>

              <div className="bg-paper-white rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="text-xs font-medium text-ink-slate">Workspace de Business Case</div>
                  <div className="text-xs text-warm-ash mt-1">
                    {privateBcId ? `BC vinculado: ${privateBcId}` : 'Aún no hay Business Case vinculado.'}
                  </div>
                </div>
                {privateBcUrl && (
                  <a
                    href={privateBcUrl}
                    className="min-h-11 inline-flex items-center justify-center px-4 rounded-xl bg-action-blue text-white text-sm font-medium active:scale-[0.97] transition"
                  >
                    Abrir Business Case
                  </a>
                )}
              </div>
            </motion.div>
          );
        })()}

        {/* No requiere Business Case */}
        {isPurchasePrivate && !requiresBusinessCase && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="bg-green-soft rounded-xl border border-green-200 p-5"
          >
            <div className="flex items-center gap-2 mb-2">
              <FiCheckCircle className="text-operative-green" size={18} />
              <h3 className="text-sm font-semibold text-ink-slate">No requiere Business Case</h3>
            </div>
            <p className="text-sm text-warm-ash">
              Esta modalidad no requiere Business Case. Puedes continuar con disponibilidad.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default CommercialTab;
