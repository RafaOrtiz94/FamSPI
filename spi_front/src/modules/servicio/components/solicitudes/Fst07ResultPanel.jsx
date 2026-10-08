import React, { useMemo, useState } from "react";
import { FiAlertCircle } from "react-icons/fi";
import Button from "../../../../core/ui/components/Button";

// Debe coincidir con FST07_CHECKLIST_ITEMS en
// backend/src/modules/servicio/siteInspectionRules.service.js
const FST07_CHECKLIST = [
  { key: "area_min_space", label: "Espacio requerido por el equipo", section: "Área", allowsNa: false },
  { key: "area_pressure_temperature", label: "Presión y temperatura adecuadas", section: "Área", allowsNa: false },
  { key: "area_humidity", label: "Humedad dentro del rango permitido", section: "Área", allowsNa: false },
  { key: "area_free_dust", label: "Área libre de polvo o contaminación", section: "Área", allowsNa: false },
  { key: "electrical_dedicated_outlets", label: "Tomas eléctricas dedicadas", section: "Eléctrico", allowsNa: false },
  { key: "electrical_polarized_outlets", label: "Tomas eléctricas polarizadas", section: "Eléctrico", allowsNa: false },
  { key: "electrical_breakers", label: "Breakers adecuados para la carga", section: "Eléctrico", allowsNa: false },
  { key: "electrical_power_capacity", label: "Conexión soporta la potencia del equipo", section: "Eléctrico", allowsNa: false },
  { key: "electrical_ups", label: "Toma protegida por UPS central", section: "Eléctrico", allowsNa: true },
  { key: "electrical_grounding", label: "Conexión a tierra menor a 1 V", section: "Eléctrico", allowsNa: false },
  { key: "water_intake", label: "Tomas de agua requeridas", section: "Agua", allowsNa: true },
  { key: "water_pressure", label: "Presión de agua adecuada", section: "Agua", allowsNa: true },
  { key: "water_drain", label: "Desagüe necesario", section: "Agua", allowsNa: true },
  { key: "water_quality", label: "Calidad de agua adecuada", section: "Agua", allowsNa: true },
  { key: "remote_network_points", label: "Puntos de red cercanos al equipo", section: "Conectividad", allowsNa: false },
  { key: "remote_internet", label: "Conexión a internet para acceso remoto", section: "Conectividad", allowsNa: false },
];

const defaultChecklist = () => FST07_CHECKLIST.reduce((acc, item) => ({ ...acc, [item.key]: "SI" }), {});

const answerClass = (active) =>
  `rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
    active ? "bg-slate-900 text-white" : "bg-white text-slate-500 border border-slate-300"
  }`;

const Fst07ResultPanel = ({ minDate, onSubmit, saving }) => {
  const [checklist, setChecklist] = useState(defaultChecklist);
  const [result, setResult] = useState("compliant");
  const [observations, setObservations] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [clientSignerName, setClientSignerName] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");

  const sections = useMemo(() => {
    const map = new Map();
    FST07_CHECKLIST.forEach((item) => {
      if (!map.has(item.section)) map.set(item.section, []);
      map.get(item.section).push(item);
    });
    return Array.from(map.entries());
  }, []);

  const setAnswer = (key, value) => setChecklist((prev) => ({ ...prev, [key]: value }));

  const canSubmit =
    clientSignerName.trim() && (result === "compliant" || (result === "non_compliant" && followUpDate));

  return (
    <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">Registrar resultado (F.ST-07)</p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setResult("compliant")}
          className={`flex-1 rounded-2xl border px-3 py-2 text-sm font-semibold ${
            result === "compliant" ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"
          }`}
        >
          Conforme
        </button>
        <button
          type="button"
          onClick={() => setResult("non_compliant")}
          className={`flex-1 rounded-2xl border px-3 py-2 text-sm font-semibold ${
            result === "non_compliant" ? "border-amber-400 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-500"
          }`}
        >
          No conforme
        </button>
      </div>

      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
        {sections.map(([section, items]) => (
          <div key={section}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{section}</p>
            <div className="mt-1 space-y-1.5">
              {items.map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-2 text-xs text-slate-600">
                  <span className="min-w-0 flex-1">{item.label}</span>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" className={answerClass(checklist[item.key] === "SI")} onClick={() => setAnswer(item.key, "SI")}>
                      SI
                    </button>
                    <button type="button" className={answerClass(checklist[item.key] === "NO")} onClick={() => setAnswer(item.key, "NO")}>
                      NO
                    </button>
                    {item.allowsNa ? (
                      <button type="button" className={answerClass(checklist[item.key] === "N/A")} onClick={() => setAnswer(item.key, "N/A")}>
                        N/A
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {result === "non_compliant" ? (
        <label className="block text-xs font-medium text-slate-600">
          Fecha de reinspección
          <input
            type="date"
            min={minDate || undefined}
            value={followUpDate}
            onChange={(event) => setFollowUpDate(event.target.value)}
            className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
          />
        </label>
      ) : null}

      <input
        value={clientSignerName}
        onChange={(event) => setClientSignerName(event.target.value)}
        placeholder="Nombre de quien firma por el cliente"
        className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
      />
      <textarea
        rows={2}
        value={observations}
        onChange={(event) => setObservations(event.target.value)}
        placeholder="Observaciones"
        className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
      />
      <textarea
        rows={2}
        value={recommendations}
        onChange={(event) => setRecommendations(event.target.value)}
        placeholder="Recomendaciones"
        className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
      />

      {!canSubmit ? (
        <p className="flex items-center gap-1.5 text-xs text-amber-700">
          <FiAlertCircle size={12} />
          Falta nombre de firma del cliente{result === "non_compliant" ? " y/o fecha de reinspección" : ""}.
        </p>
      ) : null}

      <Button
        onClick={() =>
          onSubmit({
            result,
            checklist,
            observations,
            recommendations,
            client_signer_name: clientSignerName,
            follow_up_date: result === "non_compliant" ? followUpDate : undefined,
          })
        }
        disabled={!canSubmit}
        loading={saving}
        className="w-full justify-center"
      >
        Registrar resultado
      </Button>
    </div>
  );
};

export default Fst07ResultPanel;
