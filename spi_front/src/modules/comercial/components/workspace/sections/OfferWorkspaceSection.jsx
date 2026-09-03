import React, { useCallback, useEffect, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiDatabase,
  FiExternalLink,
  FiFileText,
  FiRefreshCw,
  FiRotateCcw,
  FiSend,
  FiThumbsDown,
  FiThumbsUp,
} from "react-icons/fi";
import {
  createBusinessCaseOfferDraft,
  decideBusinessCaseOfferVersion,
  getBusinessCaseOfferWorkspace,
  publishBusinessCaseOfferVersion,
  regenerateBusinessCaseOfferVersion,
  syncBusinessCaseOfferPricing,
  syncBusinessCaseConsumptionFromSheet,
} from "../../../../../core/api/businessCaseApi";
import { useUI } from "../../../../../core/ui/UIContext";

const STATUS_META = {
  draft: {
    label: "Borrador",
    tone: "bg-slate-100 text-slate-700",
    icon: FiClock,
  },
  sent: {
    label: "Enviada",
    tone: "bg-blue-100 text-blue-700",
    icon: FiSend,
  },
  accepted: {
    label: "Aceptada",
    tone: "bg-emerald-100 text-emerald-700",
    icon: FiCheckCircle,
  },
  rejected: {
    label: "Rechazada",
    tone: "bg-rose-100 text-rose-700",
    icon: FiThumbsDown,
  },
};

function formatDate(value) {
  if (!value) return "No disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No disponible";
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function StatusBadge({ status }) {
  const meta = STATUS_META[String(status || "").toLowerCase()] || STATUS_META.draft;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${meta.tone}`}>
      <Icon size={13} />
      {meta.label}
    </span>
  );
}

export default function OfferWorkspaceSection({ businessCase, permissions, ownership, onSave }) {
  const businessCaseId = businessCase?.id;
  const { showToast } = useUI();
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [decisionReason, setDecisionReason] = useState("");

  const loadWorkspace = useCallback(async () => {
    if (!businessCaseId) return;
    setLoading(true);
    try {
      const data = await getBusinessCaseOfferWorkspace(businessCaseId);
      setWorkspace(data);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo cargar la oferta", "error");
    } finally {
      setLoading(false);
    }
  }, [businessCaseId, showToast]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const latestOffer = workspace?.latest_offer || null;
  const offerGroups = Array.isArray(workspace?.offer_groups) && workspace.offer_groups.length
    ? workspace.offer_groups
    : [];
  const isMultiEquipmentOffer = workspace?.is_multi_equipment_offer === true && offerGroups.length > 1;
  const generatedOfferGroupsCount = offerGroups.filter((group) => group.latest_offer).length;
  const linkedPrivatePurchase = workspace?.linked_private_purchase || null;
  const linkedPublicPurchase = workspace?.linked_public_purchase || null;
  const linkedPurchase = linkedPrivatePurchase || linkedPublicPurchase;
  const linkedPurchaseLabel = linkedPrivatePurchase ? "privado" : "público";
  const canManage = permissions?.canManageOfferWorkspace === true;
  const canDecide = permissions?.canDecideOfferWorkspace === true;
  const canView = permissions?.canViewOfferWorkspace === true;
  const isFeasible = workspace?.is_feasible === true;

  const handleCreateDraft = async () => {
    setBusyAction("create");
    try {
      const result = await createBusinessCaseOfferDraft(businessCaseId);
      const createdCount = Array.isArray(result?.created) ? result.created.length : 1;
      showToast(
        createdCount > 1
          ? `Se crearon ${createdCount} hojas de oferta, una por equipo`
          : "Se creo una nueva hoja de oferta",
        "success",
      );
      await loadWorkspace();
      onSave?.({ markComplete: false });
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo crear la oferta", "error");
    } finally {
      setBusyAction("");
    }
  };

  const handleSyncConsumption = async () => {
    setBusyAction("sync");
    try {
      const result = await syncBusinessCaseConsumptionFromSheet(businessCaseId);
      const created = Number(result?.created || 0);
      const updated = Number(result?.updated || 0);
      showToast(
        created || updated
          ? `Consumos sincronizados: ${created} creados, ${updated} actualizados`
          : "Los consumos ya estaban al día",
        "success",
      );
      await loadWorkspace();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo sincronizar los consumos", "error");
    } finally {
      setBusyAction("");
    }
  };

  const handleRegenerate = async (offer = latestOffer) => {
    if (!offer?.id) return;
    setBusyAction(`regenerate:${offer.id}`);
    try {
      await regenerateBusinessCaseOfferVersion(businessCaseId, offer.id);
      showToast("La oferta fue regenerada con los consumos y el layout actuales", "success");
      await loadWorkspace();
      onSave?.({ markComplete: false });
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo regenerar la oferta", "error");
    } finally {
      setBusyAction("");
    }
  };

  const handleSyncPricing = async (offer = latestOffer) => {
    if (!offer?.id) return;
    setBusyAction(`sync-pricing:${offer.id}`);
    try {
      await syncBusinessCaseOfferPricing(businessCaseId, offer.id);
      showToast("Precios y plazo sincronizados. El PDF actualizado ya está disponible.", "success");
      await loadWorkspace();
      onSave?.({ markComplete: false });
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudieron sincronizar los precios", "error");
    } finally {
      setBusyAction("");
    }
  };

  const handlePublish = async (offer = latestOffer) => {
    if (!offer?.id) return;
    setBusyAction(`publish:${offer.id}`);
    try {
      await publishBusinessCaseOfferVersion(businessCaseId, offer.id);
      showToast("La oferta fue publicada y su PDF quedó disponible", "success");
      await loadWorkspace();
      onSave?.({ markComplete: false });
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo publicar la oferta", "error");
    } finally {
      setBusyAction("");
    }
  };

  const handleDecision = async (decision, offer = latestOffer) => {
    if (!offer?.id) return;
    setBusyAction(`${decision}:${offer.id}`);
    try {
      await decideBusinessCaseOfferVersion(businessCaseId, offer.id, {
        decision,
        reason: decision === "rejected" ? decisionReason : "",
      });
      showToast(
        decision === "accepted" ? "La oferta fue aceptada" : "La oferta fue rechazada",
        "success",
      );
      if (decision === "rejected") setDecisionReason("");
      await loadWorkspace();
      onSave?.({ markComplete: false });
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo registrar la decisión", "error");
    } finally {
      setBusyAction("");
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <FiRefreshCw className="animate-spin" size={16} />
          Cargando workspace de oferta...
        </div>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3 text-sm text-slate-600">
          <FiAlertCircle className="mt-0.5 text-slate-400" size={16} />
          <p>Esta sección solo está disponible para el comercial creador del BC, ACP Comercial y Jefe Comercial.</p>
        </div>
      </div>
    );
  }

  if (!isFeasible) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <div className="flex items-start gap-3 text-sm text-amber-900">
          <FiAlertCircle className="mt-0.5" size={16} />
          <p>La oferta se habilita después de registrar una factibilidad positiva.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-lg font-semibold text-slate-900">Oferta comercial</h3>
              {isMultiEquipmentOffer ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                  {generatedOfferGroupsCount}/{offerGroups.length} ofertas por equipo generadas
                </span>
              ) : (
                latestOffer && <StatusBadge status={latestOffer.status} />
              )}
            </div>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              {isMultiEquipmentOffer
                ? "Este Business Case es una integración de varios equipos: cada equipo tiene su propia oferta independiente (hoja y PDF separados), nunca una sola combinada. Revisa el detalle de cada una más abajo."
                : "Esta hoja replica el layout oficial de oferta, carga los consumos reales del BC y deja los precios en blanco para que Comercial complete la propuesta final."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadWorkspace}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <FiRefreshCw size={15} />
              Actualizar
            </button>
            {linkedPurchase?.workspace_path && (
              <a
                href={linkedPurchase.workspace_path}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
              >
                <FiExternalLink size={15} />
                Abrir expediente {linkedPurchaseLabel}
              </a>
            )}
            {canManage && (
              <button
                type="button"
                onClick={handleSyncConsumption}
                disabled={busyAction !== ""}
                title="Trae del Sheet cualquier reactivo, calibrador, control o material del catálogo que aún no esté cargado, aunque no tenga cantidad."
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                <FiDatabase size={15} />
                Sincronizar consumos
              </button>
            )}
            {canManage && (
              <button
                type="button"
                onClick={handleCreateDraft}
                disabled={busyAction !== ""}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                <FiFileText size={15} />
                {latestOffer ? "Nueva versión" : "Crear oferta"}
              </button>
            )}
          </div>
        </div>
      </div>

      {linkedPurchase && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-900">Expediente privado sincronizado</p>
              <p className="text-xs text-emerald-800">
                Estado actual: <span className="font-mono">{linkedPurchase.status || "sin estado"}</span>
                {linkedPrivatePurchase?.offer_document_id ? " - la oferta ya esta visible en compras privadas" : ""}
              </p>
            </div>
            {linkedPurchase.workspace_path && (
              <a
                href={linkedPurchase.workspace_path}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                <FiExternalLink size={15} />
                Continuar en compras
              </a>
            )}
          </div>
        </div>
      )}

      {!latestOffer && !isMultiEquipmentOffer && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-600">Aún no existe una oferta generada para este Business Case.</p>
        </div>
      )}

      {isMultiEquipmentOffer && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Integración multi-equipo — {offerGroups.length} ofertas independientes
              </p>
              <h4 className="mt-1 text-base font-semibold text-slate-900">Ofertas separadas por equipo</h4>
              <p className="mt-1 text-sm text-slate-600">
                Cada equipo tiene su propia hoja editable y su propio PDF de oferta. No existe una oferta combinada
                para esta integración.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {generatedOfferGroupsCount}/{offerGroups.length} generadas
            </span>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {offerGroups.map((group) => {
              const offer = group.latest_offer || null;
              return (
                <div
                  key={group.offer_key || group.offer_label}
                  className={`rounded-2xl border p-4 ${
                    group.legacy ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {group.legacy ? "Versión anterior (combinada)" : "Equipo"}
                      </p>
                      <h5 className="mt-1 text-sm font-semibold text-slate-900">
                        {group.offer_label || group.target_equipment_name || "Equipo sin nombre"}
                      </h5>
                      {group.legacy ? (
                        <p className="mt-1 text-xs text-amber-700">
                          Oferta creada antes de separar por equipo. No se genera más contenido nuevo aquí.
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-slate-500">
                          {Number(group.item_count || 0)} consumos asociados
                        </p>
                      )}
                    </div>
                    {offer ? <StatusBadge status={offer.status} /> : (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                        Pendiente
                      </span>
                    )}
                  </div>

                  {offer ? (
                    <>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Version</p>
                          <p className="mt-1 text-sm font-semibold text-slate-700">V{offer.version_number}</p>
                        </div>
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Actualizada</p>
                          <p className="mt-1 text-sm font-semibold text-slate-700">{formatDate(offer.updated_at)}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {offer.sheet_url && (
                          <a
                            href={offer.sheet_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                          >
                            <FiExternalLink size={14} />
                            Hoja editable
                          </a>
                        )}
                        {offer.pdf_url && (
                          <a
                            href={offer.pdf_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                          >
                            <FiExternalLink size={14} />
                            PDF
                          </a>
                        )}
                        {canManage && ["draft", "rejected", "sent"].includes(offer.status) && (
                          <button
                            type="button"
                            onClick={() => handleSyncPricing(offer)}
                            disabled={busyAction !== ""}
                            title="Lee precios y plazo de esta hoja sin reconstruirla, y genera el PDF actualizado."
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                          >
                            <FiRefreshCw size={14} />
                            Sincronizar precios
                          </button>
                        )}
                        {canManage && ["draft", "rejected", "sent"].includes(offer.status) && (
                          <button
                            type="button"
                            onClick={() => handleRegenerate(offer)}
                            disabled={busyAction !== ""}
                            className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-60"
                          >
                            <FiRotateCcw size={14} />
                            Regenerar
                          </button>
                        )}
                        {canManage && offer.status !== "sent" && offer.status !== "accepted" && (
                          <button
                            type="button"
                            onClick={() => handlePublish(offer)}
                            disabled={busyAction !== ""}
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                          >
                            <FiSend size={14} />
                            Publicar
                          </button>
                        )}
                      </div>

                      {canDecide && offer.status === "sent" && (
                        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                          <textarea
                            value={decisionReason}
                            onChange={(event) => setDecisionReason(event.target.value)}
                            rows={3}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                            placeholder="Motivo si se rechaza esta oferta."
                          />
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleDecision("accepted", offer)}
                              disabled={busyAction !== ""}
                              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                            >
                              <FiThumbsUp size={14} />
                              Aceptar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDecision("rejected", offer)}
                              disabled={busyAction !== "" || !decisionReason.trim()}
                              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                            >
                              <FiThumbsDown size={14} />
                              Rechazar
                            </button>
                          </div>
                        </div>
                      )}

                      {offer.rejection_reason && (
                        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-500">Motivo de rechazo</p>
                          <p className="mt-1 text-sm text-rose-900">{offer.rejection_reason}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
                      Falta generar la hoja de oferta para este equipo.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {latestOffer && !isMultiEquipmentOffer && (
        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Versión activa
                  </p>
                  <h4 className="mt-1 text-lg font-semibold text-slate-900">Oferta V{latestOffer.version_number}</h4>
                </div>
                <StatusBadge status={latestOffer.status} />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Creada</p>
                  <p className="mt-2 text-sm font-medium text-slate-700">{formatDate(latestOffer.created_at)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Publicada</p>
                  <p className="mt-2 text-sm font-medium text-slate-700">{formatDate(latestOffer.sent_at)}</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {latestOffer.sheet_url && (
                  <a
                    href={latestOffer.sheet_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                  >
                    <FiExternalLink size={15} />
                    Abrir hoja editable
                  </a>
                )}
                {latestOffer.pdf_url && (
                  <a
                    href={latestOffer.pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    <FiExternalLink size={15} />
                    Abrir PDF
                  </a>
                )}
                {canManage && ["draft", "rejected", "sent"].includes(latestOffer.status) && (
                  <button
                    type="button"
                    onClick={() => handleSyncPricing()}
                    disabled={busyAction !== ""}
                    title="Lee precios y plazo de la hoja actual, sin reconstruirla, y genera el PDF actualizado."
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                  >
                    <FiRefreshCw size={15} />
                    Sincronizar precios y PDF
                  </button>
                )}
                {canManage && ["draft", "rejected", "sent"].includes(latestOffer.status) && (
                  <button
                    type="button"
                    onClick={() => handleRegenerate()}
                    disabled={busyAction !== ""}
                    title="Reconstruye la hoja y el PDF con los consumos y el layout actuales, conservando los precios ya cargados."
                    className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-60"
                  >
                    <FiRotateCcw size={15} />
                    Regenerar oferta
                  </button>
                )}
              </div>

              {canManage && latestOffer.status !== "sent" && latestOffer.status !== "accepted" && (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm leading-6 text-slate-600">
                    Después de cargar los precios en la hoja, publica la versión para generar el PDF visible al
                    comercial creador.
                  </p>
                  <button
                    type="button"
                    onClick={() => handlePublish()}
                    disabled={busyAction !== ""}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                  >
                    <FiSend size={15} />
                    Generar PDF y enviar oferta
                  </button>
                </div>
              )}

              {canDecide && latestOffer.status === "sent" && (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-700">Decisión del comercial creador</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleDecision("accepted")}
                      disabled={busyAction !== ""}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                    >
                      <FiThumbsUp size={15} />
                      Aceptar oferta
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDecision("rejected")}
                      disabled={busyAction !== "" || !decisionReason.trim()}
                      className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                    >
                      <FiThumbsDown size={15} />
                      Rechazar oferta
                    </button>
                  </div>
                  <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="offer-rejection-reason">
                    Motivo de rechazo
                  </label>
                  <textarea
                    id="offer-rejection-reason"
                    value={decisionReason}
                    onChange={(event) => setDecisionReason(event.target.value)}
                    rows={4}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                    placeholder="Describe con precisión qué debe corregirse en la siguiente oferta."
                  />
                </div>
              )}

              {latestOffer.rejection_reason && (
                <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Motivo de rechazo</p>
                  <p className="mt-2 text-sm leading-6 text-rose-900">{latestOffer.rejection_reason}</p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h4 className="text-base font-semibold text-slate-900">Historial de versiones</h4>
              <div className="mt-4 space-y-3">
                {(workspace?.history || []).map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">V{item.version_number}</p>
                        <StatusBadge status={item.status} />
                      </div>
                      <p className="mt-2 text-xs text-slate-500">Actualizada: {formatDate(item.updated_at)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.sheet_url && (
                        <a
                          href={item.sheet_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white"
                        >
                          Hoja
                        </a>
                      )}
                      {item.pdf_url && (
                        <a
                          href={item.pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white"
                        >
                          PDF
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Vista previa PDF</p>
                <h4 className="mt-1 text-base font-semibold text-slate-900">Documento visible para comercial</h4>
              </div>
              {ownership?.metadata?.latest_status ? <StatusBadge status={ownership.metadata.latest_status} /> : null}
            </div>

            {latestOffer.pdf_preview_url ? (
              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                <iframe
                  title="Vista previa de oferta comercial"
                  src={latestOffer.pdf_preview_url}
                  className="h-[720px] w-full bg-slate-50"
                />
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="text-sm text-slate-600">
                  El PDF aparecerá aquí una vez que la versión activa sea publicada desde la hoja editable.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
