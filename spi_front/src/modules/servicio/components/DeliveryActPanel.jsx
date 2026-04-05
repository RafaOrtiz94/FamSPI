import React from "react";

const buildDriveLink = (fileId) => (fileId ? `https://drive.google.com/file/d/${fileId}/view` : null);

const DeliveryActPanel = ({ purchase = {} }) => {
 const workflow = purchase?.installation_workflow || {};
 const deliveryAct = workflow?.delivery_act || {};

 const draftLink = purchase?.delivery_act_draft_document_id
 ? buildDriveLink(purchase.delivery_act_draft_document_id)
 : null;
 const logisticsSignedLink = purchase?.delivery_act_logistics_signed_document_id
 ? buildDriveLink(purchase.delivery_act_logistics_signed_document_id)
 : null;
 const finalLink = purchase?.delivery_act_document_id
 ? buildDriveLink(purchase.delivery_act_document_id)
 : deliveryAct?.final_link || null;
 const internalCopyLink =
 deliveryAct?.legal_internal_copy_link || buildDriveLink(deliveryAct?.legal_internal_copy_file_id);
 const clientCopyLink =
 deliveryAct?.legal_client_copy_link || buildDriveLink(deliveryAct?.legal_client_copy_file_id);

 return (
 <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
 <h4 className="font-semibold text-slate-900">F.ST-10 · Acta de entrega</h4>
 <div className="grid grid-cols-1 gap-2 text-xs text-slate-600">
 <p>Numero de acta: <span className="font-semibold text-slate-800">{purchase?.delivery_act_number || "Pendiente"}</span></p>
 <p>Despachado por: <span className="font-semibold text-slate-800">{purchase?.delivery_act_dispatched_by || "Pendiente"}</span></p>
 <p>Legalización: <span className="font-semibold text-slate-800">{deliveryAct?.legalized_at ? "Registrada" : "Pendiente"}</span></p>
 </div>
 <div className="flex flex-wrap gap-2 text-xs">
 {draftLink ? (
 <a href={draftLink} target="_blank" rel="noreferrer" className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">
 Borrador
 </a>
 ) : null}
 {logisticsSignedLink ? (
 <a href={logisticsSignedLink} target="_blank" rel="noreferrer" className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-indigo-700">
 Firmada logística
 </a>
 ) : null}
 {finalLink ? (
 <a href={finalLink} target="_blank" rel="noreferrer" className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
 Final
 </a>
 ) : null}
 {internalCopyLink ? (
 <a href={internalCopyLink} target="_blank" rel="noreferrer" className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
 Copia interna
 </a>
 ) : null}
 {clientCopyLink ? (
 <a href={clientCopyLink} target="_blank" rel="noreferrer" className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
 Copia cliente
 </a>
 ) : null}
 </div>
 </div>
 );
};

export default DeliveryActPanel;
