import React, { Fragment, useEffect, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import Button from "../../../core/ui/components/Button";

const inputClass =
 "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100";

const ReprogrammingNoticeModal = ({
 open = false,
 onClose,
 item = null,
 onSave,
 busy = false,
}) => {
 const [newDate, setNewDate] = useState("");
 const [reason, setReason] = useState("");

 useEffect(() => {
 if (!open) return;
 setNewDate("");
 setReason("");
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
 <Dialog.Panel className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl">
 <Dialog.Title className="text-base font-semibold text-slate-900">
 Reprogramación formal Anexo 5
 </Dialog.Title>

 <p className="mt-1 text-xs text-slate-600">
 Fecha actual planificada:{" "}
 <span className="font-semibold">{item?.planned_date || "N/D"}</span>
 </p>

 <div className="mt-4 grid grid-cols-1 gap-3">
 <label className="text-xs font-medium text-slate-600">
 Nueva fecha objetivo
 <input
 type="date"
 className={inputClass}
 value={newDate}
 onChange={(event) => setNewDate(event.target.value)}
 />
 </label>
 <label className="text-xs font-medium text-slate-600">
 Motivo de reprogramación
 <textarea
 className={inputClass}
 rows={4}
 value={reason}
 onChange={(event) => setReason(event.target.value)}
 placeholder="Razón, fecha comprometida anterior y comunicación con cliente."
 />
 </label>
 </div>

 <div className="mt-5 flex justify-end gap-2">
 <Button variant="secondary" onClick={() => onClose?.()} disabled={busy}>
 Cancelar
 </Button>
 <Button
 onClick={() =>
 onSave?.({
 new_planned_date: newDate || null,
 reason: reason || null,
 anexo5_payload: {
 original_planned_date: item?.planned_date || null,
 new_planned_date: newDate || null,
 reason: reason || null,
 },
 })
 }
 disabled={busy || !newDate || !reason.trim()}
 >
 Guardar Anexo 5
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

export default ReprogrammingNoticeModal;
