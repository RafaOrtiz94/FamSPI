import React, { useEffect, useState } from "react";
import { FiCheck, FiCode, FiX } from "react-icons/fi";
import { useUI } from "../../../core/ui/UIContext";

const FormulaEditor = ({ open = true, onClose, title, onValidate, onSave, initialValue, hideChrome = false }) => {
  const { showToast, showLoader, hideLoader } = useUI();
  const [type, setType] = useState(initialValue?.type || "expression");
  const [formula, setFormula] = useState(initialValue?.formula || "");
  const [variables, setVariables] = useState(initialValue?.variables || "");
  const [previewResult, setPreviewResult] = useState(null);
  const [testPayload, setTestPayload] = useState("{}");

  useEffect(() => {
    if (initialValue) {
      setType(initialValue.type || "expression");
      setFormula(initialValue.formula || "");
      setVariables(initialValue.variables || "");
    }
  }, [initialValue]);

  const handleValidate = async () => {
    if (!onValidate) return;
    showLoader();
    try {
      const payload = { type, formula, variables };
      if (testPayload) {
        payload.sample = JSON.parse(testPayload);
      }
      const res = await onValidate(payload);
      setPreviewResult(res.data || res.result || "Válida");
      showToast("Fórmula validada", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Error validando fórmula", "error");
    } finally {
      hideLoader();
    }
  };

  const handleSave = () => {
    if (onSave) onSave({ type, formula, variables });
    showToast("Fórmula guardada localmente", "success");
    if (onClose && !hideChrome) onClose();
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
          </select>
        </label>
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-sm text-gray-700">Variables disponibles</span>
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
          <FiCode /> Fórmula
        </span>
        <textarea
          rows={5}
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          className="border rounded-lg px-3 py-2 font-mono text-sm"
          placeholder="return sample.volume * 0.5;"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-gray-700">Payload de prueba (JSON)</span>
        <textarea
          rows={3}
          value={testPayload}
          onChange={(e) => setTestPayload(e.target.value)}
          className="border rounded-lg px-3 py-2 font-mono text-sm"
        />
      </label>

      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">Valida contra la API para asegurar consistencia con backend.</div>
        <div className="flex items-center gap-2">
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
