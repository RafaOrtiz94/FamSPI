import React, { useEffect, useMemo, useState } from "react";
import Modal from "../../../../core/ui/components/Modal";
import { useAuth } from "../../../../core/auth/useAuth";
import { fetchClients } from "../../../../core/api/clientsApi";
import SearchableSelect from "../../../../core/ui/components/SearchableSelect";

const INITIAL_FORM = {
  razon_social: "",
  ruc_id: "",
  telefono_contacto: "",
  correo_electronico: "",
  cupo_credito_sugerido: "",
  plazo_pago_acordado: "30",
  activos: "",
  pasivos: "",
  ingresos_negocio: "",
  egresos_negocio: "",
  ingresos_relacion_dependencia: "",
  gastos_familiares: "",
  otros_ingresos: "",
  prestamos_obligaciones: "",
  justificacion_otros_ingresos: "",
  banco_1: "",
  banco_2: "",
  cuenta_corriente_1: "",
  cuenta_corriente_2: "",
  cuenta_ahorros_1: "",
  cuenta_ahorros_2: "",
  proveedor_1: "",
  proveedor_2: "",
  contacto_proveedor_1: "",
  contacto_proveedor_2: "",
  telefono_proveedor_1: "",
  telefono_proveedor_2: "",
  ref_personal_nombre_1: "",
  ref_personal_nombre_2: "",
  ref_personal_parentesco_1: "",
  ref_personal_parentesco_2: "",
  ref_personal_telefono_1: "",
  ref_personal_telefono_2: "",
  nombre_responsable_cobros: "",
  direccion_fisica: "",
  ciudad: "",
  provincia: "",
  telefono_fijo: "",
  telefono_celular: "",
  ruc_ci_firmante: "",
};

const BANKS = ["BANCO PICHINCHA", "BANCO GUAYAQUIL", "BANCO DEL PACIFICO", "BANCO PRODUBANCO", "BANCO INTERNACIONAL", "COOPERATIVA JEP", "COOPERATIVA 29 DE OCTUBRE", "OTRO"];
const PROVINCES = ["AZUAY", "BOLIVAR", "CANAR", "CARCHI", "CHIMBORAZO", "COTOPAXI", "EL ORO", "ESMERALDAS", "GALAPAGOS", "GUAYAS", "IMBABURA", "LOJA", "LOS RIOS", "MANABI", "MORONA SANTIAGO", "NAPO", "ORELLANA", "PASTAZA", "PICHINCHA", "SANTA ELENA", "SANTO DOMINGO", "SUCUMBIOS", "TUNGURAHUA", "ZAMORA CHINCHIPE"];
const CITIES = ["AMBATO", "CUENCA", "GUAYAQUIL", "IBARRA", "LOJA", "MACHALA", "MANTA", "PORTOVIEJO", "QUITO", "RIOBAMBA", "SANTO DOMINGO"];
const RELATIONSHIPS = ["CONYUGE", "PADRE", "MADRE", "HIJO/A", "HERMANO/A", "SOCIO/A", "AMIGO/A", "OTRO"];
const PAYMENT_TERMS = ["15", "30", "45", "60", "90"];

const parseMoney = (value) => {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(String(value).replace(/\$/g, "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value) => Math.round(Number(value || 0) * 100) / 100;

const todayEc = () => new Date().toLocaleDateString("es-EC", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const Field = ({ label, name, value, onChange, type = "text", required = false, placeholder = "", list }) => (
  <label className="block min-w-0">
    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
      {label}{required ? " *" : ""}
    </span>
    <input
      type={type}
      value={value || ""}
      onChange={(event) => onChange(name, event.target.value)}
      placeholder={placeholder}
      required={required}
      list={list}
      className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
    />
  </label>
);

const SelectField = ({ label, name, value, onChange, options, required = false }) => (
  <label className="block min-w-0">
    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
      {label}{required ? " *" : ""}
    </span>
    <select
      value={value || ""}
      onChange={(event) => onChange(name, event.target.value)}
      required={required}
      className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
    >
      <option value="">Selecciona</option>
      {options.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  </label>
);

const DataList = ({ id, options }) => (
  <datalist id={id}>
    {options.map((option) => <option key={option} value={option} />)}
  </datalist>
);

const Section = ({ title, description, children }) => (
  <section className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
    <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">{title}</h3>
    {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
    <div className="mt-4 grid gap-3 md:grid-cols-2">{children}</div>
  </section>
);

const CreditRequestModal = ({ open, onClose, onSubmit }) => {
  const { user } = useAuth();
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState("");
  const [loadingClients, setLoadingClients] = useState(false);

  // GET /clients sin flags devuelve solo los clientes creados o asignados al
  // usuario actual (no todos) -- mismo scope que el resto del sistema.
  useEffect(() => {
    if (!open) return;
    setLoadingClients(true);
    fetchClients({})
      .then(({ clients: rows }) => setClients(Array.isArray(rows) ? rows : []))
      .catch(() => setClients([]))
      .finally(() => setLoadingClients(false));
  }, [open]);

  const clientOptions = useMemo(
    () => clients.map((client) => ({ value: String(client.id), label: client.nombre || `Cliente #${client.id}` })),
    [clients],
  );

  const handleSelectClient = (id) => {
    setClientId(id);
    const client = clients.find((c) => String(c.id) === String(id));
    if (!client) return;
    setForm((current) => ({
      ...current,
      razon_social: client.nombre || current.razon_social,
      ruc_id: client.identificador || current.ruc_id,
      telefono_contacto: client.shipping_phone || current.telefono_contacto,
      correo_electronico: client.client_email || current.correo_electronico,
      direccion_fisica: client.shipping_address || current.direccion_fisica,
      ciudad: client.shipping_city || current.ciudad,
      provincia: client.shipping_province || current.provincia,
    }));
  };

  const calculated = useMemo(() => {
    const patrimonio = money(parseMoney(form.activos) - parseMoney(form.pasivos));
    const totalIngresos = money(
      parseMoney(form.ingresos_negocio) +
      parseMoney(form.ingresos_relacion_dependencia) +
      parseMoney(form.otros_ingresos),
    );
    const totalEgresos = money(
      parseMoney(form.egresos_negocio) +
      parseMoney(form.gastos_familiares) +
      parseMoney(form.prestamos_obligaciones),
    );
    return {
      patrimonio,
      totalIngresos,
      totalEgresos,
      utilidad: money(totalIngresos - totalEgresos),
    };
  }, [form]);

  const update = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit?.({
        ...form,
        asesor_comercial: user?.fullname || user?.name || user?.email || "",
        fecha_solicitud: todayEc(),
        patrimonio: calculated.patrimonio,
        total_ingresos: calculated.totalIngresos,
        total_egresos: calculated.totalEgresos,
        utilidad_perdida_neta: calculated.utilidad,
      });
      setForm(INITIAL_FORM);
      setClientId("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Solicitud de credito" maxWidth="max-w-5xl">
      <form onSubmit={submit} className="space-y-4">
        <DataList id="credit-banks" options={BANKS} />
        <DataList id="credit-cities" options={CITIES} />

        <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-900">
            Completa la informacion del cliente. La validacion interna la realiza Jefe Financiero al aprobar o rechazar.
          </p>
          <p className="mt-1 text-xs text-blue-700">
            Asesor: {user?.fullname || user?.name || user?.email || "Usuario SPI"} · Fecha: {todayEc()}
          </p>
        </div>

        <Section title="Cliente y cupo solicitado">
          <label className="block min-w-0 md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Buscar cliente registrado
            </span>
            <div className="mt-1">
              <SearchableSelect
                options={clientOptions}
                value={clientId}
                onChange={handleSelectClient}
                placeholder={loadingClients ? "Cargando tus clientes..." : "Busca por nombre entre tus clientes asignados"}
              />
            </div>
            <span className="mt-1 block text-xs text-slate-400">
              Selecciona un cliente para autorrellenar sus datos, o completa los campos manualmente si aun no esta registrado.
            </span>
          </label>
          <Field label="Razon social / cliente" name="razon_social" value={form.razon_social} onChange={update} required />
          <Field label="RUC / ID" name="ruc_id" value={form.ruc_id} onChange={update} required />
          <Field label="Telefono contacto" name="telefono_contacto" value={form.telefono_contacto} onChange={update} required />
          <Field label="Correo electronico" name="correo_electronico" value={form.correo_electronico} onChange={update} type="email" required />
          <Field label="Cupo sugerido USD" name="cupo_credito_sugerido" value={form.cupo_credito_sugerido} onChange={update} type="number" required />
          <SelectField label="Plazo pago acordado (dias)" name="plazo_pago_acordado" value={form.plazo_pago_acordado} onChange={update} options={PAYMENT_TERMS} required />
        </Section>

        <Section title="Situacion financiera" description="Los totales se calculan automaticamente para reducir digitacion.">
          <Field label="Activos USD" name="activos" value={form.activos} onChange={update} type="number" />
          <Field label="Pasivos USD" name="pasivos" value={form.pasivos} onChange={update} type="number" />
          <Field label="Ingresos anuales negocio" name="ingresos_negocio" value={form.ingresos_negocio} onChange={update} type="number" />
          <Field label="Egresos anuales negocio" name="egresos_negocio" value={form.egresos_negocio} onChange={update} type="number" />
          <Field label="Ingresos relacion dependencia" name="ingresos_relacion_dependencia" value={form.ingresos_relacion_dependencia} onChange={update} type="number" />
          <Field label="Gastos familiares anuales" name="gastos_familiares" value={form.gastos_familiares} onChange={update} type="number" />
          <Field label="Otros ingresos" name="otros_ingresos" value={form.otros_ingresos} onChange={update} type="number" />
          <Field label="Prestamos / obligaciones" name="prestamos_obligaciones" value={form.prestamos_obligaciones} onChange={update} type="number" />
          <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-600 md:col-span-2 sm:grid-cols-4">
            <span>Patrimonio: <b>${calculated.patrimonio}</b></span>
            <span>Ingresos: <b>${calculated.totalIngresos}</b></span>
            <span>Egresos: <b>${calculated.totalEgresos}</b></span>
            <span>Utilidad: <b>${calculated.utilidad}</b></span>
          </div>
          <label className="block md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Justificacion otros ingresos</span>
            <textarea
              value={form.justificacion_otros_ingresos}
              onChange={(event) => update("justificacion_otros_ingresos", event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
            />
          </label>
        </Section>

        <Section title="Referencias bancarias y comerciales">
          <Field label="Banco 1" name="banco_1" value={form.banco_1} onChange={update} list="credit-banks" />
          <Field label="Banco 2" name="banco_2" value={form.banco_2} onChange={update} list="credit-banks" />
          <Field label="Cuenta corriente 1" name="cuenta_corriente_1" value={form.cuenta_corriente_1} onChange={update} />
          <Field label="Cuenta corriente 2" name="cuenta_corriente_2" value={form.cuenta_corriente_2} onChange={update} />
          <Field label="Cuenta ahorros 1" name="cuenta_ahorros_1" value={form.cuenta_ahorros_1} onChange={update} />
          <Field label="Cuenta ahorros 2" name="cuenta_ahorros_2" value={form.cuenta_ahorros_2} onChange={update} />
          <Field label="Proveedor 1" name="proveedor_1" value={form.proveedor_1} onChange={update} />
          <Field label="Proveedor 2" name="proveedor_2" value={form.proveedor_2} onChange={update} />
          <Field label="Contacto proveedor 1" name="contacto_proveedor_1" value={form.contacto_proveedor_1} onChange={update} />
          <Field label="Contacto proveedor 2" name="contacto_proveedor_2" value={form.contacto_proveedor_2} onChange={update} />
          <Field label="Telefono proveedor 1" name="telefono_proveedor_1" value={form.telefono_proveedor_1} onChange={update} />
          <Field label="Telefono proveedor 2" name="telefono_proveedor_2" value={form.telefono_proveedor_2} onChange={update} />
        </Section>

        <Section title="Referencias personales y domicilio">
          <Field label="Referencia personal 1" name="ref_personal_nombre_1" value={form.ref_personal_nombre_1} onChange={update} />
          <Field label="Referencia personal 2" name="ref_personal_nombre_2" value={form.ref_personal_nombre_2} onChange={update} />
          <SelectField label="Parentesco 1" name="ref_personal_parentesco_1" value={form.ref_personal_parentesco_1} onChange={update} options={RELATIONSHIPS} />
          <SelectField label="Parentesco 2" name="ref_personal_parentesco_2" value={form.ref_personal_parentesco_2} onChange={update} options={RELATIONSHIPS} />
          <Field label="Telefono referencia 1" name="ref_personal_telefono_1" value={form.ref_personal_telefono_1} onChange={update} />
          <Field label="Telefono referencia 2" name="ref_personal_telefono_2" value={form.ref_personal_telefono_2} onChange={update} />
          <Field label="Responsable cobros y pagos" name="nombre_responsable_cobros" value={form.nombre_responsable_cobros} onChange={update} />
          <Field label="Direccion fisica" name="direccion_fisica" value={form.direccion_fisica} onChange={update} required />
          <Field label="Ciudad" name="ciudad" value={form.ciudad} onChange={update} list="credit-cities" required />
          <SelectField label="Provincia" name="provincia" value={form.provincia} onChange={update} options={PROVINCES} required />
          <Field label="Telefono fijo" name="telefono_fijo" value={form.telefono_fijo} onChange={update} />
          <Field label="Telefono celular" name="telefono_celular" value={form.telefono_celular} onChange={update} required />
          <Field label="RUC / CI firmante" name="ruc_ci_firmante" value={form.ruc_ci_firmante} onChange={update} required />
        </Section>

        <div className="sticky bottom-0 -mx-6 -mb-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
          <p className="text-xs text-slate-500">Los campos marcados con * son obligatorios. Uso interno no lo llena el asesor.</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700">
              Cancelar
            </button>
            <button type="submit" disabled={submitting} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white disabled:opacity-60">
              {submitting ? "Enviando..." : "Generar solicitud"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default CreditRequestModal;
