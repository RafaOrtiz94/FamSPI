import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FiAlertTriangle, FiCheckCircle, FiFileText, FiLock, FiRefreshCw } from "react-icons/fi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import Button from "../../../../core/ui/components/Button";
import {
  cancelOffboardingProcess,
  closeOffboardingProcess,
  getOffboardingWorkspace,
  runOffboardingLiquidation,
} from "../../../../core/api/offboardingApi";
import PersonnelChecklist from "./PersonnelChecklist";

const STAGE_ORDER = ["OPERATIONAL", "FINANCIAL", "HR"];
const STAGE_LABELS = {
  OPERATIONAL: "Etapa 1 - Operativa",
  FINANCIAL: "Etapa 2 - Financiera",
  HR: "Etapa 3 - Cierre",
};

const formatNumber = (value) => Number(value || 0).toFixed(2);
const formatCurrency = (value) =>
  new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const OffboardingWorkspace = ({
  collaboratorId,
  profileData,
  documents,
  userRole,
  onChecklistFlagToggle,
  onDocumentUpload,
  uploadingDocKey,
}) => {
  const queryClient = useQueryClient();
  const [departureDate, setDepartureDate] = useState("");
  const [salaryBase, setSalaryBase] = useState("");
  const [otherDeductions, setOtherDeductions] = useState("0");

  const workspaceQuery = useQuery({
    queryKey: ["talento", "offboarding", String(collaboratorId || "")],
    enabled: Boolean(collaboratorId),
    queryFn: () => getOffboardingWorkspace(collaboratorId),
  });

  const workspace = workspaceQuery.data || null;
  const stages = workspace?.stages || {};
  const process = workspace?.process || {};
  const liquidation = process?.liquidation_snapshot || null;
  const operationalReady = Boolean(stages?.OPERATIONAL?.complete);
  const financialReady = Boolean(stages?.FINANCIAL?.complete);
  const closed = Boolean(process?.is_closed);
  const offboardingRequested = Boolean(
    profileData?.onboarding?.offboarding_requested === true
  );

  useEffect(() => {
    if (!workspace) return;
    setDepartureDate((current) => current || process?.departure_date || profileData?.laboral?.fecha_salida || "");
    setSalaryBase((current) =>
      current || String(process?.salary_base || profileData?.laboral?.sueldo || "")
    );
    setOtherDeductions((current) => (current === "0" ? String(process?.other_deductions || 0) : current));
  }, [process?.departure_date, process?.other_deductions, process?.salary_base, profileData?.laboral?.fecha_salida, profileData?.laboral?.sueldo, workspace]);

  const runLiquidationMutation = useMutation({
    mutationFn: (payload) => runOffboardingLiquidation(collaboratorId, payload),
    onSuccess: async () => {
      toast.success("Liquidacion generada y acta exportada.");
      await queryClient.invalidateQueries({ queryKey: ["talento", "offboarding", String(collaboratorId || "")] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "No se pudo generar la liquidacion.");
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => closeOffboardingProcess(collaboratorId),
    onSuccess: async () => {
      toast.success("Desvinculacion cerrada. Usuario desactivado.");
      await queryClient.invalidateQueries({ queryKey: ["talento", "offboarding", String(collaboratorId || "")] });
      await queryClient.invalidateQueries({ queryKey: ["talento", "collaborator-profile", String(collaboratorId || "")] });
      await queryClient.invalidateQueries({ queryKey: ["talento", "collaborators"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "No se pudo cerrar la desvinculacion.");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelOffboardingProcess(collaboratorId),
    onSuccess: async () => {
      toast.success("Solicitud de desvinculación cancelada.");
      await queryClient.invalidateQueries({ queryKey: ["talento", "offboarding", String(collaboratorId || "")] });
      await queryClient.invalidateQueries({ queryKey: ["talento", "collaborator-profile", String(collaboratorId || "")] });
      await queryClient.invalidateQueries({ queryKey: ["talento", "collaborators"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "No se pudo cancelar la desvinculación.");
    },
  });

  const summaryCards = useMemo(() => {
    if (!liquidation) return [];
    return [
      {
        key: "proportional_days",
        label: "Dias proporcionales",
        value: formatNumber(liquidation.proportional_days),
      },
      {
        key: "carry_over_days",
        label: "Arrastre historico",
        value: formatNumber(liquidation.carry_over_days),
      },
      {
        key: "taken_days",
        label: "Dias tomados",
        value: formatNumber(liquidation.taken_days),
      },
      {
        key: "total_to_pay",
        label: "Dias a pagar",
        value: formatNumber(liquidation.total_to_pay),
      },
      {
        key: "liquidation_value",
        label: "Valor bruto",
        value: formatCurrency(liquidation.liquidation_value),
      },
      {
        key: "net_liquidation_value",
        label: "Valor neto",
        value: formatCurrency(liquidation.net_liquidation_value),
      },
    ];
  }, [liquidation]);

  const handleRunLiquidation = async () => {
    await runLiquidationMutation.mutateAsync({
      departure_date: departureDate,
      salary_base: Number(salaryBase || 0),
      other_deductions: Number(otherDeductions || 0),
    });
  };

  if (!collaboratorId) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Selecciona un colaborador para gestionar su salida.
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="space-y-6"
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Flujo maestro de desvinculacion</h3>
            <p className="text-xs text-slate-600">
              La etapa financiera se habilita cuando Operativa esta al 100%. El cierre desactiva al usuario.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ["talento", "offboarding", String(collaboratorId || "")] })
            }
            leftIcon={<FiRefreshCw title="Icono de sincronizacion de offboarding" />}
            aria-label="Sincronizar estado de offboarding"
          >
            Sincronizar
          </Button>
          {offboardingRequested && !closed ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={async () => {
                const confirmed = window.confirm(
                  "¿Cancelar la solicitud de desvinculación de este colaborador?"
                );
                if (!confirmed) return;
                await cancelMutation.mutateAsync();
              }}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Cancelando..." : "Cancelar desvinculación"}
            </Button>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {STAGE_ORDER.map((stageKey) => {
            const stage = stages?.[stageKey] || { done: 0, total: 0, complete: false };
            const blocked =
              (stageKey === "FINANCIAL" && !operationalReady) ||
              (stageKey === "HR" && !financialReady);
            return (
              <div
                key={stageKey}
                className={`rounded-xl border p-3 ${
                  stage.complete
                    ? "border-emerald-200 bg-emerald-50"
                    : blocked
                      ? "border-amber-200 bg-amber-50"
                      : "border-slate-200 bg-slate-50"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                  {STAGE_LABELS[stageKey]}
                </p>
                <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  {stage.complete ? (
                    <FiCheckCircle className="text-emerald-600" title="Etapa completada" />
                  ) : blocked ? (
                    <FiLock className="text-amber-700" title="Etapa bloqueada por flujo" />
                  ) : (
                    <FiAlertTriangle className="text-slate-600" title="Etapa en proceso" />
                  )}
                  {stage.done}/{stage.total}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-slate-900">Checklist de salida</p>
        <p className="mb-4 text-xs text-slate-600">
          Los cambios de checklist se sincronizan con offboarding al guardar el expediente del colaborador.
        </p>
        <PersonnelChecklist
          checklistMode="exit"
          profileData={profileData}
          documents={documents}
          onChecklistFlagToggle={onChecklistFlagToggle}
          onDocumentUpload={onDocumentUpload}
          uploadingDocKey={uploadingDocKey}
          userRole={userRole}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-900">Liquidacion financiera</h4>
          <p className="mt-1 text-xs text-slate-600">
            El calculo usa vacaciones proporcionales y arrastre historico. El acta de finiquito se genera en Drive.
          </p>

          {!operationalReady && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              La etapa operativa esta incompleta. Debes cerrar entrega de equipos y cuentas para habilitar liquidacion.
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="text-xs font-medium text-slate-700">
              Fecha de salida
              <input
                type="date"
                value={departureDate}
                onChange={(event) => setDepartureDate(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              Salario base
              <input
                type="number"
                min="0"
                step="0.01"
                value={salaryBase}
                onChange={(event) => setSalaryBase(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              Otros descuentos
              <input
                type="number"
                min="0"
                step="0.01"
                value={otherDeductions}
                onChange={(event) => setOtherDeductions(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              type="button"
              variant="primary"
              onClick={handleRunLiquidation}
              disabled={
                !operationalReady ||
                !departureDate ||
                Number(salaryBase || 0) <= 0 ||
                runLiquidationMutation.isPending
              }
              leftIcon={<FiFileText title="Icono de generacion de acta de finiquito" />}
              aria-label="Generar acta de finiquito"
            >
              {runLiquidationMutation.isPending ? "Generando..." : "Generar Acta de Finiquito"}
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() => closeMutation.mutate()}
              disabled={!financialReady || closed || closeMutation.isPending}
              leftIcon={<FiLock title="Icono de cierre de offboarding" />}
              aria-label="Cerrar proceso de offboarding y desactivar usuario"
            >
              {closeMutation.isPending ? "Cerrando..." : closed ? "Cerrado" : "Cerrar y desactivar usuario"}
            </Button>

            {process?.finiquito_pdf_url ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => window.open(process.finiquito_pdf_url, "_blank", "noopener,noreferrer")}
                aria-label="Abrir acta de finiquito en PDF"
              >
                Abrir PDF
              </Button>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-900">Desglose proporcional</h4>
          <p className="mt-1 text-xs text-slate-600">
            Resultado calculado por backend segun fecha de ingreso, historial y vacaciones tomadas.
          </p>

          {workspaceQuery.isLoading ? (
            <div className="mt-4 space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-stone-200" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-stone-200" />
              <div className="h-4 w-3/5 animate-pulse rounded bg-stone-200" />
            </div>
          ) : summaryCards.length > 0 ? (
            <div className="mt-4 space-y-2">
              {summaryCards.map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                  <span className="text-slate-600">{item.label}</span>
                  <span className="font-semibold text-slate-900">{item.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              Aun no existe liquidacion generada para este colaborador.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default OffboardingWorkspace;
