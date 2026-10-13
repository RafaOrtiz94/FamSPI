// Alta y edición de lead. No se cierra al hacer clic fuera, para no perder lo escrito.
import { useState } from "react";
import Modal from "../../../core/ui/components/Modal";
import { createLead, updateLead } from "../../../core/api/crmFamApi";
import ECUADOR_LOCATIONS from "../../../data/ecuadorGeography";
import { Btn, ErrorNote, Field, SelectInput, TextArea, TextInput } from "../ui/kit";
import { errorMessage } from "../ui/format";
import { leadStatus } from "../ui/status";
import { useAdvisors } from "../ui/useLoad";

export const LEAD_SOURCES = [
  { value: "directo", label: "Directo" },
  { value: "referido", label: "Referido" },
  { value: "web", label: "Web" },
  { value: "redes_sociales", label: "Redes sociales" },
  { value: "feria", label: "Feria" },
  { value: "llamada_en_frio", label: "Llamada en frío" },
  { value: "otro", label: "Otro" },
];
export const leadSource = (value) => LEAD_SOURCES.find((s) => s.value === value)?.label || value || "—";
export const LEAD_PRIORITIES = [
  { value: "low", label: "Baja" }, { value: "medium", label: "Media" }, { value: "high", label: "Alta" }, { value: "urgent", label: "Urgente" },
];
export const leadPriority = (value) => LEAD_PRIORITIES.find((p) => p.value === value)?.label || value || "—";
const LEAD_STATUSES = ["new", "contacted", "qualified", "unqualified", "converted"];

const fold = (value) => String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
export const ECUADOR_CITIES = [...new Map(
  ECUADOR_LOCATIONS.map((l) => String(l?.canton || "").trim()).filter(Boolean).map((city) => [fold(city), city]),
).values()].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

const PHONE_CODES = [{ value: "+593", label: "Ecuador +593" }, { value: "+51", label: "Perú +51" }];
const splitPhone = (phone = "") => {
  const value = String(phone || "").trim();
  const code = PHONE_CODES.find((o) => value.startsWith(o.value))?.value || "+593";
  return { phone_code: code, phone_number: value.startsWith(code) ? value.slice(code.length).trim() : value };
};

export default function LeadFormModal({ lead, onClose, onSaved }) {
  const editing = Boolean(lead?.id);
  const advisors = useAdvisors();
  const [form, setForm] = useState(() => ({
    first_name: lead?.first_name || "",
    last_name: lead?.last_name || "",
    company_name: lead?.company_name || "",
    email: lead?.email || "",
    city: lead?.city || "",
    source: lead?.source || "",
    priority: lead?.priority || "medium",
    status: lead?.status || "new",
    owner_user_id: lead?.owner_user_id || "",
    description: lead?.interest_description || "",
    ...splitPhone(lead?.phone),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.first_name.trim()) { setError("Escribe el nombre del lead."); return; }
    setSaving(true); setError("");
    const number = form.phone_number.trim();
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim() || null,
      company_name: form.company_name.trim() || null,
      email: form.email.trim() || null,
      phone: number ? `${form.phone_code} ${number}` : null,
      source: form.source || null,
      priority: form.priority || "medium",
      status: form.status || "new",
      interest_description: form.description.trim() || null,
      city: form.city.trim() || null,
      ...(form.owner_user_id ? { owner_user_id: Number(form.owner_user_id) } : {}),
    };
    try {
      const saved = editing ? await updateLead(lead.id, payload) : await createLead(payload);
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err, "No se pudo guardar el lead. Revisa los datos e inténtalo de nuevo."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={editing ? "Editar lead" : "Nuevo lead"} onClose={onClose} maxWidth="max-w-2xl" disableClose={saving}>
      <form onSubmit={submit} noValidate>
        <ErrorNote message={error} className="mb-4" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre">{(p) => <TextInput {...p} value={form.first_name} onChange={set("first_name")} maxLength={100} autoFocus />}</Field>
          <Field label="Apellido" optional>{(p) => <TextInput {...p} value={form.last_name} onChange={set("last_name")} maxLength={100} />}</Field>
          <Field label="Empresa" optional>{(p) => <TextInput {...p} value={form.company_name} onChange={set("company_name")} maxLength={200} />}</Field>
          <Field label="Ciudad" optional>
            {(p) => (
              <>
                <TextInput {...p} value={form.city} onChange={set("city")} list="crm-lead-cities" autoComplete="off" placeholder="Escribe para buscar" />
                <datalist id="crm-lead-cities">{ECUADOR_CITIES.map((c) => <option key={c} value={c} />)}</datalist>
              </>
            )}
          </Field>
          <Field label="Correo" optional>{(p) => <TextInput {...p} type="email" value={form.email} onChange={set("email")} maxLength={255} placeholder="nombre@empresa.com" />}</Field>
          <Field label="Teléfono" optional>
            {(p) => (
              <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-2">
                <SelectInput aria-label="Código de país" value={form.phone_code} onChange={set("phone_code")}>
                  {PHONE_CODES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </SelectInput>
                <TextInput {...p} value={form.phone_number} onChange={set("phone_number")} inputMode="tel" autoComplete="tel-national" placeholder={form.phone_code === "+51" ? "999 999 999" : "99 000 0000"} />
              </div>
            )}
          </Field>
          <Field label="Asesor asignado" optional>
            {(p) => (
              <SelectInput {...p} value={form.owner_user_id || ""} onChange={set("owner_user_id")}>
                <option value="">Yo mismo</option>
                {advisors.map((u) => <option key={u.id} value={u.id}>{u.fullname || u.email}</option>)}
              </SelectInput>
            )}
          </Field>
          <Field label="Fuente" optional>
            {(p) => (
              <SelectInput {...p} value={form.source || ""} onChange={set("source")}>
                <option value="">Sin definir</option>
                {LEAD_SOURCES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </SelectInput>
            )}
          </Field>
          <Field label="Prioridad">
            {(p) => (
              <SelectInput {...p} value={form.priority} onChange={set("priority")}>
                {LEAD_PRIORITIES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </SelectInput>
            )}
          </Field>
          {editing && (
            <Field label="Estado">
              {(p) => (
                <SelectInput {...p} value={form.status} onChange={set("status")}>
                  {[...new Set([...LEAD_STATUSES, form.status])].map((s) => <option key={s} value={s}>{leadStatus(s).label}</option>)}
                </SelectInput>
              )}
            </Field>
          )}
          <div className="sm:col-span-2">
            <Field label="Interés o necesidad" optional>{(p) => <TextArea {...p} value={form.description} onChange={set("description")} placeholder="Qué busca el cliente, equipo de interés, plazo…" />}</Field>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Btn onClick={onClose} disabled={saving}>Cancelar</Btn>
          <Btn type="submit" variant="primary" loading={saving}>{saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear lead"}</Btn>
        </div>
      </form>
    </Modal>
  );
}
