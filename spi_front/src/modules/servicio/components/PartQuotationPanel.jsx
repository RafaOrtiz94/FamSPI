import React, { useMemo, useState } from "react";
import { FiCheckCircle, FiDollarSign, FiPackage, FiPlusCircle, FiTruck, FiXCircle } from "react-icons/fi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";

const chipByStatus = (status) => {
 const value = String(status || "").toLowerCase();
 if (["approved", "installed", "not_required"].includes(value)) return "bg-emerald-100 text-emerald-700";
 if (["requested", "issued"].includes(value)) return "bg-amber-100 text-amber-700";
 if (["rejected", "cancelled"].includes(value)) return "bg-rose-100 text-rose-700";
 return "bg-slate-100 text-slate-700";
};

const labelWarranty = (value) => {
 const normalized = String(value || "").toLowerCase();
 if (normalized === "in_warranty") return "En garantía";
 if (normalized === "out_of_warranty") return "Fuera de garantía";
 return "Garantía no definida";
};

const emptyPartForm = {
 part_code: "",
 part_description: "",
 quantity: 1,
 warranty_status: "out_of_warranty",
 removed_part_requires_disinfection: false,
 notes: "",
};

const PartQuotationPanel = ({
 caseItem,
 busy = false,
 onAction,
 canRegisterParts = true,
 canRequestQuote = true,
 canIssueQuote = true,
 canDecideQuote = true,
 canMarkInstalled = true,
}) => {
 const [form, setForm] = useState(emptyPartForm);
 const spareParts = useMemo(() => caseItem?.spare_parts || [], [caseItem?.spare_parts]);

 const submitNewPart = async () => {
 if (!form.part_description.trim()) return;
 await onAction?.("register_spare_part_requirement", form);
 setForm(emptyPartForm);
 };

 const requestQuote = async (part) => {
 await onAction?.("request_commercial_quote", {
 spare_part_id: part.id,
 notes: `Solicitud de cotización para ${part.part_description}`,
 });
 };

 const issueQuote = async (part) => {
 const totalText = window.prompt("Monto total cotizado (USD)");
 if (!totalText) return;
 const total = Number(totalText);
 if (!Number.isFinite(total)) return;
 const reference = window.prompt("Referencia/código de cotización") || "";
 await onAction?.("issue_commercial_quote", {
 spare_part_id: part.id,
 total_price: total,
 pricing_currency: "USD",
 quotation_reference: reference,
 });
 };

 const decideQuote = async (part) => {
 const approved = window.confirm(
 `¿Cliente aprobó la cotización para "${part.part_description}"?\n\nAceptar = Aprobado\nCancelar = Rechazado`,
 );
 await onAction?.("record_client_quote_decision", {
 spare_part_id: part.id,
 decision: approved ? "approved" : "rejected",
 notes: approved ? "Cliente aprobó cotización" : "Cliente rechazó cotización",
 });
 };

 const markInstalled = async (part) => {
 const needsDisinfection = window.confirm(
 "¿La parte retirada requiere desinfección y trazabilidad F.ST-02?",
 );
 await onAction?.("record_part_replacement", {
 spare_part_id: part.id,
 removed_part_requires_disinfection: needsDisinfection,
 notes: needsDisinfection
 ? "Cambio con desinfección obligatoria"
 : "Cambio sin desinfección adicional",
 });
 };

 return (
 <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
 <div>
 <h4 className="text-sm font-semibold text-slate-900">Repuestos y cotizaciones</h4>
 <p className="text-xs text-slate-500">
 Flujo de garantía, cotización comercial, decisión cliente y reemplazo.
 </p>
 </div>

 {canRegisterParts ? (
 <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
 <p className="text-xs font-semibold text-slate-700">Registrar parte requerida</p>
 <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
 <input
 value={form.part_code}
 onChange={(event) => setForm((prev) => ({ ...prev, part_code: event.target.value }))}
 className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
 placeholder="Código de parte"
 />
 <input
 value={form.part_description}
 onChange={(event) => setForm((prev) => ({ ...prev, part_description: event.target.value }))}
 className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
 placeholder="Descripción de la parte"
 />
 <input
 type="number"
 min={1}
 value={form.quantity}
 onChange={(event) => setForm((prev) => ({ ...prev, quantity: Number(event.target.value || 1) }))}
 className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
 placeholder="Cantidad"
 />
 <select
 value={form.warranty_status}
 onChange={(event) => setForm((prev) => ({ ...prev, warranty_status: event.target.value }))}
 className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
 >
 <option value="in_warranty">En garantía</option>
 <option value="out_of_warranty">Fuera de garantía</option>
 <option value="unknown">No definido</option>
 </select>
 <textarea
 rows={2}
 value={form.notes}
 onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
 className="md:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-xs"
 placeholder="Notas técnicas del repuesto"
 />
 <label className="md:col-span-2 inline-flex items-center gap-2 text-xs text-slate-700">
 <input
 type="checkbox"
 checked={form.removed_part_requires_disinfection}
 onChange={(event) =>
 setForm((prev) => ({ ...prev, removed_part_requires_disinfection: event.target.checked }))
 }
 />
 Parte retirada requiere F.ST-02
 </label>
 </div>
 <div className="mt-2 flex justify-end">
 <Button
 size="sm"
 icon={FiPlusCircle}
 loading={busy}
 onClick={submitNewPart}
 >
 Agregar repuesto
 </Button>
 </div>
 </div>
 ) : null}

 {spareParts.length === 0 ? (
 <p className="mt-3 text-xs text-slate-500">Aún no hay repuestos registrados para este caso.</p>
 ) : (
 <div className="mt-3 space-y-2">
 {spareParts.map((part) => (
 <div key={part.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
 <div className="flex flex-wrap items-center justify-between gap-2">
 <p className="inline-flex items-center gap-2 text-xs font-semibold text-slate-900">
 <FiPackage size={14} />
 {part.part_description}
 </p>
 <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${chipByStatus(part.quotation_status)}`}>
 {part.quotation_status}
 </span>
 </div>
 <p className="mt-1 text-[11px] text-slate-600">
 Código: {part.part_code || "N/D"} · Cantidad: {part.quantity} · {labelWarranty(part.warranty_status)}
 </p>
 {part.total_price !== null ? (
 <p className="mt-1 text-[11px] text-slate-600">
 Cotización: {part.pricing_currency || "USD"} {part.total_price}
 </p>
 ) : null}

 <div className="mt-2 flex flex-wrap gap-2">
 {canRequestQuote && part.warranty_status === "out_of_warranty" && !["requested", "issued", "approved", "rejected"].includes(part.quotation_status) ? (
 <Button size="sm" variant="secondary" icon={FiDollarSign} loading={busy} onClick={() => requestQuote(part)}>
 Solicitar cotización
 </Button>
 ) : null}
 {canIssueQuote && ["requested"].includes(part.quotation_status) ? (
 <Button size="sm" variant="secondary" icon={FiDollarSign} loading={busy} onClick={() => issueQuote(part)}>
 Emitir cotización
 </Button>
 ) : null}
 {canDecideQuote && ["issued"].includes(part.quotation_status) ? (
 <Button size="sm" variant="secondary" icon={FiCheckCircle} loading={busy} onClick={() => decideQuote(part)}>
 Decisión cliente
 </Button>
 ) : null}
 {canMarkInstalled && ["approved", "ordered"].includes(part.quotation_status) ? (
 <Button size="sm" variant="secondary" icon={FiTruck} loading={busy} onClick={() => markInstalled(part)}>
 Registrar cambio
 </Button>
 ) : null}
 {part.quotation_status === "rejected" ? (
 <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-[11px] font-semibold text-rose-700">
 <FiXCircle size={12} />
 Sin cambio por rechazo cliente
 </span>
 ) : null}
 </div>
 </div>
 ))}
 </div>
 )}
 </Card>
 );
};

export default PartQuotationPanel;
