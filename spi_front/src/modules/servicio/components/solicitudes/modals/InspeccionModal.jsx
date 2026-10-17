import React, { useState, useEffect, useRef, useCallback } from "react";
import { FiX, FiClipboard, FiUser, FiCheckCircle } from "react-icons/fi";
import { useUI } from "../../../../../core/ui/UIContext";
import Button from "../../../../../core/ui/components/Button";
import EquipmentSelect from "../../../../../core/ui/components/EquipmentSelect";
import { searchApprovedClients } from "../../../../../core/api/clientsApi";

const InspeccionModal = ({ open, onClose, onSuccess }) => {
  const { showToast } = useUI();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    cliente: "",
    registeredClientId: null,
    equipo_id: "",
    ubicacion: "",
    tipo: "preventiva",
    fecha_programada: "",
    observaciones: "",
  });

  const [clientQuery, setClientQuery] = useState("");
  const [clientSuggestions, setClientSuggestions] = useState([]);
  const [clientStatus, setClientStatus] = useState(null); // 'registered' | 'prospect' | null
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const debounceRef = useRef(null);
  const dropdownRef = useRef(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleClientInput = (e) => {
    const value = e.target.value;
    setClientQuery(value);
    setFormData((prev) => ({ ...prev, cliente: value, registeredClientId: null }));
    setClientStatus(null);

    clearTimeout(debounceRef.current);
    if (value.trim().length >= 2) {
      debounceRef.current = setTimeout(async () => {
        setSearchLoading(true);
        try {
          const results = await searchApprovedClients(value);
          setClientSuggestions(results.slice(0, 6));
          setShowDropdown(results.length > 0);
        } catch {
          setClientSuggestions([]);
        } finally {
          setSearchLoading(false);
        }
      }, 300);
    } else {
      setClientSuggestions([]);
      setShowDropdown(false);
    }
  };

  const handleSelectClient = useCallback((client) => {
    const name = client.commercial_name || client.name || "";
    setClientQuery(name);
    setFormData((prev) => ({ ...prev, cliente: name, registeredClientId: client.id }));
    setClientStatus("registered");
    setShowDropdown(false);
    setClientSuggestions([]);
  }, []);

  const handleClientBlur = () => {
    setTimeout(() => setShowDropdown(false), 150);
    if (clientQuery.trim() && clientStatus !== "registered") {
      setClientStatus("prospect");
    }
  };

  useEffect(() => {
    if (!open) {
      setClientQuery("");
      setClientSuggestions([]);
      setClientStatus(null);
      setShowDropdown(false);
    }
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      showToast("Inspección técnica programada exitosamente", "success");
      onSuccess?.();
      onClose();
      setFormData({
        cliente: "",
        registeredClientId: null,
        equipo_id: "",
        ubicacion: "",
        tipo: "preventiva",
        fecha_programada: "",
        observaciones: "",
      });
      setClientQuery("");
      setClientStatus(null);
    } catch {
      showToast("Error al programar la inspección", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <FiClipboard className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-xl font-bold">Programar Inspección Técnica</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Cliente</label>
            <div className="relative" ref={dropdownRef}>
              <input
                type="text"
                value={clientQuery}
                onChange={handleClientInput}
                onBlur={handleClientBlur}
                onFocus={() => clientSuggestions.length > 0 && setShowDropdown(true)}
                required
                autoComplete="off"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 dark:bg-gray-700 dark:border-gray-600"
                placeholder="Nombre del cliente o empresa"
              />

              {clientStatus === "registered" && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
                  <FiCheckCircle className="w-3 h-3" />
                  Cliente registrado
                </span>
              )}
              {clientStatus === "prospect" && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full">
                  <FiUser className="w-3 h-3" />
                  Posible cliente
                </span>
              )}

              {showDropdown && (
                <ul className="absolute z-10 left-0 right-0 mt-1 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {searchLoading ? (
                    <li className="px-4 py-2 text-sm text-gray-400">Buscando...</li>
                  ) : (
                    clientSuggestions.map((c) => (
                      <li
                        key={c.id}
                        onMouseDown={() => handleSelectClient(c)}
                        className="flex items-center gap-2 px-4 py-2 text-sm cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/20"
                      >
                        <FiCheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        <span>{c.commercial_name || c.name}</span>
                        {c.ruc_cedula && (
                          <span className="ml-auto text-xs text-gray-400">{c.ruc_cedula}</span>
                        )}
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Equipo</label>
              <EquipmentSelect
                name="equipo_id"
                value={formData.equipo_id}
                onChange={handleChange}
                placeholder="Selecciona el equipo a inspeccionar"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Ubicación</label>
              <input
                type="text"
                name="ubicacion"
                value={formData.ubicacion}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 dark:bg-gray-700 dark:border-gray-600"
                placeholder="Dirección o ubicación"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Tipo de Inspección</label>
              <select
                name="tipo"
                value={formData.tipo}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="preventiva">Preventiva</option>
                <option value="correctiva">Correctiva</option>
                <option value="diagnostico">Diagnóstico</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Fecha Programada</label>
              <input
                type="date"
                name="fecha_programada"
                value={formData.fecha_programada}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Observaciones</label>
            <textarea
              name="observaciones"
              value={formData.observaciones}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 dark:bg-gray-700 dark:border-gray-600"
              placeholder="Detalles adicionales..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? "Programando..." : "Programar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InspeccionModal;
