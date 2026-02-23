import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { FiDownload, FiCopy } from "react-icons/fi";
import api from "../../../../../core/api";
import { useUI } from "../../../../../core/ui/UIContext";
import { useAuth } from "../../../../../core/auth/AuthContext";
import { submitBusinessCaseFeasibilityDecision } from "../../../../../core/api/businessCaseApi";

const TYPE_MAP = {
  reactivo: "reactivo",
  determinacion: "prueba",
  control: "control",
  calibrador: "calibrador",
  consumible: "consumible",
  material: "consumible",
};

const normalizeType = (value) => TYPE_MAP[String(value || "").toLowerCase()] || null;

const getAnnualQty = (item) =>
  item?.annualQty ??
  item?.annual_quantity ??
  item?.annualQuantity ??
  item?.annual_qty ??
  0;

const getEquipmentName = (item) =>
  item?.equipmentName ||
  item?.equipment_name ||
  (item?.equipmentId ? `Equipo ${item.equipmentId}` : "Sin equipo");

const getPurchaseTypeLabel = (value) => {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("priv")) return "privada";
  if (normalized.includes("pub")) return "publica";
  return "n/a";
};

const buildRows = ({ items, investments, clientName, bcId, bcType }) => {
  const groups = {};
  (items || []).forEach((item) => {
    const normalizedType = normalizeType(item?.type);
    if (!normalizedType) return;
    const equipmentName = getEquipmentName(item);
    const equipmentId = item?.equipmentId || item?.equipment_id || "manual";
    const key = `${equipmentId}::${equipmentName}`;
    if (!groups[key]) {
      groups[key] = {
        equipmentName,
        reactivos: [],
        pruebas: [],
        controles: [],
        calibradores: [],
        consumibles: [],
      };
    }
    const entry = {
      name: item?.name || item?.itemName || "Sin nombre",
      annualQty: getAnnualQty(item),
    };
    if (normalizedType === "reactivo") groups[key].reactivos.push(entry);
    if (normalizedType === "prueba") groups[key].pruebas.push(entry);
    if (normalizedType === "control") groups[key].controles.push(entry);
    if (normalizedType === "calibrador") groups[key].calibradores.push(entry);
    if (normalizedType === "consumible") groups[key].consumibles.push(entry);
  });

  const rows = [];
  Object.values(groups).forEach((group) => {
    const maxLen = Math.max(
      group.reactivos.length,
      group.pruebas.length,
      group.controles.length,
      group.calibradores.length,
      group.consumibles.length,
      1,
    );
    for (let i = 0; i < maxLen; i += 1) {
      const reactivo = group.reactivos[i];
      const prueba = group.pruebas[i];
      const control = group.controles[i];
      const calibrador = group.calibradores[i];
      const consumible = group.consumibles[i];
      rows.push({
        Cliente: clientName,
        "BC ID": bcId,
        TIPO: bcType,
        Equipo: group.equipmentName,
        Reactivos: reactivo?.name || "",
        "Reactivo cantidad anual": reactivo?.annualQty ?? "",
        Pruebas: prueba?.name || "",
        "Prueba cantidad anual": prueba?.annualQty ?? "",
        Controles: control?.name || "",
        "Control cantidad anual": control?.annualQty ?? "",
        Calibradores: calibrador?.name || "",
        "Calibrador cantidad anual": calibrador?.annualQty ?? "",
        Consumibles: consumible?.name || "",
        "Consumible cantidad anual": consumible?.annualQty ?? "",
        "Inversiones adicionales": "",
        "Precio inversion": "",
      });
    }
  });

  const selectedInvestments = (investments || []).filter((inv) => inv?.selected);
  if (!rows.length && !selectedInvestments.length) {
    rows.push({
      Cliente: clientName,
      "BC ID": bcId,
      TIPO: bcType,
      Equipo: "",
      Reactivos: "",
      "Reactivo cantidad anual": "",
      Pruebas: "",
      "Prueba cantidad anual": "",
      Controles: "",
      "Control cantidad anual": "",
      Calibradores: "",
      "Calibrador cantidad anual": "",
      Consumibles: "",
      "Consumible cantidad anual": "",
      "Inversiones adicionales": "",
      "Precio inversion": "",
    });
  }

  selectedInvestments.forEach((inv) => {
    rows.push({
      Cliente: clientName,
      "BC ID": bcId,
      TIPO: bcType,
      Equipo: "",
      Reactivos: "",
      "Reactivo cantidad anual": "",
      Pruebas: "",
      "Prueba cantidad anual": "",
      Controles: "",
      "Control cantidad anual": "",
      Calibradores: "",
      "Calibrador cantidad anual": "",
      Consumibles: "",
      "Consumible cantidad anual": "",
      "Inversiones adicionales": inv?.name || inv?.item_name || "",
      "Precio inversion": inv?.unit_price ?? inv?.price ?? "",
    });
  });

  return rows;
};

const toCsv = (rows) => {
  const headers = [
    "Cliente",
    "BC ID",
    "TIPO",
    "Equipo",
    "Reactivos",
    "Reactivo cantidad anual",
    "Pruebas",
    "Prueba cantidad anual",
    "Controles",
    "Control cantidad anual",
    "Calibradores",
    "Calibrador cantidad anual",
    "Consumibles",
    "Consumible cantidad anual",
    "Inversiones adicionales",
    "Precio inversion",
  ];
  const escape = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };
  const lines = [headers.join(",")];
  rows.forEach((row) => {
    lines.push(headers.map((key) => escape(row[key])).join(","));
  });
  return `\uFEFF${lines.join("\n")}`;
};

const toTsv = (rows) => {
  const headers = [
    "Cliente",
    "BC ID",
    "TIPO",
    "Equipo",
    "Reactivos",
    "Reactivo cantidad anual",
    "Pruebas",
    "Prueba cantidad anual",
    "Controles",
    "Control cantidad anual",
    "Calibradores",
    "Calibrador cantidad anual",
    "Consumibles",
    "Consumible cantidad anual",
    "Inversiones adicionales",
    "Precio inversion",
  ];
  const escape = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return text.replace(/\t/g, " ").replace(/\n/g, " ");
  };
  const lines = [headers.join("\t")];
  rows.forEach((row) => {
    lines.push(headers.map((key) => escape(row[key])).join("\t"));
  });
  return lines.join("\n");
};

const ConsumptionExportSection = ({ businessCase }) => {
  const { id: bcId } = useParams();
  const { showToast } = useUI();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionForm, setDecisionForm] = useState({
    notes: "",
    fallback_offer_kind: "venta",
  });
  const [hasExportForCalculations, setHasExportForCalculations] = useState(false);

  const clientName = businessCase?.client_name || businessCase?.clientName || "Cliente";
  const bcType = getPurchaseTypeLabel(
    businessCase?.bc_purchase_type || businessCase?.bcPurchaseType,
  );
  const feasibilityMetadata = businessCase?.modern_bc_metadata?.feasibility || {};
  const feasibilityStatus = feasibilityMetadata?.status || "sin_definir";
  const userRoles = Array.isArray(user?.roles)
    ? user.roles
    : [user?.role, user?.scope].filter(Boolean);
  const normalizedRoles = userRoles.map((role) => String(role || "").toLowerCase());
  const canDecideFeasibility = normalizedRoles.some((role) =>
    ["jefe_comercial", "gerencia", "gerencia_general"].includes(role),
  );

  useEffect(() => {
    const loadItems = async () => {
      if (!bcId) return;
      try {
        setLoading(true);
        setError(null);
        const res = await api.get(`/business-case/${bcId}/consumption-items`);
        const data = res?.data?.data || {};
        const loaded = Array.isArray(data.items) ? data.items : [];
        if (loaded.length) {
          setItems(loaded);
        } else {
          const fallback = businessCase?.modern_bc_metadata?.consumption_items || [];
          setItems(Array.isArray(fallback) ? fallback : []);
        }
        const invRes = await api.get(`/business-case/${bcId}/investments/catalog`);
        const invData = invRes?.data?.data || [];
        setInvestments(Array.isArray(invData) ? invData : []);
        const exportAt =
          businessCase?.modern_bc_metadata?.feasibility?.export_excel?.at ||
          businessCase?.modern_bc_metadata?.feasibility?.decision?.decided_at;
        setHasExportForCalculations(Boolean(exportAt));
        return;
      } catch (err) {
        const fallback = businessCase?.modern_bc_metadata?.consumption_items || [];
        setItems(Array.isArray(fallback) ? fallback : []);
        setInvestments([]);
        setError("No se pudieron cargar consumos, usando datos locales.");
      } finally {
        setLoading(false);
      }
    };

    loadItems();
  }, [bcId, businessCase?.modern_bc_metadata?.consumption_items]);

  const rows = useMemo(
    () => buildRows({ items, investments, clientName, bcId, bcType }),
    [items, investments, clientName, bcId, bcType],
  );

  const handleDownload = () => {
    const downloadBackendExcel = async () => {
      const res = await api.get(`/business-case/${bcId}/export/excel`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `business-case-${bcId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    };

    const downloadCsvFallback = () => {
      if (!rows.length) {
        showToast("No hay datos para exportar", "warning");
        return;
      }
      const csv = toCsv(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `bc_${bcId}_reactivos.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    };

    downloadBackendExcel()
      .then(() => {
        setHasExportForCalculations(true);
        showToast("Excel exportado. Estado actualizado a esperando calculos", "success");
      })
      .catch(() => {
        downloadCsvFallback();
        showToast("Exportacion local generada. Verifique integracion de Excel backend", "warning");
      });
  };

  const handleCopy = async () => {
    if (!rows.length) {
      showToast("No hay datos para copiar", "warning");
      return;
    }
    const tsv = toTsv(rows);
    try {
      await navigator.clipboard.writeText(tsv);
      showToast("Datos copiados para Sheets", "success");
    } catch (err) {
      showToast("No se pudo copiar al portapapeles", "error");
    }
  };

  const handleSubmitDecision = async (isFeasible) => {
    if (!bcId) return;
    if (!hasExportForCalculations && !feasibilityMetadata?.export_excel?.at) {
      showToast("Primero exporte el Excel para habilitar la decision de factibilidad", "warning");
      return;
    }

    try {
      setDecisionLoading(true);
      const payload = {
        is_feasible: Boolean(isFeasible),
        notes: decisionForm.notes || "",
      };
      if (!isFeasible) {
        payload.fallback_offer_kind = decisionForm.fallback_offer_kind;
      }
      await submitBusinessCaseFeasibilityDecision(bcId, payload);
      showToast(
        isFeasible
          ? "Factibilidad aprobada y flujo actualizado"
          : "Business Case cerrado como no factible y flujo alterno activado",
        "success",
      );
    } catch (err) {
      showToast(err?.response?.data?.message || "No se pudo guardar la decision de factibilidad", "error");
    } finally {
      setDecisionLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <span className="text-2xl"></span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">Exportacion de Reactivos</h2>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                Temporal
              </span>
            </div>
            <p className="text-sm text-gray-500">
              Exporta consumos para el calculo manual de factibilidad en Excel o Google Sheets
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-full font-semibold hover:bg-gray-50 transition-all"
          >
            <FiCopy size={16} />
            Copiar para Sheets
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-full font-semibold hover:bg-emerald-700 transition-all shadow-sm"
          >
            <FiDownload size={16} />
            Descargar Excel (CSV)
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-amber-800 text-sm">
          {error}
        </div>
      )}

      {canDecideFeasibility && (
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-gray-900">Decision de factibilidad (Jefe Comercial)</h3>
            <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
              Estado actual: {String(feasibilityStatus).replace(/_/g, " ")}
            </span>
          </div>

          <div className="text-xs text-gray-600">
            {hasExportForCalculations || feasibilityMetadata?.export_excel?.at
              ? "Exportacion registrada. Puede decidir factibilidad."
              : "Debe exportar Excel primero para pasar a esperando calculos."}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas de evaluación</label>
            <textarea
              rows={3}
              value={decisionForm.notes}
              onChange={(e) => setDecisionForm((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="Resumen de cálculos, cantidades y precios evaluados"
              disabled={decisionLoading}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-gray-700">Si no es factible, continuar como:</label>
            <select
              value={decisionForm.fallback_offer_kind}
              onChange={(e) =>
                setDecisionForm((prev) => ({ ...prev, fallback_offer_kind: e.target.value }))
              }
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
              disabled={decisionLoading}
            >
              <option value="venta">Venta directa</option>
              <option value="alquiler">Alquiler</option>
              <option value="alquiler_transferencia_dominio">Alquiler con transferencia de dominio</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleSubmitDecision(true)}
              disabled={decisionLoading}
              className="px-4 py-2 rounded-full bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60"
            >
              Marcar Factible
            </button>
            <button
              type="button"
              onClick={() => handleSubmitDecision(false)}
              disabled={decisionLoading}
              className="px-4 py-2 rounded-full bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-60"
            >
              Marcar No Factible
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm text-center text-gray-500">
          No hay consumos registrados para exportar.
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Vista previa</h3>
            <span className="text-xs font-medium px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full">
              {rows.length} filas
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500">
                  <th className="text-left py-2 px-3">Cliente</th>
                  <th className="text-left py-2 px-3">BC ID</th>
                  <th className="text-left py-2 px-3">Tipo</th>
                  <th className="text-left py-2 px-3">Equipo</th>
                  <th className="text-left py-2 px-3">Reactivos</th>
                  <th className="text-left py-2 px-3">Cantidad anual</th>
                  <th className="text-left py-2 px-3">Pruebas</th>
                  <th className="text-left py-2 px-3">Cantidad anual</th>
                  <th className="text-left py-2 px-3">Controles</th>
                  <th className="text-left py-2 px-3">Cantidad anual</th>
                  <th className="text-left py-2 px-3">Calibradores</th>
                  <th className="text-left py-2 px-3">Cantidad anual</th>
                  <th className="text-left py-2 px-3">Consumibles</th>
                  <th className="text-left py-2 px-3">Cantidad anual</th>
                  <th className="text-left py-2 px-3">Inversiones</th>
                  <th className="text-left py-2 px-3">Precio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.slice(0, 12).map((row, idx) => (
                  <tr key={idx} className="text-gray-700">
                    <td className="py-2 px-3">{row["Cliente"]}</td>
                    <td className="py-2 px-3">{row["BC ID"]}</td>
                    <td className="py-2 px-3 capitalize">{row["TIPO"]}</td>
                    <td className="py-2 px-3">{row["Equipo"]}</td>
                    <td className="py-2 px-3">{row["Reactivos"]}</td>
                    <td className="py-2 px-3">{row["Reactivo cantidad anual"]}</td>
                    <td className="py-2 px-3">{row["Pruebas"]}</td>
                    <td className="py-2 px-3">{row["Prueba cantidad anual"]}</td>
                    <td className="py-2 px-3">{row["Controles"]}</td>
                    <td className="py-2 px-3">{row["Control cantidad anual"]}</td>
                    <td className="py-2 px-3">{row["Calibradores"]}</td>
                    <td className="py-2 px-3">{row["Calibrador cantidad anual"]}</td>
                    <td className="py-2 px-3">{row["Consumibles"]}</td>
                    <td className="py-2 px-3">{row["Consumible cantidad anual"]}</td>
                    <td className="py-2 px-3">{row["Inversiones adicionales"]}</td>
                    <td className="py-2 px-3">{row["Precio inversion"]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 12 && (
            <p className="text-xs text-gray-500 mt-3">
              Mostrando 12 de {rows.length} filas. Usa exportacion para ver todo.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ConsumptionExportSection;
