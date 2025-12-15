import React, { useEffect, useState } from "react";
import { FiCheck, FiCode, FiDatabase, FiRefreshCw, FiX } from "react-icons/fi";
import api from "../../../core/api";
import { useUI } from "../../../core/ui/UIContext";

const defaultVariables = ["monthly_quantity", "equipment.capacity_per_hour", "equipment.max_daily_capacity", "sample.volume"];

const FormulaEditor = ({
  open = true,
  onClose,
  title,
  onValidate,
  onSave,
  initialValue,
  hideChrome = false,
  availableVariables = defaultVariables,
  enableTemplateLoader = true,
}) => {
  const { showToast, showLoader, hideLoader } = useUI();
  const [type, setType] = useState(initialValue?.type || "expression");
  const [formulaText, setFormulaText] = useState(
    typeof initialValue?.formula === "object"
      ? JSON.stringify(initialValue.formula, null, 2)
      : initialValue?.formula || ""
  );
  const [variables, setVariables] = useState(initialValue?.variables || availableVariables.join(", "));
  const [previewResult, setPreviewResult] = useState(null);
  const [testPayload, setTestPayload] = useState(JSON.stringify(initialValue?.exampleContext || {}, null, 2));
  const [templates, setTemplates] = useState([]);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  useEffect(() => {
    if (initialValue) {
      setType(initialValue.type || "expression");
      setFormulaText(
        typeof initialValue.formula === "object"
          ? JSON.stringify(initialValue.formula, null, 2)
          : initialValue.formula || ""
      );
      setVariables(initialValue.variables || availableVariables.join(", "));
      setTestPayload(JSON.stringify(initialValue.exampleContext || {}, null, 2));
    }
  }, [initialValue, availableVariables]);

  const parseJsonSafe = (value, fallback = null) => {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch (err) {
      showToast("JSON inválido en la fórmula o el payload de prueba", "error");
      return null;
    }
  };

  const handleValidate = async () => {
    if (!onValidate) return;
    const formula = parseJsonSafe(formulaText, formulaText);
    const sample = parseJsonSafe(testPayload, {});
    if (!formula) return;

    showLoader();
    try {
      const payload = { type, formula, variables, exampleContext: sample };
      const res = await onValidate(payload);
      setPreviewResult(res.data || res.result || res.validation || "Válida");
      showToast("Fórmula validada", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Error validando fórmula", "error");
    } finally {
      hideLoader();
    }
  };

  const handleSave = () => {
    const formula = parseJsonSafe(formulaText, formulaText);
    const sample = parseJsonSafe(testPayload, {});
    if (!formula) return;
    if (onSave) onSave({ type, formula, variables, exampleContext: sample });
    showToast("Fórmula guardada", "success");
    if (onClose && !hideChrome) onClose();
  };

  const handleClear = () => {
    setFormulaText("");
    setPreviewResult(null);
    setTestPayload("{}");
  };

  const handleLoadTemplates = async () => {
    if (!enableTemplateLoader) return;
    try {
      showLoader();
      const res = await api.get("/calculation-templates");
      setTemplates(res.data?.data || res.data || []);
      setTemplatePickerOpen(true);
    } catch (err) {
      showToast("No se pudieron cargar las plantillas", "error");
    } finally {
      hideLoader();
    }
  };

  const applyTemplate = (tpl) => {
    if (!tpl) return;
    setType(tpl.type || "expression");
    setFormulaText(JSON.stringify(tpl.formula || {}, null, 2));
    setTemplatePickerOpen(false);
    showToast("Template cargado", "success");
  };

  const content = (
    <div className="space-y-3">
      {!hideChrome && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{title || "Editor de fórmula"}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <FiX />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-700">Tipo</span>
          <select value={type} onChange={(e) => setType(e.target.value)} className="border rounded-lg px-3 py-2">
            <option value="expression">Expression</option>
            <option value="conditional">Conditional</option>
            <option value="pipeline">Pipeline</option>
            <option value="cost">Cost</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-sm text-gray-700">Variables disponibles</span>
          <div className="flex flex-wrap gap-2 mb-2">
            {availableVariables.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setFormulaText((prev) => `${prev}${prev ? "\n" : ""}${v}`)}
                className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs"
              >
                {v}
              </button>
            ))}
          </div>
          <input
            value={variables}
            onChange={(e) => setVariables(e.target.value)}
            placeholder="Ej: sample.volume, equipment.capacity"
            className="border rounded-lg px-3 py-2"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-gray-700 flex items-center gap-2">
          <FiCode /> Fórmula (JSON)
        </span>
        <textarea
          rows={6}
          value={formulaText}
          onChange={(e) => setFormulaText(e.target.value)}
          className="border rounded-lg px-3 py-2 font-mono text-sm"
          placeholder='{"expression": "return monthly_quantity * 1.2"}'
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-gray-700 flex items-center gap-2">
          <FiDatabase /> Payload de prueba (JSON)
        </span>
        <textarea
          rows={4}
          value={testPayload}
          onChange={(e) => setTestPayload(e.target.value)}
          className="border rounded-lg px-3 py-2 font-mono text-sm"
        />
      </label>

      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">Valida contra la API para asegurar consistencia con backend.</div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {enableTemplateLoader && (
            <button
              type="button"
              onClick={handleLoadTemplates}
              className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 inline-flex items-center gap-2"
            >
              <FiRefreshCw /> Cargar template
            </button>
          )}
          <button onClick={handleClear} className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700">
            Limpiar
          </button>
          <button onClick={handleValidate} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700">
            Validar
          </button>
          <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-blue-600 text-white inline-flex items-center gap-2">
            <FiCheck /> Guardar
          </button>
        </div>
      </div>

      {previewResult && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
          Resultado de validación: {typeof previewResult === "string" ? previewResult : JSON.stringify(previewResult)}
        </div>
      )}

      {templatePickerOpen && (
        <div className="border rounded-lg p-3 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-gray-800">Selecciona un template</p>
            <button onClick={() => setTemplatePickerOpen(false)} className="text-gray-500 hover:text-gray-700">
              <FiX />
            </button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="p-2 border rounded-lg hover:bg-gray-50 cursor-pointer"
                onClick={() => applyTemplate(tpl)}
              >
                <p className="font-medium text-gray-900">{tpl.name}</p>
                <p className="text-xs text-gray-600">{tpl.description || "Sin descripción"}</p>
              </div>
            ))}
            {!templates.length && <p className="text-sm text-gray-500">No hay plantillas disponibles.</p>}
          </div>
        </div>
      )}
    </div>
  );

  if (hideChrome) return content;
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-3xl p-6">{content}</div>
    </div>
  );
};

export default FormulaEditor;
