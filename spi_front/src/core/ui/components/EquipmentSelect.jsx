import React, { useEffect, useState } from "react";
import { getEquiposServicio } from "../../api/servicioApi";
import { FiLoader } from "react-icons/fi";

const EquipmentSelect = ({
  value,
  onChange,
  name = "equipo_id",
  required = false,
  placeholder = "Selecciona un equipo",
  className = "",
  disabled = false,
  filter = {},
}) => {
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const loadEquipos = async () => {
      setLoading(true);
      setError(null);
      try {
        // Usamos el endpoint de servicio/equipos que devuelve la lista completa de activos
        const data = await getEquiposServicio();

        if (isMounted) {
          let filteredData = Array.isArray(data) ? data : [];

          // Filtrado en cliente ya que el endpoint devuelve todo
          if (filter && Object.keys(filter).length > 0) {
            filteredData = filteredData.filter(item => {
              return Object.entries(filter).every(([key, val]) => {
                // Manejo especial para estado 'disponible' si el backend usa otros términos
                if (key === 'estado' && val === 'disponible') {
                  // Aceptamos disponible, operativo, bueno, etc. o si no tiene estado
                  const status = (item.estado || "").toLowerCase();
                  return status === 'disponible' || status === 'operativo' || status === 'bueno' || status === 'en uso' || status === "";
                }
                return String(item[key]).toLowerCase() === String(val).toLowerCase();
              });
            });
          }

          setEquipos(filteredData);
        }
      } catch (err) {
        console.error("Error loading equipos", err);
        if (isMounted) {
          setEquipos([]);
          setError("No se pudieron cargar los equipos");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadEquipos();
    return () => {
      isMounted = false;
    };
  }, [JSON.stringify(filter)]);

  return (
    <div className="relative">
      <select
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled || loading}
        className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${className}`}
      >
        <option value="">
          {loading ? "Cargando equipos..." : placeholder}
        </option>
        {equipos.map((equipo) => (
          <option
            key={equipo.id_equipo || equipo.id || equipo.inventory_id || equipo.item_id}
            value={equipo.id_equipo || equipo.id || equipo.inventory_id || equipo.item_id}
          >
            {equipo.nombre || equipo.item_name}
            {equipo.marca || equipo.fabricante ? ` - ${equipo.marca || equipo.fabricante}` : ""}
            {equipo.modelo ? ` ${equipo.modelo}` : ""}
            {equipo.estado ? ` (${equipo.estado})` : ""}
          </option>
        ))}
      </select>

      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
          <FiLoader className="animate-spin" size={16} />
        </div>
      )}

      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      {!loading && !error && equipos.length === 0 && (
        <p className="text-gray-500 text-xs mt-1">No hay equipos disponibles</p>
      )}
    </div>
  );
};

export default EquipmentSelect;
