import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiRefreshCw, FiToggleRight, FiToggleLeft } from "react-icons/fi";
import {
  getTeamAvailability,
  updateAvailabilityStatus,
  getTechnicalActivities,
  createTechnicalActivity,
} from "../../../core/api/availabilityApi";
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
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingActivity, setSavingActivity] = useState(false);
  const [activityForm, setActivityForm] = useState({
    activity_date: "",
    title: "",
    notes: "",
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date();
      const from = today.toISOString().slice(0, 10);
      const toDate = new Date(today);
      toDate.setDate(toDate.getDate() + 60);
      const to = toDate.toISOString().slice(0, 10);

      const [data, activityData] = await Promise.all([
        getTeamAvailability(),
        getTechnicalActivities({ from, to }),
      ]);
      if (Array.isArray(data?.rows)) setAvailability(data.rows);
      else if (Array.isArray(data?.result?.rows)) setAvailability(data.result.rows);
      else if (Array.isArray(data)) setAvailability(data);
      else setAvailability([]);
      setActivities(Array.isArray(activityData) ? activityData : []);
    } catch (err) {
      console.warn("No se pudo cargar disponibilidad", err);
      setAvailability([]);
      setActivities([]);
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

  const handleCreateActivity = async () => {
    if (!activityForm.activity_date || !activityForm.title.trim()) return;
    try {
      setSavingActivity(true);
      await createTechnicalActivity({
        activity_date: activityForm.activity_date,
        title: activityForm.title.trim(),
        notes: activityForm.notes.trim(),
      });
      setActivityForm({ activity_date: "", title: "", notes: "" });
      await refresh();
    } catch (err) {
      console.warn("No se pudo crear actividad técnica", err);
    } finally {
      setSavingActivity(false);
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

      <Card className="p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Cronograma de actividades técnicas</h2>
          <p className="text-sm text-gray-500">
            Registra actividades para bloquear fechas en coordinación de inspecciones.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="date"
            className="border rounded px-3 py-2 text-sm"
            value={activityForm.activity_date}
            onChange={(e) => setActivityForm((prev) => ({ ...prev, activity_date: e.target.value }))}
          />
          <input
            type="text"
            className="border rounded px-3 py-2 text-sm"
            placeholder="Título de actividad"
            value={activityForm.title}
            onChange={(e) => setActivityForm((prev) => ({ ...prev, title: e.target.value }))}
          />
          <input
            type="text"
            className="border rounded px-3 py-2 text-sm"
            placeholder="Notas (opcional)"
            value={activityForm.notes}
            onChange={(e) => setActivityForm((prev) => ({ ...prev, notes: e.target.value }))}
          />
        </div>
        <div>
          <Button onClick={handleCreateActivity} disabled={savingActivity || !activityForm.activity_date || !activityForm.title.trim()}>
            {savingActivity ? "Guardando..." : "Agregar actividad"}
          </Button>
        </div>

        <div className="space-y-2">
          {activities.length ? (
            activities.map((activity) => (
              <div
                key={activity.id}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm flex flex-col md:flex-row md:items-center md:justify-between gap-1"
              >
                <div>
                  <p className="font-medium text-gray-900">{activity.title}</p>
                  <p className="text-xs text-gray-500">
                    {activity.activity_date} · {activity.user_name || "Equipo técnico"}
                  </p>
                </div>
                <p className="text-xs text-gray-600">{activity.notes || "Sin notas"}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">No hay actividades registradas en los próximos 60 días.</p>
          )}
        </div>
      </Card>
    </div>
  );
};

export default DisponibilidadTecnicos;
