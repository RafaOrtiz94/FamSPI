import React, { Fragment, useEffect, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import Button from "../../../core/ui/components/Button";

const inputClass =
 "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100";

const PreventiveOfferModal = ({
 open = false,
 onClose,
 item = null,
 onIssueOffer,
 onDecision,
 busy = false,
}) => {
 const [validUntil, setValidUntil] = useState("");
 const [notes, setNotes] = useState("");
 const [decision, setDecision] = useState("accepted");
 const [decisionReason, setDecisionReason] = useState("");

 useEffect(() => {
 if (!open) return;
 setValidUntil("");
 setNotes("");
 setDecision("accepted");
 setDecisionReason("");
 }, [open, item?.id]);

 return (
 <Transition.Root show={open} as={Fragment}>
 <Dialog as="div" className="relative z-50" onClose={() => (busy ? null : onClose?.())}>
 <Transition.Child
 as={Fragment}
 enter="ease-out duration-200"
 enterFrom="opacity-0"
 enterTo="opacity-100"
 leave="ease-in duration-150"
 leaveFrom="opacity-100"
 leaveTo="opacity-0"
 >
 <div className="fixed inset-0 bg-black/40" />
 </Transition.Child>

 <div className="fixed inset-0 overflow-y-auto">
 <div className="flex min-h-full items-center justify-center p-4">
 <Transition.Child
 as={Fragment}
 enter="ease-out duration-200"
 enterFrom="opacity-0 scale-95"
 enterTo="opacity-100 scale-100"
 leave="ease-in duration-150"
 leaveFrom="opacity-100 scale-100"
 leaveTo="opacity-0 scale-95"
 >
 <Dialog.Panel className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
 <Dialog.Title className="text-base font-semibold text-slate-900">
 Oferta preventiva Anexo 4
 </Dialog.Title>

 <p className="mt-1 text-xs text-slate-600">
 Equipo: <span className="font-semibold">{item?.equipment_name || `#${item?.equipment_id || "N/D"}`}</span>
 {" · "}
 Cliente: <span className="font-semibold">{item?.client_name || "N/D"}</span>
 </p>

 <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
 <label className="text-xs font-medium text-slate-600">
 Vigencia de oferta
 <input
 type="date"
 className={inputClass}
 value={validUntil}
 onChange={(event) => setValidUntil(event.target.value)}
 />
 </label>
 <label className="text-xs font-medium text-slate-600">
 Decisión del cliente
 <select
 className={inputClass}
 value={decision}
 onChange={(event) => setDecision(event.target.value)}
 >
 <option value="accepted">Aceptada</option>
 <option value="rejected">Rechazada</option>
 </select>
 </label>
 <label className="text-xs font-medium text-slate-600 md:col-span-2">
 Detalle de oferta (Anexo 4)
 <textarea
 className={inputClass}
 rows={3}
 value={notes}
 onChange={(event) => setNotes(event.target.value)}
 placeholder="Condiciones comerciales, cobertura, tiempos..."
 />
 </label>
 <label className="text-xs font-medium text-slate-600 md:col-span-2">
 Motivo decisión cliente
 <textarea
 className={inputClass}
 rows={2}
 value={decisionReason}
 onChange={(event) => setDecisionReason(event.target.value)}
 placeholder="Obligatorio cuando la oferta es rechazada"
 />
 </label>
 </div>

 <div className="mt-5 flex flex-wrap justify-end gap-2">
 <Button variant="secondary" onClick={() => onClose?.()} disabled={busy}>
 Cerrar
 </Button>
 <Button
 variant="outline"
 onClick={() =>
 onIssueOffer?.({
 valid_until: validUntil || null,
 offer_payload: { notes: notes || null },
 notes: notes || null,
 })
 }
 disabled={busy}
 >
 Emitir oferta
 </Button>
 <Button
 onClick={() =>
 onDecision?.({
 decision,
 reason: decisionReason || null,
 })
 }
 disabled={busy}
 >
 Registrar decisión
 </Button>
 </div>
 </Dialog.Panel>
 </Transition.Child>
 </div>
 </div>
 </Dialog>
 </Transition.Root>
 );
};

export default PreventiveOfferModal;
