import React, { useState, useEffect } from "react";
import { advanceStage, updateStageData, getInternalUsers } from "../../../../../core/api/hiringPipelineApi";
import { useAuth } from "../../../../../core/auth/AuthContext";
import {
  SectionTitle, ActionBar, RejectBtn, AdvanceBtn,
  Textarea, Input, Select, DoneNotice, RejectedNotice,
} from "./_stageShared";
import { FiRefreshCw, FiSend, FiUser, FiClock, FiCalendar, FiInfo } from "react-icons/fi";

const STAGE_KEY = "prueba_habilidades";

export default function StageTechnicalTest({ entry, stageResult, isCompleted, isRejected, saving, onUpdate, onReject, onReactivate }) {
  const { user } = useAuth();
  const existing = stageResult?.data || {};
  const [form, setForm] = useState({ ...existing });
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  function merge(patch) {
    setForm(prev => ({ ...prev, ...patch }));
  }

  useEffect(() => {
    setLoadingUsers(true);
    getInternalUsers()
      .then(res => setUsers(res?.data || []))
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, []);

  const isAssigned = Boolean(form.assigned_to_id && form.available_from && form.available_to && form.phase === "assigned");
  const isDateConfirmed = Boolean(form.selected_datetime && form.phase === "confirmed");
  // Paso 1 queda bloqueado en cuanto se asigna O se confirma la fecha
  const isStep1Locked = isAssigned || isDateConfirmed;

  // Solo el responsable asignado puede confirmar la fecha
  const isAssignedUser = Boolean(user?.id && String(user.id) === String(form.assigned_to_id));

  async function handleAssign() {
    const selectedUser = users.find(u => String(u.id) === String(form.assigned_to_id));
    const patch = {
      ...form,
      phase: "assigned",
      assigned_to_name: selectedUser?.fullname || "",
      assigned_to_email: selectedUser?.email || "",
    };
    await onUpdate(() =>
      updateStageData(entry.id, STAGE_KEY, patch, { notify_assignment: true })
    );
    merge({ phase: "assigned", assigned_to_name: selectedUser?.fullname || "", assigned_to_email: selectedUser?.email || "" });
  }

  async function handleConfirmDate() {
    if (!isAssignedUser) return;
    const patch = { ...form, phase: "confirmed" };
    await onUpdate(() =>
      updateStageData(entry.id, STAGE_KEY, patch, { notify_confirmation: true })
    );
    merge({ phase: "confirmed" });
  }

  async function handleAdvance() {
    if (!form.score || !form.result_observations?.trim()) return;
    await onUpdate(() =>
      advanceStage(entry.id, STAGE_KEY, {
        data: form,
        observations: form.result_observations,
        score: parseFloat(form.score),
      })
    );
  }

  return (
    <div className="flex flex-col">
      {isCompleted && <DoneNotice label="Prueba de habilidades completada." />}
      {isRejected && <RejectedNotice onReactivate={() => onReactivate("Reactivación desde prueba de habilidades")} saving={saving} />}

      {!isCompleted && !isRejected && (
        <>
          <div className="space-y-5 p-5">

            {/* ── Paso 1: Asignar responsable ── */}
            <div>
              <SectionTitle>1. Asignar responsable de la prueba</SectionTitle>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#6B7280]">Responsable</label>
                  <Select
                    value={form.assigned_to_id || ""}
                    onChange={e => merge({ assigned_to_id: e.target.value })}
                    disabled={isStep1Locked || loadingUsers}
                  >
                    <option value="">Selecciona un colaborador</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.fullname} — {u.email}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#6B7280]">Disponible desde</label>
                  <Input
                    type="datetime-local"
                    value={form.available_from || ""}
                    onChange={e => merge({ available_from: e.target.value })}
                    disabled={isStep1Locked}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#6B7280]">Disponible hasta</label>
                  <Input
                    type="datetime-local"
                    value={form.available_to || ""}
                    onChange={e => merge({ available_to: e.target.value })}
                    disabled={isStep1Locked}
                  />
                </div>
              </div>

              {!isStep1Locked && (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleAssign}
                    disabled={saving || !form.assigned_to_id || !form.available_from || !form.available_to}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 cursor-pointer transition hover:bg-[#1D4ED8]"
                  >
                    {saving ? <FiRefreshCw size={13} className="animate-spin" /> : <FiSend size={13} />}
                    Asignar y notificar
                  </button>
                </div>
              )}

              {isStep1Locked && (
                <div className="mt-2 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-2.5 flex items-center gap-2 text-xs text-[#16A34A] font-medium">
                  <FiUser size={13} />
                  Asignado a <span className="font-bold">{form.assigned_to_name}</span>
                  {form.available_from && form.available_to && (
                    <span className="ml-auto font-normal text-[#059669]">
                      {new Date(form.available_from).toLocaleDateString("es-EC")} — {new Date(form.available_to).toLocaleDateString("es-EC")}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* ── Paso 2: Confirmar fecha — solo para el responsable asignado ── */}
            {isAssigned && (
              <div>
                <SectionTitle>2. Confirmar fecha y hora de la prueba</SectionTitle>

                {isAssignedUser ? (
                  /* Vista del responsable asignado — puede confirmar */
                  <>
                    <div className="mb-3 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 flex items-start gap-2">
                      <FiInfo size={14} className="mt-0.5 shrink-0 text-[#2563EB]" />
                      <p className="text-xs text-[#1D4ED8]">
                        Eres el responsable de esta prueba. Elige la fecha y hora dentro del rango indicado y confirma para notificar al postulante y a Talento Humano.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-[#6B7280]">
                          Fecha y hora seleccionada
                          <span className="ml-1 font-normal text-[#9CA3AF]">
                            (entre {new Date(form.available_from).toLocaleDateString("es-EC")} y {new Date(form.available_to).toLocaleDateString("es-EC")})
                          </span>
                        </label>
                        <Input
                          type="datetime-local"
                          value={form.selected_datetime || ""}
                          onChange={e => merge({ selected_datetime: e.target.value })}
                          min={form.available_from}
                          max={form.available_to}
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={handleConfirmDate}
                        disabled={saving || !form.selected_datetime}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 cursor-pointer transition hover:bg-[#1D4ED8]"
                      >
                        {saving ? <FiRefreshCw size={13} className="animate-spin" /> : <FiCalendar size={13} />}
                        Confirmar y notificar a todos
                      </button>
                    </div>
                  </>
                ) : (
                  /* Vista de TH / otros — solo lectura, panel de coordinación */
                  <div className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FEF3C7]">
                        <FiClock size={14} className="text-[#D97706]" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#92400E]">Esperando confirmación del responsable</p>
                        <p className="text-[11px] text-[#B45309]">
                          Solo <strong>{form.assigned_to_name}</strong> puede confirmar la fecha y hora de la prueba.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1 border-t border-[#E5E7EB]">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Responsable</p>
                        <p className="text-xs font-medium text-[#1F2937]">{form.assigned_to_name}</p>
                        <p className="text-[11px] text-[#6B7280]">{form.assigned_to_email}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Ventana disponible</p>
                        <p className="text-xs text-[#1F2937]">
                          {form.available_from ? new Date(form.available_from).toLocaleString("es-EC") : "—"}
                        </p>
                        <p className="text-[11px] text-[#6B7280]">
                          hasta {form.available_to ? new Date(form.available_to).toLocaleString("es-EC") : "—"}
                        </p>
                      </div>
                    </div>

                    <p className="text-[11px] text-[#9CA3AF]">
                      Se notificó a {form.assigned_to_name} por correo. Una vez que confirme, recibirás una notificación y la fecha aparecerá aquí automáticamente.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Paso 2 — Vista cuando ya está confirmado (ambos roles) ── */}
            {isDateConfirmed && (
              <div>
                <SectionTitle>2. Fecha confirmada</SectionTitle>
                <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-2.5 flex items-center gap-2 text-xs text-[#16A34A] font-medium">
                  <FiCalendar size={13} />
                  Prueba confirmada para el <span className="font-bold ml-1">{new Date(form.selected_datetime).toLocaleString("es-EC")}</span>
                  <span className="ml-auto font-normal text-[#059669]">Confirmada por {form.assigned_to_name}</span>
                </div>
              </div>
            )}

            {/* ── Paso 3: Resultado ── */}
            {isDateConfirmed && (
              <div>
                <SectionTitle>3. Resultado de la prueba</SectionTitle>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#6B7280]">Calificación (0–100) *</label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={form.score || ""}
                      onChange={e => merge({ score: e.target.value })}
                      placeholder="Ej: 85"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-semibold text-[#6B7280]">Observaciones del resultado *</label>
                  <Textarea
                    value={form.result_observations || ""}
                    onChange={e => merge({ result_observations: e.target.value })}
                    rows={3}
                    placeholder="Desempeño general, puntos fuertes, áreas de mejora..."
                  />
                </div>
              </div>
            )}
          </div>

          {isDateConfirmed && (
            <ActionBar>
              <RejectBtn onClick={onReject} disabled={saving} />
              <AdvanceBtn
                onClick={handleAdvance}
                saving={saving}
                disabled={!form.score || !form.result_observations?.trim()}
                label="Prueba aprobada, continuar"
              />
            </ActionBar>
          )}
        </>
      )}

      {isCompleted && existing.result_observations && (
        <div className="space-y-2 px-5 pb-5">
          <SectionTitle>Resultado registrado</SectionTitle>
          <p className="text-sm font-semibold">Calificación: {stageResult?.score ?? "—"}/100</p>
          <p className="text-sm text-[#374151] whitespace-pre-line">{existing.result_observations}</p>
        </div>
      )}
    </div>
  );
}
