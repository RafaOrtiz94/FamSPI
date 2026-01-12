import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiRefreshCw, FiToggleRight, FiToggleLeft } from "react-icons/fi";
import { getTeamAvailability, updateAvailabilityStatus } from "../../../core/api/availabilityApi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import { useAuth } from "../../../core/auth/AuthContext";

const statusClass = (status) => {
  const value = (status || "").toString().toLowerCase();
  if (["disponible", "available", "on", true].includes(value)) return "bg-green-50 text-green-700 border-green-200";
  if (["ocupado", "busy"].includes(value)) return "bg-yellow-50 text-yellow-700 border-yellow-200";
  return "bg-red-50 text-red-700 border-red-200";
};

const statusLabel = (status) => {
  const value = (status || "").toString().toLowerCase();
  if (["disponible", "available", "on", true].includes(value)) return "Disponible";
  if (["ocupado", "busy"].includes(value)) return "Ocupado";
  return "No disponible";
};

const DisponibilidadTecnicos = () => {
  const { user } = useAuth();
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTeamAvailability();
      if (Array.isArray(data?.rows)) return setAvailability(data.rows);
      if (Array.isArray(data?.result?.rows)) return setAvailability(data.result.rows);
      if (Array.isArray(data)) return setAvailability(data);
      setAvailability([]);
    } catch (err) {
      console.warn("No se pudo cargar disponibilidad", err);
      setAvailability([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const myAvailability = useMemo(() => {
    if (!user) return null;
    return (
      availability.find(
        (a) => a.userId === user.id || a.user_id === user.id || a.name === user.fullname
      ) || null
    );
  }, [availability, user]);

  const toggleMine = async () => {
    if (!user) return;
    try {
      setSaving(true);
      const next = ["disponible", "available", "on", true].includes(
        (myAvailability?.status || "").toString().toLowerCase()
      )
        ? "no_disponible"
        : "disponible";
      await updateAvailabilityStatus(next);
      await refresh();
    } catch (err) {
      console.warn("No se pudo actualizar tu disponibilidad", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-gray-500">Panel de disponibilidad</p>
          <h1 className="text-2xl font-semibold text-gray-900">Estado de técnicos</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={FiRefreshCw} onClick={refresh} disabled={loading}>
            Actualizar
          </Button>
          {user && (
            <Button
              variant="primary"
              icon={myAvailability && ["disponible", "available", "on", true].includes(
                (myAvailability.status || "").toString().toLowerCase()
              )
                ? FiToggleLeft
                : FiToggleRight}
              onClick={toggleMine}
              disabled={saving}
            >
              {saving ? "Guardando..." : "Cambiar mi estado"}
            </Button>
          )}
        </div>
      </div>

      <Card className="p-5">
        {loading ? (
          <p className="text-sm text-gray-500">Cargando disponibilidad...</p>
        ) : availability.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {availability.map((member) => (
              <div
                key={member.id || member.userId || member.name}
                className={`p-4 rounded-lg border ${statusClass(member.status)} flex items-start justify-between gap-3`}
              >
                <div>
                  <p className="font-semibold">{member.name || member.fullname || "Técnico"}</p>
                  <p className="text-sm text-gray-500">
                    {member.updatedAt
                      ? `Actualizado ${new Date(member.updatedAt).toLocaleString()}`
                      : "Sin registro reciente"}
                  </p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide">
                  {statusLabel(member.status)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Sin técnicos registrados.</p>
        )}
      </Card>
    </div>
  );
};

export default DisponibilidadTecnicos;
