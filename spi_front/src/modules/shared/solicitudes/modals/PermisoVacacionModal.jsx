import React, { useState, useEffect } from "react";
import { FiX, FiCalendar, FiClock, FiFileText, FiChevronDown, FiChevronUp } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog } from "@headlessui/react";
import Button from "../../../../core/ui/components/Button";
import { useUI } from "../../../../core/ui/UIContext";
import {
    createSolicitud,
    getMisSolicitudes,
    registerStudyEnrollment,
    getMyStudyEnrollments,
} from "../../../../core/api/permisosApi";
import LoadingOverlay from "../../../../core/ui/components/LoadingOverlay";
import { formatVacationDaysHours } from "../utils/vacationDisplay";

/**
 * Modal unificado para solicitudes de permisos y vacaciones
 * Flujo multi-paso:
 * 1. Seleccionar tipo (permiso o vacaciÃ³n)
 * 2. Llenar formulario especÃ­fico
 * 3. Confirmar y enviar
 */
const PermisoVacacionModal = ({ open, onClose, onSuccess }) => {
    const { showToast, showLoader, hideLoader } = useUI();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [tipoSolicitud, setTipoSolicitud] = useState(""); // 'permiso' o 'vacaciones'
    const [tipoPermiso, setTipoPermiso] = useState(""); // 'estudios', 'personal', 'salud', 'calamidad'
    const [subtipoCalamidad, setSubtipoCalamidad] = useState(""); // 'fallecimiento', 'accidente', 'desastre'
    const [vacationSummary, setVacationSummary] = useState(null);
    const [requestedVacationDays, setRequestedVacationDays] = useState(0);
    const [approvedVacationDays, setApprovedVacationDays] = useState(0);
    const [pendingVacationDays, setPendingVacationDays] = useState(0);
    const [rejectedVacationDays, setRejectedVacationDays] = useState(0);
    const [cancelledVacationDays, setCancelledVacationDays] = useState(0);
    const [saludDuracionTipo, setSaludDuracionTipo] = useState("dias"); // 'horas' o 'dias'
    const [calamidadDuracionTipo, setCalamidadDuracionTipo] = useState("dias"); // 'horas' o 'dias'
    const [subtipoSalud, setSubtipoSalud] = useState(""); // 'enfermedad_certificada' | 'atencion_medica_familiar'
    const [vacacionMedioDia, setVacacionMedioDia] = useState(false);
    const [studyEnrollments, setStudyEnrollments] = useState([]);
    const [selectedStudyEnrollmentId, setSelectedStudyEnrollmentId] = useState("");
    const [loadingStudyEnrollment, setLoadingStudyEnrollment] = useState(false);
    const [submittingStudyEnrollment, setSubmittingStudyEnrollment] = useState(false);
    const [studySectionOpen, setStudySectionOpen] = useState(true);
    const [studyForm, setStudyForm] = useState({
        institution_name: "",
        program_name: "",
        valid_from: "",
        valid_until: "",
        matricula_file: null,
    });
    const [recoveryPlanRows, setRecoveryPlanRows] = useState([]);
    const usesPermisoHoras = (permiso, saludTipo, calamidadTipo) =>
        permiso === "estudios" ||
        permiso === "personal" ||
        (permiso === "salud" && saludTipo === "horas") ||
        (permiso === "calamidad" && calamidadTipo === "horas");
    const usesPermisoDateTime = (permiso, saludTipo, calamidadTipo) =>
        permiso === "estudios" ||
        permiso === "personal" ||
        (permiso === "salud" && saludTipo === "horas") ||
        (permiso === "calamidad" && calamidadTipo === "horas");
    const usesSimplifiedHourlyPermiso = (permiso, saludTipo, calamidadTipo) =>
        permiso === "estudios" ||
        permiso === "personal" ||
        (permiso === "salud" && saludTipo === "horas") ||
        (permiso === "calamidad" && calamidadTipo === "horas");
    const extractDatePart = (value) =>
        typeof value === "string" && value.includes("T") ? value.split("T")[0] : value || "";
    const toIsoDateTime = (value) => {
        if (!value) return "";
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? "" : date.toISOString();
    };
    const calculateHoursBetween = (startValue, endValue) => {
        if (!startValue || !endValue) return "";
        const start = new Date(startValue);
        const end = new Date(endValue);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return "";
        const hours = (end - start) / (1000 * 60 * 60);
        return (Math.round(hours * 100) / 100).toString();
    };
    const addHoursToLocalDateTime = (startValue, hoursValue) => {
        if (!startValue) return "";
        const start = new Date(startValue);
        const hours = Number(hoursValue || 0);
        if (Number.isNaN(start.getTime()) || !Number.isFinite(hours) || hours <= 0) return "";
        const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
        const pad = (value) => String(value).padStart(2, "0");
        return `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`;
    };
    const getLocalTimePart = (dateTimeValue) => {
        if (!dateTimeValue || typeof dateTimeValue !== "string") return "";
        const [, timePart = ""] = dateTimeValue.split("T");
        return normalizeTimeText(timePart.slice(0, 5));
    };
    const mergeDateAndTime = (datePart, timePart) => {
        if (!datePart || !timePart) return "";
        const normalizedTime = normalizeTimeText(timePart);
        if (!normalizedTime) return "";
        return `${datePart}T${normalizedTime}`;
    };
    const getHourOptionsByPermiso = (permiso) => {
        if (permiso === "estudios") return ["0.5", "1", "1.5", "2", "2.5", "3"];
        if (permiso === "personal") return ["0.5", "1", "1.5", "2"];
        if (permiso === "salud") return ["0.5", "1", "1.5", "2", "2.5", "3", "4", "5", "6", "7", "8"];
        if (permiso === "calamidad") return ["0.5", "1", "1.5", "2", "2.5", "3", "4", "5", "6", "7", "8"];
        return [];
    };
    const formatDisplayDate = (value) => {
        if (!value) return "";
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleString("es-EC", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });
    };

    const normalizeTimeText = (value) => {
        const text = String(value || "").trim();
        const match = text.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
        if (!match) return "";
        const hh = Number(match[1]);
        const mm = Number(match[2]);
        if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return "";
        return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    };

    const getVacationShiftLabel = (startTime, endTime) => {
        const start = normalizeTimeText(startTime);
        const end = normalizeTimeText(endTime);
        if (!start || !end) return "";
        const [startHour] = start.split(":").map(Number);
        const [endHour, endMinute] = end.split(":").map(Number);
        const endAsDecimal = endHour + (endMinute / 60);
        if (startHour < 13 && endAsDecimal <= 13) return "Mañana";
        if (startHour >= 13) return "Tarde";
        return "Horario mixto";
    };

    const computeRecoveryHours = (startTime, endTime) => {
        const start = normalizeTimeText(startTime);
        const end = normalizeTimeText(endTime);
        if (!start || !end) return "";
        const [sh, sm] = start.split(":").map(Number);
        const [eh, em] = end.split(":").map(Number);
        const diff = eh * 60 + em - (sh * 60 + sm);
        if (diff <= 0) return "";
        return String(Math.round(((diff / 60) + Number.EPSILON) * 100) / 100);
    };

    const estimateRequestedHours = () => {
        const hours = Number(formData.duracion_horas || 0);
        if (Number.isFinite(hours) && hours > 0) return hours;
        const days = Number(formData.duracion_dias || 0);
        if (Number.isFinite(days) && days > 0) return Math.round(((days * 8) + Number.EPSILON) * 100) / 100;
        return 0;
    };
    const getPermisoHourLimit = (permiso) => {
        if (permiso === "estudios") return 3;
        if (permiso === "personal") return 2;
        return null;
    };

    const canBeRecoverableByRule = () => {
        if (tipoSolicitud !== "permiso") return false;
        if (tipoPermiso === "estudios") return true;
        if (tipoPermiso === "personal") return true;
        if (tipoPermiso === "calamidad") {
            const normalized = String(subtipoCalamidad || "").trim().toLowerCase();
            return Boolean(normalized) && normalized !== "fallecimiento";
        }
        if (tipoPermiso === "salud") {
            return subtipoSalud === "atencion_medica_familiar";
        }
        return false;
    };

    const [formData, setFormData] = useState({
        // ComÃºn
        fecha_inicio: "",
        fecha_fin: "",
        fecha_inicio_hora: "",
        fecha_fin_hora: "",

        // Permisos
        duracion_horas: "",
        tipo_permiso: "",
        subtipo_calamidad: "",
        subtipo_salud: "",

        // Vacaciones
        duracion_dias: "",
        periodo_vacaciones: new Date().getFullYear().toString(),
        fecha_regreso: "",
        vacation_start_time: "",
        vacation_end_time: "",
    });

    useEffect(() => {
        if (open && tipoSolicitud === "vacaciones") {
            loadVacationSummary();
        }
    }, [open, tipoSolicitud]);

    useEffect(() => {
        if (!open) return;
        if (step === 2 && tipoSolicitud === "vacaciones") {
            loadVacationSummary();
        }
    }, [open, step, tipoSolicitud]);

    useEffect(() => {
        if (tipoPermiso !== "salud") {
            setSaludDuracionTipo("dias");
            setSubtipoSalud("");
        }
    }, [tipoPermiso]);

    useEffect(() => {
        if (tipoPermiso !== "calamidad") {
            setCalamidadDuracionTipo("dias");
            setSubtipoCalamidad("");
        }
    }, [tipoPermiso]);

    useEffect(() => {
        if (!canBeRecoverableByRule()) {
            setRecoveryPlanRows([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tipoSolicitud, tipoPermiso, subtipoCalamidad, subtipoSalud]);

    useEffect(() => {
        const loadEnrollment = async () => {
            if (!open || tipoSolicitud !== "permiso" || tipoPermiso !== "estudios") return;
            setLoadingStudyEnrollment(true);
            try {
                const response = await getMyStudyEnrollments();
                const items = Array.isArray(response?.data) ? response.data : [];
                const activeItems = items.filter((item) => String(item?.status || "").toLowerCase() === "active");
                setStudyEnrollments(items);
                setSelectedStudyEnrollmentId((current) => {
                    if (current && activeItems.some((item) => String(item.id) === String(current))) {
                        return current;
                    }
                    return activeItems[0] ? String(activeItems[0].id) : "";
                });
            } catch (error) {
                console.error("Error loading study enrollment:", error);
                setStudyEnrollments([]);
                setSelectedStudyEnrollmentId("");
            } finally {
                setLoadingStudyEnrollment(false);
            }
        };
        loadEnrollment();
    }, [open, tipoSolicitud, tipoPermiso]);

    useEffect(() => {
        if (vacacionMedioDia) {
            setFormData((prev) => ({
                ...prev,
                duracion_dias: 0.5,
                duracion_horas: 4,
                fecha_fin: prev.fecha_inicio || prev.fecha_fin,
            }));
        } else {
            setFormData((prev) => ({
                ...prev,
                duracion_dias: prev.duracion_dias === 0.5 ? "" : prev.duracion_dias,
                duracion_horas: prev.duracion_horas === 4 ? "" : prev.duracion_horas,
            }));
        }
    }, [vacacionMedioDia]);

    useEffect(() => {
        const shouldAutoCalculateHours =
            tipoSolicitud === "permiso" &&
            usesPermisoDateTime(tipoPermiso, saludDuracionTipo, calamidadDuracionTipo) &&
            !usesSimplifiedHourlyPermiso(tipoPermiso, saludDuracionTipo, calamidadDuracionTipo);
        if (!shouldAutoCalculateHours) return;

        const nextHoras = calculateHoursBetween(formData.fecha_inicio_hora, formData.fecha_fin_hora);
        setFormData((prev) => {
            if (String(prev.duracion_horas || "") === String(nextHoras || "")) return prev;
            return {
                ...prev,
                duracion_horas: nextHoras,
            };
        });
    }, [
        tipoSolicitud,
        tipoPermiso,
        saludDuracionTipo,
        calamidadDuracionTipo,
        formData.fecha_inicio_hora,
        formData.fecha_fin_hora,
    ]);

    useEffect(() => {
        const shouldAutoCalculateEnd =
            tipoSolicitud === "permiso" && usesSimplifiedHourlyPermiso(tipoPermiso, saludDuracionTipo, calamidadDuracionTipo);
        if (!shouldAutoCalculateEnd) return;

        const nextEnd = addHoursToLocalDateTime(formData.fecha_inicio_hora, formData.duracion_horas);
        const nextDate = extractDatePart(nextEnd);
        setFormData((prev) => {
            if ((prev.fecha_fin_hora || "") === nextEnd && (prev.fecha_fin || "") === nextDate) return prev;
            return {
                ...prev,
                fecha_fin_hora: nextEnd,
                fecha_fin: nextDate,
            };
        });
    }, [
        tipoSolicitud,
        tipoPermiso,
        saludDuracionTipo,
        calamidadDuracionTipo,
        formData.fecha_inicio_hora,
        formData.duracion_horas,
    ]);

    useEffect(() => {
        const shouldAutoCalculateDays =
            tipoSolicitud === "permiso" &&
            ((tipoPermiso === "salud" && saludDuracionTipo === "dias") ||
                (tipoPermiso === "calamidad" && calamidadDuracionTipo === "dias"));
        if (!shouldAutoCalculateDays) return;

        let nextDays = "";
        if (formData.fecha_inicio && formData.fecha_fin) {
            const start = new Date(`${extractDatePart(formData.fecha_inicio)}T00:00:00`);
            const end = new Date(`${extractDatePart(formData.fecha_fin)}T00:00:00`);
            if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start) {
                nextDays = String(Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
            }
        }
        setFormData((prev) => {
            if (String(prev.duracion_dias || "") === String(nextDays || "")) return prev;
            return {
                ...prev,
                duracion_dias: nextDays,
            };
        });
    }, [
        tipoSolicitud,
        tipoPermiso,
        saludDuracionTipo,
        calamidadDuracionTipo,
        formData.fecha_inicio,
        formData.fecha_fin,
    ]);

    const loadVacationSummary = async () => {
        try {
            const mineResp = await getMisSolicitudes();
            const responseData = Array.isArray(mineResp?.data)
                ? mineResp.data
                : Array.isArray(mineResp)
                    ? mineResp
                    : [];

            const normalizeType = (row) => String(row?.tipo_solicitud || row?.tipoSolicitud || "").toLowerCase();
            const isVacationRow = (row) => {
                const type = normalizeType(row);
                // Compatibilidad con registros historicos sin tipo_solicitud.
                return type === "vacaciones" || type === "vacacion" || type === "";
            };
            const normalizeStatus = (row) => String(row?.status || "").toLowerCase();

            const vacationRows = responseData.filter(isVacationRow);
            const approvedDays = vacationRows
                .filter((req) => ["approved", "aprobado"].includes(normalizeStatus(req)))
                .reduce((acc, req) => acc + calculateDays(req), 0);
            const pendingDays = vacationRows
                .filter((req) => ["pending", "pendiente", "pending_final", "partially_approved"].includes(normalizeStatus(req)))
                .reduce((acc, req) => acc + calculateDays(req), 0);
            const rejectedDays = vacationRows
                .filter((req) => ["rejected", "rechazado"].includes(normalizeStatus(req)))
                .reduce((acc, req) => acc + calculateDays(req), 0);
            const cancelledDays = vacationRows
                .filter((req) => ["cancelled", "cancelado"].includes(normalizeStatus(req)))
                .reduce((acc, req) => acc + calculateDays(req), 0);
            const requestedDays = approvedDays + pendingDays + rejectedDays + cancelledDays;

            setApprovedVacationDays(approvedDays);
            setPendingVacationDays(pendingDays);
            setRejectedVacationDays(rejectedDays);
            setCancelledVacationDays(cancelledDays);
            setRequestedVacationDays(requestedDays);

            const vacationsSummary = mineResp?.summary?.vacaciones || {};
            setVacationSummary({
                allowance: Number(vacationsSummary.allowance ?? 0),
                remaining: Number(vacationsSummary.remaining ?? 0),
                taken: Number(vacationsSummary.approved_days ?? approvedDays),
                pending: Number(vacationsSummary.pending_days ?? pendingDays),
                approved: Number(vacationsSummary.approved_days ?? approvedDays),
                rejected: Number(vacationsSummary.rejected_days ?? rejectedDays),
                cancelled: Number(vacationsSummary.cancelled_days ?? cancelledDays),
                requested: Number(vacationsSummary.requested_days ?? requestedDays),
                eligible: vacationsSummary.eligible,
                eligible_from: vacationsSummary.eligible_from,
                missing_hire_date: vacationsSummary.missing_hire_date,
            });
        } catch (error) {
            console.error("Error loading vacation summary:", error);
        }
    };

    const handleReset = () => {
        setStep(1);
        setTipoSolicitud("");
        setTipoPermiso("");
        setSubtipoCalamidad("");
        setSubtipoSalud("");
        setSaludDuracionTipo("dias");
        setVacacionMedioDia(false);
        setVacationSummary(null);
        setRequestedVacationDays(0);
        setApprovedVacationDays(0);
        setPendingVacationDays(0);
        setRejectedVacationDays(0);
        setCancelledVacationDays(0);
        setFormData({
            fecha_inicio: "",
            fecha_fin: "",
            fecha_inicio_hora: "",
            fecha_fin_hora: "",
            duracion_horas: "",
            tipo_permiso: "",
            subtipo_calamidad: "",
            subtipo_salud: "",
            duracion_dias: "",
            periodo_vacaciones: new Date().getFullYear().toString(),
            fecha_regreso: "",
            vacation_start_time: "",
            vacation_end_time: "",
        });
        setStudyEnrollments([]);
        setSelectedStudyEnrollmentId("");
        setLoadingStudyEnrollment(false);
        setStudyForm({
            institution_name: "",
            program_name: "",
            valid_from: "",
            valid_until: "",
            matricula_file: null,
        });
        setRecoveryPlanRows([]);
    };

    const handleClose = () => {
        if (loading || submittingStudyEnrollment) return;
        handleReset();
        onClose();
    };

    const handleRegisterStudyEnrollment = async () => {
        setSubmittingStudyEnrollment(true);
        try {
            const enrollmentPayload = {
                institution_name: studyForm.institution_name,
                program_name: studyForm.program_name,
                valid_from: studyForm.valid_from,
                valid_until: studyForm.valid_until,
                matricula_file: studyForm.matricula_file,
            };
            await registerStudyEnrollment(enrollmentPayload);
            showToast("Matrícula enviada. Estado: esperando validación.", "success");
            const refreshed = await getMyStudyEnrollments();
            const items = Array.isArray(refreshed?.data) ? refreshed.data : [];
            const activeItems = items.filter((item) => String(item?.status || "").toLowerCase() === "active");
            setStudyEnrollments(items);
            setSelectedStudyEnrollmentId((current) => {
                if (current && activeItems.some((item) => String(item.id) === String(current))) {
                    return current;
                }
                return activeItems[0] ? String(activeItems[0].id) : "";
            });
            setStudyForm({
                institution_name: "",
                program_name: "",
                valid_from: "",
                valid_until: "",
                matricula_file: null,
            });
        } catch (error) {
            showToast(error.response?.data?.message || error.message || "No se pudo registrar matrícula", "error");
        } finally {
            setSubmittingStudyEnrollment(false);
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        showLoader();
        try {
            const famSignConsentText =
                "Al enviar esta solicitud acepto el uso de FamSign para firmar la solicitud y registrar la aprobacion/rechazo del jefe inmediato en SPI.";
            const payload = {
                tipo_solicitud: tipoSolicitud,
                ...formData,
                fam_sign_notice_version: "FS-WF-2026.02",
                fam_sign_consent_text: famSignConsentText,
            };

            if (tipoSolicitud === "permiso") {
                payload.tipo_permiso = tipoPermiso;
                const rawRequestedHours = Number(formData.duracion_horas || 0);
                const uiHourLimit = getPermisoHourLimit(tipoPermiso);
                if (Number.isFinite(rawRequestedHours) && rawRequestedHours > 0 && uiHourLimit !== null && rawRequestedHours > uiHourLimit) {
                    throw new Error(
                        tipoPermiso === "estudios"
                            ? "El permiso por estudios no puede exceder 3 horas."
                            : "El permiso por asuntos personales no puede exceder 2 horas."
                    );
                }
                if (tipoPermiso === "salud") {
                    if (!subtipoSalud) {
                        throw new Error("Debes seleccionar el subtipo de permiso por salud.");
                    }
                    payload.subtipo_salud = subtipoSalud;
                }
                if (tipoPermiso === "estudios") {
                    if (!selectedStudyEnrollmentId) {
                        throw new Error("Debes seleccionar una matrícula activa para continuar.");
                    }
                    payload.study_enrollment_id = Number(selectedStudyEnrollmentId);
                }
                const shouldUseDateTime = usesPermisoDateTime(tipoPermiso, saludDuracionTipo, calamidadDuracionTipo);
                if (shouldUseDateTime) {
                    const computedEndValue = usesSimplifiedHourlyPermiso(tipoPermiso, saludDuracionTipo, calamidadDuracionTipo)
                        ? addHoursToLocalDateTime(formData.fecha_inicio_hora, formData.duracion_horas)
                        : formData.fecha_fin_hora;
                    if (!computedEndValue) {
                        throw new Error("Debes ingresar una fecha/hora de inicio y una duración válida.");
                    }
                    if (
                        usesSimplifiedHourlyPermiso(tipoPermiso, saludDuracionTipo, calamidadDuracionTipo) &&
                        extractDatePart(computedEndValue) !== extractDatePart(formData.fecha_inicio_hora)
                    ) {
                        throw new Error("El permiso debe iniciar y terminar el mismo día.");
                    }
                    payload.fecha_inicio_hora = toIsoDateTime(formData.fecha_inicio_hora);
                    payload.fecha_fin_hora = toIsoDateTime(computedEndValue);
                    payload.fecha_inicio = extractDatePart(formData.fecha_inicio_hora);
                    payload.fecha_fin = extractDatePart(computedEndValue);
                    payload.duracion_horas = usesSimplifiedHourlyPermiso(tipoPermiso, saludDuracionTipo, calamidadDuracionTipo)
                        ? Number(formData.duracion_horas || 0)
                        : calculateHoursBetween(formData.fecha_inicio_hora, computedEndValue);
                    payload.duracion_dias = "";
                } else {
                    payload.fecha_inicio_hora = "";
                    payload.fecha_fin_hora = "";
                }
                if (tipoPermiso === "calamidad") {
                    payload.subtipo_calamidad = subtipoCalamidad.trim();
                }
                if (tipoPermiso === "salud" && saludDuracionTipo === "horas") {
                    payload.duracion_dias = "";
                }
                if (tipoPermiso === "salud" && saludDuracionTipo === "dias") {
                    payload.duracion_horas = "";
                }
                if (tipoPermiso === "calamidad" && calamidadDuracionTipo === "horas") {
                    payload.duracion_dias = "";
                }
                if (tipoPermiso === "calamidad" && calamidadDuracionTipo === "dias") {
                    payload.duracion_horas = "";
                }

                if (canBeRecoverableByRule() && recoveryPlanRows.length > 0) {
                    const normalizedRecoveryPlan = recoveryPlanRows
                        .map((row) => {
                            const date = row?.date || "";
                            const start_time = normalizeTimeText(row?.start_time);
                            const end_time = normalizeTimeText(row?.end_time);
                            const notes = String(row?.notes || "").trim();
                            const hours = Number(computeRecoveryHours(start_time, end_time) || 0);
                            return { date, start_time, end_time, notes, hours };
                        })
                        .filter((row) => row.date && row.start_time && row.end_time && row.hours > 0)
                        .map((row) => ({
                            date: row.date,
                            start_time: row.start_time,
                            end_time: row.end_time,
                            notes: row.notes || null,
                        }));

                    if (normalizedRecoveryPlan.length === 0) {
                        throw new Error("El plan de recuperación contiene tramos incompletos o inválidos.");
                    }
                    payload.recovery_plan = normalizedRecoveryPlan;
                }
            }

            if (tipoSolicitud === "vacaciones" && vacacionMedioDia) {
                payload.duracion_dias = 0.5;
                payload.duracion_horas = 4;
                payload.fecha_fin = payload.fecha_inicio;
                if (!formData.vacation_start_time || !formData.vacation_end_time) {
                    throw new Error("Para vacaciones de medio día debes registrar el rango horario.");
                }
                const startIso = toIsoDateTime(`${payload.fecha_inicio}T${formData.vacation_start_time}`);
                const endIso = toIsoDateTime(`${payload.fecha_inicio}T${formData.vacation_end_time}`);
                if (!startIso || !endIso || new Date(endIso) <= new Date(startIso)) {
                    throw new Error("El rango horario de vacaciones no es válido.");
                }
                payload.start_time = startIso;
                payload.end_time = endIso;
                payload.duration_hours = Number(calculateHoursBetween(startIso, endIso) || 0);
            }

            const response = await createSolicitud(payload);

            if (response.ok) {
                showToast(
                    tipoSolicitud === "vacaciones"
                        ? "Solicitud de vacaciones enviada para aprobacion del jefe inmediato"
                        : "Solicitud de permiso enviada para aprobacion del jefe inmediato",
                    "success"
                );
                onSuccess?.();
                handleClose();
            } else {
                throw new Error(response.message || "Error al crear solicitud");
            }
        } catch (error) {
            console.error("Error creating solicitud:", error);
            showToast(error.response?.data?.message || error.message || "Error al crear la solicitud", "error");
        } finally {
            setLoading(false);
            hideLoader();
        }
    };

    const calculateDays = (source = formData) => {
        const explicitDays = Number(source?.duracion_dias ?? source?.days);
        if (Number.isFinite(explicitDays) && explicitDays > 0) {
            return explicitDays;
        }

        const startValue = source?.fecha_inicio || source?.start_date;
        const endValue = source?.fecha_fin || source?.end_date;
        if (!startValue || !endValue) return 0;

        const start = new Date(startValue);
        const end = new Date(endValue);
        const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
        return diff >= 0 ? diff + 1 : 0;
    };

    const renderStepIndicator = () => (
        <div className="flex items-center justify-center gap-2 mb-6">
            {[1, 2, 3].map((s) => (
                <div
                    key={s}
                    className={`h-2 w-12 rounded-full transition-colors ${s === step ? "bg-indigo-600" : s < step ? "bg-indigo-300" : "bg-gray-200"
                        }`}
                />
            ))}
        </div>
    );

    const renderStep1 = () => (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">¿Qué deseas solicitar?</h3>
            <div className="grid grid-cols-2 gap-4">
                <button
                    type="button"
                    onClick={() => {
                        setTipoSolicitud("permiso");
                        setStep(2);
                    }}
                    className="p-6 border-2 border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
                >
                    <FiClock className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
                    <p className="font-semibold text-gray-900">Permiso</p>
                    <p className="text-xs text-gray-500 mt-1">Estudios, personal, salud, calamidad</p>
                </button>

                <button
                    type="button"
                    onClick={() => {
                        setTipoSolicitud("vacaciones");
                        setStep(2);
                    }}
                    className="p-6 border-2 border-gray-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
                >
                    <FiCalendar className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                    <p className="font-semibold text-gray-900">Vacaciones</p>
                    <p className="text-xs text-gray-500 mt-1">Descanso anual programado</p>
                </button>
            </div>
        </div>
    );

    const renderStep2 = () => {
        if (tipoSolicitud === "permiso") {
            return renderPermisoForm();
        } else if (tipoSolicitud === "vacaciones") {
            return renderVacacionesForm();
        }
        return null;
    };

    const renderPermisoForm = () => {
        const isSalud = tipoPermiso === "salud";
        const usesHoras = usesPermisoHoras(tipoPermiso, saludDuracionTipo, calamidadDuracionTipo);
        const usesDateTime = usesPermisoDateTime(tipoPermiso, saludDuracionTipo, calamidadDuracionTipo);
        const usesSimplifiedHours = usesSimplifiedHourlyPermiso(tipoPermiso, saludDuracionTipo, calamidadDuracionTipo);
        const startValue = usesDateTime ? formData.fecha_inicio_hora : formData.fecha_inicio;
        const endValue = usesDateTime ? formData.fecha_fin_hora : formData.fecha_fin;
        const simplifiedStartDate = usesSimplifiedHours
            ? extractDatePart(formData.fecha_inicio_hora || formData.fecha_inicio)
            : "";
        const simplifiedStartTime = usesSimplifiedHours
            ? (getLocalTimePart(formData.fecha_inicio_hora) || "08:00")
            : "";
        const simplifiedHourOptions = getHourOptionsByPermiso(tipoPermiso);
        const computedEndValue = usesSimplifiedHours
            ? addHoursToLocalDateTime(formData.fecha_inicio_hora, formData.duracion_horas)
            : endValue;
        const invalidDateRange =
            !usesSimplifiedHours &&
            Boolean(startValue && endValue) &&
            new Date(endValue).getTime() <= new Date(startValue).getTime();
        const hasDates = usesSimplifiedHours
            ? Boolean(startValue && computedEndValue)
            : Boolean(startValue && endValue);
        const crossesDayInSimplifiedHours =
            usesSimplifiedHours &&
            Boolean(startValue && computedEndValue) &&
            extractDatePart(startValue) !== extractDatePart(computedEndValue);
        const hasDuration = Boolean(usesHoras ? formData.duracion_horas : formData.duracion_dias);
        const isAutoHours = usesHoras && usesDateTime;
        const needsEnrollment = tipoPermiso === "estudios";
        const requiresActiveEnrollmentSelection = needsEnrollment && !selectedStudyEnrollmentId;
        const permisoHoursLimit = getPermisoHourLimit(tipoPermiso);
        const enteredHours = Number(formData.duracion_horas || 0);
        const exceedsPermisoHourLimit =
            usesHoras &&
            permisoHoursLimit !== null &&
            Number.isFinite(enteredHours) &&
            enteredHours > permisoHoursLimit;
        const enteredHealthDays = Number(formData.duracion_dias || 0);
        const hasHealthDaysValue = Number.isFinite(enteredHealthDays) && enteredHealthDays > 0;
        const healthCertificationNote =
            subtipoSalud === "enfermedad_certificada"
                ? saludDuracionTipo === "horas"
                    ? {
                        tone: "blue",
                        title: "Requisito documental para enfermedad certificada",
                        body: "Si el permiso por salud se registra por horas, el sistema mantiene justificación con certificado médico y no requiere validación del IESS por no superar tres días.",
                    }
                    : hasHealthDaysValue && enteredHealthDays > 3
                        ? {
                            tone: "amber",
                            title: "Validación requerida en IESS",
                            body: "Si la enfermedad certificada supera 3 días, el certificado debe validarse en el IESS para continuar con el trámite.",
                        }
                        : {
                            tone: "blue",
                            title: "Requisito documental para enfermedad certificada",
                            body: "Si la enfermedad certificada es de 3 días o menos, no requiere certificado del IESS validado.",
                        }
                : null;
        const activeEnrollments = studyEnrollments.filter((item) => String(item?.status || "").toLowerCase() === "active");
        const pendingEnrollments = studyEnrollments.filter((item) => String(item?.status || "").toLowerCase() === "pending_validation");
        const hasStudyForm =
            studyForm.institution_name.trim() &&
            studyForm.program_name.trim() &&
            studyForm.valid_from &&
            studyForm.valid_until &&
            studyForm.matricula_file;
        const plannedRecoveryHours =
            Math.round(
                (recoveryPlanRows.reduce(
                    (acc, row) => acc + Number(computeRecoveryHours(row.start_time, row.end_time) || 0),
                    0
                ) + Number.EPSILON) * 100
            ) / 100;
        const requestedHours = estimateRequestedHours();
        const isRecoveryPlanComplete = requestedHours > 0 && plannedRecoveryHours >= requestedHours;

        return (
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Tipo de Permiso</h3>

                <div className="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={() => setTipoPermiso("estudios")}
                        className={`p-4 border-2 rounded-lg transition-all ${tipoPermiso === "estudios"
                            ? "border-indigo-500 bg-indigo-50"
                            : "border-gray-200 hover:border-indigo-300"
                            }`}
                    >
                        <p className="font-semibold text-sm">Por Estudios</p>
                        <p className="text-xs text-gray-500 mt-1">Máx 3h recuperables</p>
                    </button>

                    <button
                        type="button"
                        onClick={() => setTipoPermiso("personal")}
                        className={`p-4 border-2 rounded-lg transition-all ${tipoPermiso === "personal"
                            ? "border-indigo-500 bg-indigo-50"
                            : "border-gray-200 hover:border-indigo-300"
                            }`}
                    >
                        <p className="font-semibold text-sm">Asuntos Personales</p>
                        <p className="text-xs text-gray-500 mt-1">Máx 2h/semana</p>
                    </button>

                    <button
                        type="button"
                        onClick={() => setTipoPermiso("salud")}
                        className={`p-4 border-2 rounded-lg transition-all ${tipoPermiso === "salud"
                            ? "border-indigo-500 bg-indigo-50"
                            : "border-gray-200 hover:border-indigo-300"
                            }`}
                    >
                        <p className="font-semibold text-sm">Por Salud</p>
                        <p className="text-xs text-gray-500 mt-1">Con certificado médico</p>
                    </button>

                    <button
                        type="button"
                        onClick={() => setTipoPermiso("calamidad")}
                        className={`p-4 border-2 rounded-lg transition-all ${tipoPermiso === "calamidad"
                            ? "border-indigo-500 bg-indigo-50"
                            : "border-gray-200 hover:border-indigo-300"
                            }`}
                    >
                        <p className="font-semibold text-sm">Calamidad Doméstica</p>
                        <p className="text-xs text-gray-500 mt-1">Emergencia familiar</p>
                    </button>
                </div>

                {tipoPermiso === "calamidad" && (
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700">Tipo de Calamidad</label>
                        <input
                            type="text"
                            value={subtipoCalamidad}
                            onChange={(e) => setSubtipoCalamidad(e.target.value)}
                            placeholder="Ej: fallecimiento, accidente, desastre, etc."
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            required
                        />
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Duración</label>
                            <select
                                value={calamidadDuracionTipo}
                                onChange={(e) => setCalamidadDuracionTipo(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="dias">Días</option>
                                <option value="horas">Horas</option>
                            </select>
                        </div>
                    </div>
                )}

                {tipoPermiso && (
                    <>
                        {tipoPermiso === "estudios" && (
                            <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 space-y-3">
                                <button
                                    type="button"
                                    onClick={() => setStudySectionOpen((prev) => !prev)}
                                    className="w-full flex items-start justify-between gap-3 text-left"
                                >
                                    <div>
                                        <p className="text-sm font-semibold text-sky-950">
                                            Información de matrícula académica
                                        </p>
                                        <p className="text-xs text-sky-800 mt-1">
                                            Este bloque identifica y valida la matrícula que respalda el permiso por estudios.
                                        </p>
                                    </div>
                                    {studySectionOpen ? (
                                        <FiChevronUp className="w-5 h-5 text-sky-700 shrink-0" />
                                    ) : (
                                        <FiChevronDown className="w-5 h-5 text-sky-700 shrink-0" />
                                    )}
                                </button>

                                {studySectionOpen && (
                                    <>
                                        {loadingStudyEnrollment ? (
                                            <p className="text-xs text-sky-800">Validando matrícula activa...</p>
                                        ) : (
                                            <>
                                                <div className="space-y-2">
                                                    {activeEnrollments.length > 0 ? (
                                                        <>
                                                            <p className="text-xs text-sky-800">
                                                                Selecciona una matrícula activa para habilitar la solicitud.
                                                            </p>
                                                            <select
                                                                value={selectedStudyEnrollmentId}
                                                                onChange={(e) => setSelectedStudyEnrollmentId(e.target.value)}
                                                                className="w-full px-3 py-2 border border-sky-200 rounded-lg focus:ring-2 focus:ring-sky-500 bg-white"
                                                            >
                                                                <option value="">Selecciona matrícula activa</option>
                                                                {activeEnrollments.map((item) => (
                                                                    <option key={item.id} value={item.id}>
                                                                        {item.institution_name} - vence {String(item.valid_until).slice(0, 10)}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <p className="text-[11px] text-sky-800">
                                                                Puedes seguir usando una matrícula activa o cargar otra adicional para validación.
                                                            </p>
                                                        </>
                                                    ) : (
                                                        <p className="text-xs text-sky-800">
                                                            No tienes matrícula activa. Debes cargar una matrícula y esperar validación del jefe inmediato.
                                                        </p>
                                                    )}
                                                </div>

                                                {pendingEnrollments.length > 0 && (
                                                    <div className="rounded-md border border-amber-300 bg-amber-50 p-2">
                                                        <p className="text-xs text-amber-800">
                                                            {activeEnrollments.length > 0 ? (
                                                                <>
                                                                    Tienes matrícula en <strong>esperando validación</strong>. Puedes seguir usando una matrícula activa mientras se revisa la nueva.
                                                                </>
                                                            ) : (
                                                                <>
                                                                    Tienes matrícula en <strong>esperando validación</strong>. No puedes pedir permisos por estudios hasta su aprobación.
                                                                </>
                                                            )}
                                                        </p>
                                                    </div>
                                                )}

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-xs font-medium text-sky-900 mb-1">Institución</label>
                                                        <input
                                                            type="text"
                                                            placeholder="Nombre de la institución"
                                                            value={studyForm.institution_name}
                                                            onChange={(e) => setStudyForm((prev) => ({ ...prev, institution_name: e.target.value }))}
                                                            className="w-full px-3 py-2 border border-sky-200 rounded-lg focus:ring-2 focus:ring-sky-500 bg-white"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-sky-900 mb-1">Programa o carrera</label>
                                                        <input
                                                            type="text"
                                                            placeholder="Nombre del programa"
                                                            value={studyForm.program_name}
                                                            onChange={(e) => setStudyForm((prev) => ({ ...prev, program_name: e.target.value }))}
                                                            className="w-full px-3 py-2 border border-sky-200 rounded-lg focus:ring-2 focus:ring-sky-500 bg-white"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-sky-900 mb-1">Fecha de inicio de la matrícula</label>
                                                        <input
                                                            type="date"
                                                            value={studyForm.valid_from}
                                                            onChange={(e) => setStudyForm((prev) => ({ ...prev, valid_from: e.target.value }))}
                                                            className="w-full px-3 py-2 border border-sky-200 rounded-lg focus:ring-2 focus:ring-sky-500 bg-white"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-sky-900 mb-1">Fecha de fin de la matrícula</label>
                                                        <input
                                                            type="date"
                                                            value={studyForm.valid_until}
                                                            onChange={(e) => setStudyForm((prev) => ({ ...prev, valid_until: e.target.value }))}
                                                            className="w-full px-3 py-2 border border-sky-200 rounded-lg focus:ring-2 focus:ring-sky-500 bg-white"
                                                        />
                                                    </div>
                                                    <div className="sm:col-span-2">
                                                        <label className="block text-xs font-medium text-sky-900 mb-1">Documento de matrícula</label>
                                                        <input
                                                            type="file"
                                                            accept=".pdf,.png,.jpg,.jpeg"
                                                            onChange={(e) =>
                                                                setStudyForm((prev) => ({
                                                                    ...prev,
                                                                    matricula_file: e.target.files?.[0] || null,
                                                                }))
                                                            }
                                                            className="w-full px-3 py-2 border border-sky-200 rounded-lg focus:ring-2 focus:ring-sky-500 bg-white"
                                                        />
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            onClick={handleRegisterStudyEnrollment}
                                            disabled={!hasStudyForm || submittingStudyEnrollment}
                                            className="w-full"
                                        >
                                            {submittingStudyEnrollment
                                                ? "Enviando matrícula..."
                                                : activeEnrollments.length > 0
                                                    ? "Cargar otra matrícula para validación"
                                                    : "Cargar matrícula para validación"}
                                        </Button>
                                    </>
                                )}
                            </div>
                        )}

                        {isSalud && (
                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Subtipo salud</label>
                                <select
                                    value={subtipoSalud}
                                    onChange={(e) => setSubtipoSalud(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 mb-3"
                                >
                                    <option value="">Selecciona subtipo</option>
                                    <option value="enfermedad_certificada">Enfermedad certificada</option>
                                    <option value="atencion_medica_familiar">Atención médica / salud familiar</option>
                                </select>

                                <label className="block text-sm font-medium text-gray-700 mb-2">Duración</label>
                                <select
                                    value={saludDuracionTipo}
                                    onChange={(e) => setSaludDuracionTipo(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="dias">Días</option>
                                    <option value="horas">Horas</option>
                                </select>
                                {healthCertificationNote && (
                                    <div
                                        className={`rounded-lg border p-3 ${healthCertificationNote.tone === "amber"
                                            ? "border-amber-300 bg-amber-50"
                                            : "border-blue-200 bg-blue-50"
                                            }`}
                                    >
                                        <p
                                            className={`text-xs font-semibold ${healthCertificationNote.tone === "amber"
                                                ? "text-amber-900"
                                                : "text-blue-900"
                                                }`}
                                        >
                                            {healthCertificationNote.title}
                                        </p>
                                        <p
                                            className={`text-xs mt-1 ${healthCertificationNote.tone === "amber"
                                                ? "text-amber-800"
                                                : "text-blue-800"
                                                }`}
                                        >
                                            {healthCertificationNote.body}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {canBeRecoverableByRule() && (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold text-emerald-900">Plan de recuperación (opcional y editable con tu jefe)</p>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        className="text-xs px-2 py-1"
                                        disabled={isRecoveryPlanComplete}
                                        onClick={() =>
                                            setRecoveryPlanRows((prev) => [
                                                ...prev,
                                                { date: "", start_time: "", end_time: "", notes: "" },
                                            ])
                                        }
                                    >
                                        {isRecoveryPlanComplete ? "Límite alcanzado" : "+ Tramo"}
                                    </Button>
                                </div>

                                {recoveryPlanRows.length === 0 ? (
                                    <p className="text-xs text-emerald-800">
                                        Puedes dejarlo vacío ahora y coordinarlo luego. Ejemplo: 30 minutos diarios por varios días.
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {recoveryPlanRows.map((row, idx) => {
                                            const computedHours = computeRecoveryHours(row.start_time, row.end_time);
                                            return (
                                                <div key={`recovery-row-${idx}`} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end rounded-md border border-emerald-200 bg-white p-2">
                                                    <div className="sm:col-span-3">
                                                        <label className="block text-[11px] text-gray-600">Fecha</label>
                                                        <input
                                                            type="date"
                                                            value={row.date || ""}
                                                            onChange={(e) =>
                                                                setRecoveryPlanRows((prev) =>
                                                                    prev.map((it, itIdx) =>
                                                                        itIdx === idx ? { ...it, date: e.target.value } : it
                                                                    )
                                                                )
                                                            }
                                                            className="w-full px-2 py-1.5 border border-gray-300 rounded"
                                                        />
                                                    </div>
                                                    <div className="sm:col-span-2">
                                                        <label className="block text-[11px] text-gray-600">Inicio</label>
                                                        <input
                                                            type="time"
                                                            value={row.start_time || ""}
                                                            onChange={(e) =>
                                                                setRecoveryPlanRows((prev) =>
                                                                    prev.map((it, itIdx) =>
                                                                        itIdx === idx ? { ...it, start_time: e.target.value } : it
                                                                    )
                                                                )
                                                            }
                                                            className="w-full px-2 py-1.5 border border-gray-300 rounded"
                                                        />
                                                    </div>
                                                    <div className="sm:col-span-2">
                                                        <label className="block text-[11px] text-gray-600">Fin</label>
                                                        <input
                                                            type="time"
                                                            value={row.end_time || ""}
                                                            onChange={(e) =>
                                                                setRecoveryPlanRows((prev) =>
                                                                    prev.map((it, itIdx) =>
                                                                        itIdx === idx ? { ...it, end_time: e.target.value } : it
                                                                    )
                                                                )
                                                            }
                                                            className="w-full px-2 py-1.5 border border-gray-300 rounded"
                                                        />
                                                    </div>
                                                    <div className="sm:col-span-3">
                                                        <label className="block text-[11px] text-gray-600">Notas</label>
                                                        <input
                                                            type="text"
                                                            value={row.notes || ""}
                                                            onChange={(e) =>
                                                                setRecoveryPlanRows((prev) =>
                                                                    prev.map((it, itIdx) =>
                                                                        itIdx === idx ? { ...it, notes: e.target.value } : it
                                                                    )
                                                                )
                                                            }
                                                            className="w-full px-2 py-1.5 border border-gray-300 rounded"
                                                            placeholder="Ej: recuperación diaria"
                                                        />
                                                    </div>
                                                    <div className="sm:col-span-1 text-center">
                                                        <p className="text-[11px] text-gray-600">h</p>
                                                        <p className="text-xs font-semibold text-emerald-700">{computedHours || "-"}</p>
                                                    </div>
                                                    <div className="sm:col-span-1">
                                                        <Button
                                                            type="button"
                                                            variant="secondary"
                                                            className="w-full text-xs px-2 py-1"
                                                            onClick={() =>
                                                                setRecoveryPlanRows((prev) => prev.filter((_, itIdx) => itIdx !== idx))
                                                            }
                                                        >
                                                            X
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <p className="text-xs text-emerald-800">
                                            Total planificado: <strong>{plannedRecoveryHours}h</strong>
                                            {requestedHours > 0 ? ` / ${requestedHours}h solicitadas` : ""}
                                        </p>
                                        {isRecoveryPlanComplete && (
                                            <p className="text-xs text-emerald-700">
                                                Ya alcanzaste las horas solicitadas. No puedes agregar más tramos.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {usesSimplifiedHours ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Fecha</label>
                                    <input
                                        type="date"
                                        value={simplifiedStartDate}
                                        onChange={(e) => {
                                            const nextDate = e.target.value;
                                            const nextStartDateTime = mergeDateAndTime(nextDate, simplifiedStartTime || "08:00");
                                            setFormData((prev) => ({
                                                ...prev,
                                                fecha_inicio: nextDate,
                                                fecha_inicio_hora: nextStartDateTime,
                                            }));
                                        }}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        required
                                        disabled={requiresActiveEnrollmentSelection}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Hora inicio</label>
                                    <input
                                        type="time"
                                        step="900"
                                        value={simplifiedStartTime}
                                        onChange={(e) => {
                                            const nextTime = e.target.value;
                                            const baseDate = simplifiedStartDate || extractDatePart(formData.fecha_inicio) || "";
                                            const nextStartDateTime = mergeDateAndTime(baseDate, nextTime);
                                            setFormData((prev) => ({
                                                ...prev,
                                                fecha_inicio: baseDate || prev.fecha_inicio,
                                                fecha_inicio_hora: nextStartDateTime,
                                            }));
                                        }}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        required
                                        disabled={requiresActiveEnrollmentSelection}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Duración (horas)</label>
                                    <select
                                        value={formData.duracion_horas || ""}
                                        onChange={(e) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                duracion_horas: e.target.value,
                                            }))
                                        }
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                                        required
                                        disabled={requiresActiveEnrollmentSelection}
                                    >
                                        <option value="">Selecciona duración</option>
                                        {simplifiedHourOptions.map((hoursOption) => (
                                            <option key={hoursOption} value={hoursOption}>
                                                {hoursOption} h
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Fecha/hora fin (automática)</label>
                                    <input
                                        type="text"
                                        value={computedEndValue ? formatDisplayDate(computedEndValue) : ""}
                                        className="w-full px-4 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-700"
                                        readOnly
                                        disabled
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Fecha desde</label>
                                    <input
                                        type={usesDateTime ? "datetime-local" : "date"}
                                        value={startValue}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setFormData((prev) => ({
                                                ...prev,
                                                ...(usesDateTime
                                                    ? { fecha_inicio_hora: value, fecha_inicio: extractDatePart(value) }
                                                    : { fecha_inicio: value }),
                                            }));
                                        }}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        required
                                        disabled={requiresActiveEnrollmentSelection}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Fecha hasta</label>
                                    <input
                                        type={usesDateTime ? "datetime-local" : "date"}
                                        value={endValue}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                ...(usesDateTime
                                                    ? { fecha_fin_hora: e.target.value, fecha_fin: extractDatePart(e.target.value) }
                                                    : { fecha_fin: e.target.value }),
                                            })
                                        }
                                        min={startValue || undefined}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        required
                                        disabled={requiresActiveEnrollmentSelection}
                                    />
                                </div>
                            </div>
                        )}
                        {usesDateTime && invalidDateRange && (
                            <p className="text-xs text-red-600">La fecha/hora de fin debe ser posterior a la de inicio.</p>
                        )}
                        {crossesDayInSimplifiedHours && (
                            <p className="text-xs text-red-600">El permiso debe iniciar y terminar el mismo día.</p>
                        )}

                        {!usesSimplifiedHours && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {usesHoras
                                        ? (isAutoHours ? "Horas (calculadas automáticamente)" : "Horas")
                                        : ((tipoPermiso === "salud" || tipoPermiso === "calamidad")
                                            ? "Días (calculados automáticamente)"
                                            : "Días")}
                                </label>
                                <input
                                    type="number"
                                    step={usesHoras ? "0.5" : "1"}
                                    value={usesHoras ? formData.duracion_horas : formData.duracion_dias}
                                    onChange={(e) => !isAutoHours &&
                                        setFormData({
                                            ...formData,
                                            [usesHoras ? "duracion_horas" : "duracion_dias"]: e.target.value,
                                        })
                                    }
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    required
                                    readOnly={isAutoHours || requiresActiveEnrollmentSelection || (tipoPermiso === "salud" && saludDuracionTipo === "dias")}
                                    disabled={requiresActiveEnrollmentSelection}
                                    min="0.5"
                                    max={tipoPermiso === "estudios" ? "3" : tipoPermiso === "personal" ? "2" : "30"}
                                />
                            </div>
                        )}
                        {usesSimplifiedHours && (
                            <p className="text-xs text-gray-500">
                                El sistema calculará automáticamente la fecha/hora de fin a partir de la hora de inicio y la duración indicada.
                            </p>
                        )}
                        {tipoPermiso === "salud" && saludDuracionTipo === "dias" && (
                            <p className="text-xs text-gray-500">
                                El sistema calculará automáticamente los días del permiso a partir de la fecha de inicio y la fecha de fin.
                            </p>
                        )}
                        {tipoPermiso === "calamidad" && calamidadDuracionTipo === "dias" && (
                            <p className="text-xs text-gray-500">
                                El sistema calculará automáticamente los días del permiso a partir de la fecha de inicio y la fecha de fin.
                            </p>
                        )}
                        {exceedsPermisoHourLimit && (
                            <p className="text-xs text-red-600">
                                {tipoPermiso === "estudios"
                                    ? "Límite excedido: por estudios solo se permiten hasta 3 horas."
                                    : "Límite excedido: por asuntos personales solo se permiten hasta 2 horas."}
                            </p>
                        )}

                        {requiresActiveEnrollmentSelection && (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <p className="text-xs text-amber-800">
                                    Debes seleccionar una matrícula <strong>activa</strong> para habilitar el llenado de la solicitud por estudios.
                                </p>
                            </div>
                        )}

                        {(tipoPermiso === "salud" || tipoPermiso === "calamidad") && (
                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-xs text-blue-700">
                                    <strong>Nota:</strong> Este tipo de permiso puede requerir justificación documental.
                                </p>
                            </div>
                        )}
                        {(tipoPermiso === "estudios" || tipoPermiso === "personal") && (
                            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                                <p className="text-xs text-emerald-700">
                                    <strong>Flujo:</strong> Este permiso pasa a aprobación definitiva sin etapa de justificación parcial.
                                </p>
                            </div>
                        )}

                        <div className="flex gap-3 pt-4">
                            <Button type="button" variant="secondary" onClick={() => setStep(1)} className="flex-1">
                                Atrás
                            </Button>
                            <Button
                                type="button"
                                variant="primary"
                                onClick={() => setStep(3)}
                                className="flex-1"
                                disabled={
                                    !tipoPermiso ||
                                    (isSalud && !subtipoSalud) ||
                                    (tipoPermiso === "calamidad" && !subtipoCalamidad.trim()) ||
                                    !hasDates ||
                                    !hasDuration ||
                                    invalidDateRange ||
                                    crossesDayInSimplifiedHours ||
                                    exceedsPermisoHourLimit ||
                                    (needsEnrollment && !selectedStudyEnrollmentId)
                                }
                            >
                                Continuar
                            </Button>
                        </div>
                    </>
                )}
            </div>
        );
    };

    const renderVacacionesForm = () => {
        const days = calculateDays();
        const toNumber = (value) => {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : 0;
        };

        const summaryRemaining = vacationSummary?.remaining;
        const summaryAllowance = vacationSummary?.allowance ?? 0;
        const summaryTaken = vacationSummary?.approved ?? vacationSummary?.taken ?? 0;
        const summaryPending = vacationSummary?.pending ?? 0;
        const summaryRejected = vacationSummary?.rejected ?? 0;
        const summaryRequested = vacationSummary?.requested ?? 0;
        const summaryCancelled = vacationSummary?.cancelled ?? 0;
        const baseRemaining = summaryRemaining !== undefined && summaryRemaining !== null
            ? toNumber(summaryRemaining)
            : toNumber(summaryAllowance) - toNumber(summaryTaken) - toNumber(summaryPending);
        const isAdvanceRequest = vacationSummary?.eligible === false && !vacationSummary?.missing_hire_date;
        const summaryHasUsage =
            vacationSummary &&
            vacationSummary.taken !== undefined &&
            vacationSummary.pending !== undefined;
        const remaining = summaryHasUsage
            ? (isAdvanceRequest ? baseRemaining : Math.max(0, baseRemaining))
            : (isAdvanceRequest
                ? baseRemaining - approvedVacationDays - pendingVacationDays
                : Math.max(0, baseRemaining - approvedVacationDays - pendingVacationDays));
        const usedDisplay = summaryHasUsage ? toNumber(summaryTaken) : approvedVacationDays;
        const requestedDisplay = summaryHasUsage ? toNumber(summaryRequested) : requestedVacationDays;
        const rejectedDisplay = summaryHasUsage ? toNumber(summaryRejected) : rejectedVacationDays;
        const cancelledDisplay = summaryHasUsage ? toNumber(summaryCancelled) : cancelledVacationDays;
        const remainingVacationDisplay = formatVacationDaysHours(remaining);
        const requestedVacationDisplay = formatVacationDaysHours(requestedDisplay);
        const approvedVacationDisplay = formatVacationDaysHours(usedDisplay);
        const rejectedVacationDisplay = formatVacationDaysHours(rejectedDisplay);
        const cancelledVacationDisplay = formatVacationDaysHours(cancelledDisplay);
        const hasDates = formData.fecha_inicio && (vacacionMedioDia || formData.fecha_fin);
        const hasVacationTimeRange = !vacacionMedioDia || (formData.vacation_start_time && formData.vacation_end_time);
        const allowMissingHireDate = vacationSummary?.missing_hire_date;
        const canSubmit = days > 0 && hasDates && hasVacationTimeRange && (allowMissingHireDate || isAdvanceRequest || days <= remaining);

        return (
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Solicitud de Vacaciones</h3>

                {vacationSummary && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="p-3 bg-green-50 rounded-lg text-center">
                            <p className="text-xs text-green-600 font-medium">Disponibles</p>
                            <p className="text-xl font-bold text-green-700">{remainingVacationDisplay.shortText}</p>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg text-center">
                            <p className="text-xs text-blue-600 font-medium">Solicitados</p>
                            <p className="text-xl font-bold text-blue-700">{requestedVacationDisplay.shortText}</p>
                        </div>
                        <div className="p-3 bg-amber-50 rounded-lg text-center">
                            <p className="text-xs text-amber-600 font-medium">Aprobados</p>
                            <p className="text-xl font-bold text-amber-700">{approvedVacationDisplay.shortText}</p>
                        </div>
                        <div className="p-3 bg-rose-50 rounded-lg text-center">
                            <p className="text-xs text-rose-600 font-medium">Rechazados</p>
                            <p className="text-xl font-bold text-rose-700">{rejectedVacationDisplay.shortText}</p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg text-center">
                            <p className="text-xs text-slate-600 font-medium">Cancelados</p>
                            <p className="text-xl font-bold text-slate-700">{cancelledVacationDisplay.shortText}</p>
                        </div>
                    </div>
                )}

                {vacationSummary && !allowMissingHireDate && !isAdvanceRequest && remaining <= 3 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-xs text-amber-700">
                            Estás cerca de completar tus vacaciones. Te quedan{" "}
                            <strong>{remainingVacationDisplay.text}</strong> disponibles.
                        </p>
                    </div>
                )}

                {isAdvanceRequest && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-700">
                            Aun no cumples un año de trabajo. Puedes solicitar vacaciones adelantadas y el saldo se
                            acreditara/descontara cuando cumplas el año ({vacationSummary?.eligible_from || "fecha de aniversario"}).
                        </p>
                    </div>
                )}

                {vacationSummary?.missing_hire_date && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-xs text-amber-700">
                            Falta registrar la <strong>fecha de ingreso</strong> en tu perfil.
                            Puedes enviar la solicitud, pero Talento Humano debe completar ese dato
                            para calcular correctamente tus vacaciones.
                        </p>
                    </div>
                )}

                <div className="flex items-center gap-2">
                    <input
                        id="vacacion-medio-dia"
                        type="checkbox"
                        checked={vacacionMedioDia}
                        onChange={(e) => setVacacionMedioDia(e.target.checked)}
                        className="h-4 w-4 text-emerald-600 border-gray-300 rounded"
                    />
                    <label htmlFor="vacacion-medio-dia" className="text-sm text-gray-700">
                        Medio di­a (4h)
                    </label>
                </div>

                {vacacionMedioDia && (
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Hora inicio *</label>
                            <input
                                type="time"
                                value={formData.vacation_start_time}
                                onChange={(e) => setFormData((prev) => ({ ...prev, vacation_start_time: e.target.value }))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Hora fin *</label>
                            <input
                                type="time"
                                value={formData.vacation_end_time}
                                onChange={(e) => setFormData((prev) => ({ ...prev, vacation_end_time: e.target.value }))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                required
                            />
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de Inicio *</label>
                        <input
                            type="date"
                            value={formData.fecha_inicio}
                            onChange={(e) => {
                                const value = e.target.value;
                                setFormData((prev) => ({
                                    ...prev,
                                    fecha_inicio: value,
                                    ...(vacacionMedioDia ? { fecha_fin: value } : {}),
                                }));
                            }}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de Fin *</label>
                        <input
                            type="date"
                            value={vacacionMedioDia ? formData.fecha_inicio : formData.fecha_fin}
                            onChange={(e) => setFormData({ ...formData, fecha_fin: e.target.value })}
                            min={formData.fecha_inicio}
                            disabled={vacacionMedioDia}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Período</label>
                    <input
                        type="text"
                        value={formData.periodo_vacaciones}
                        onChange={(e) => setFormData({ ...formData, periodo_vacaciones: e.target.value })}
                        placeholder="2024"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                </div>

                {days > 0 && (
                    <div
                        className={`p-4 border rounded-lg ${canSubmit ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
                            }`}
                    >
                        <p className={`text-sm font-medium ${canSubmit ? "text-emerald-900" : "text-red-900"}`}>
                            Días solicitados: <span className="text-lg font-bold">{vacacionMedioDia ? "0.5 (4h)" : days}</span>
                        </p>
                        <p className={`text-xs ${canSubmit ? "text-emerald-700" : "text-red-700"}`}>
                            {canSubmit
                                ? `Quedarían ${formatVacationDaysHours(remaining - days).text} disponibles`
                                : `No tienes suficientes días. Solo tienes ${remainingVacationDisplay.text} disponibles.`}
                        </p>
                    </div>
                )}

                <div className="flex gap-3 pt-4">
                    <Button type="button" variant="secondary" onClick={() => setStep(1)} className="flex-1">
                        Atrás
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        onClick={() => setStep(3)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                        disabled={!canSubmit}
                    >
                        Continuar
                    </Button>
                </div>
            </div>
        );
    };

    const renderStep3 = () => {
        const usesDateTime =
            tipoSolicitud === "permiso" && usesPermisoDateTime(tipoPermiso, saludDuracionTipo, calamidadDuracionTipo);
        const startValue = usesDateTime ? formData.fecha_inicio_hora : formData.fecha_inicio;
        const endValue = usesDateTime ? formData.fecha_fin_hora : formData.fecha_fin;
        const vacationTimeRange =
            tipoSolicitud === "vacaciones" && formData.vacation_start_time && formData.vacation_end_time
                ? `${formData.vacation_start_time} - ${formData.vacation_end_time}`
                : "";
        const vacationShiftLabel =
            tipoSolicitud === "vacaciones"
                ? getVacationShiftLabel(formData.vacation_start_time, formData.vacation_end_time)
                : "";
        return (
            <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Confirmar Solicitud</h3>

            <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Tipo:</span>
                    <span className="text-sm font-semibold text-gray-900">
                        {tipoSolicitud === "vacaciones" ? "Vacaciones" : `Permiso por ${tipoPermiso}`}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Fecha inicio:</span>
                    <span className="text-sm font-semibold text-gray-900">{formatDisplayDate(startValue)}</span>
                </div>
                {endValue && (
                    <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Fecha fin:</span>
                        <span className="text-sm font-semibold text-gray-900">{formatDisplayDate(endValue)}</span>
                    </div>
                )}
                {vacationTimeRange && (
                    <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Rango horario:</span>
                        <span className="text-sm font-semibold text-gray-900">{vacationTimeRange}</span>
                    </div>
                )}
                {vacationShiftLabel && (
                    <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Jornada:</span>
                        <span className="text-sm font-semibold text-gray-900">{vacationShiftLabel}</span>
                    </div>
                )}
                <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Duración:</span>
                    <span className="text-sm font-semibold text-gray-900">
                        {tipoSolicitud === "vacaciones"
                            ? vacacionMedioDia
                                ? "0.5 días (4h)"
                                : `${calculateDays()} días`
                            : formData.duracion_horas
                                ? `${formData.duracion_horas} horas`
                                : `${formData.duracion_dias} días`}
                    </span>
                </div>
            </div>

            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg space-y-2">
                <p className="text-xs text-indigo-800">
                    <strong>Consentimiento FamSign:</strong> Al enviar esta solicitud aceptas el uso de la firma electronica
                    FamSign para registrar la firma del solicitante y la decision final del jefe inmediato.
                </p>
                <p className="text-xs text-indigo-700">
                    Este consentimiento queda registrado en la trazabilidad legal de la solicitud
                    (evento de firma, sello temporal e integridad criptografica).
                </p>
            </div>

            <div className="flex gap-3 pt-4">
                <Button type="button" variant="secondary" onClick={() => setStep(2)} className="flex-1">
                    Atrás
                </Button>
                <Button
                    type="button"
                    variant="primary"
                    onClick={handleSubmit}
                    className="flex-1"
                    disabled={loading}
                >
                    {loading ? "Enviando..." : "Enviar Solicitud"}
                </Button>
            </div>
        </div>
        );
    };

    if (!open) return null;

    return (
        <AnimatePresence>
            {open && (
                <Dialog open={open} onClose={handleClose} className="fixed inset-0 z-50">
                    <LoadingOverlay
                        message={
                            loading
                                ? "Enviando solicitud..."
                                : submittingStudyEnrollment
                                    ? "Enviando matrícula para validación..."
                                    : ""
                        }
                    />
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center px-4 py-6 sm:px-6">
                            <Dialog.Panel className="w-full max-w-3xl">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="overflow-hidden rounded-2xl bg-white shadow-2xl"
                                >
                                    <div className="flex items-center justify-between gap-3 border-b px-6 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-100 rounded-lg">
                                                <FiFileText className="w-6 h-6 text-indigo-600" />
                                            </div>
                                            <div>
                                                <h2 className="text-xl font-bold text-gray-900">Nueva Solicitud</h2>
                                                <p className="text-sm text-gray-500">Permisos y Vacaciones</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleClose}
                                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                            disabled={loading}
                                        >
                                            <FiX className="w-5 h-5 text-gray-500" />
                                        </button>
                                    </div>
                                    <div className="p-6">
                                        {renderStepIndicator()}
                                        {step === 1 && renderStep1()}
                                        {step === 2 && renderStep2()}
                                        {step === 3 && renderStep3()}
                                    </div>
                                </motion.div>
                            </Dialog.Panel>
                        </div>
                    </div>
                </Dialog>
            )}
        </AnimatePresence>
    );
};

export default PermisoVacacionModal;
