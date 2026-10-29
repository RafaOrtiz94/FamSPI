import {
  resolveAttendanceActionKey,
  getAttendanceActionLabel,
  getAttendanceNextStepHint,
  resolveAttendanceIntentKey,
  resolveAttendanceFlowStep,
  resolveAttendanceShortcutIntent,
  resolveAttendancePendingActions,
  validateOperationalCategoryStep,
  isOperationalExitCategory,
  isTeleworkCategory,
  validateOperationalDestinationStep,
  validateOperationalVehicleStart,
  validateOperationalVehicleClosure,
  buildOperationalStartPayload,
  buildOperationalClosurePayload,
  buildOperationalTripClosePayload,
} from "../attendanceFlowUtils";

describe("attendanceFlowUtils - action map", () => {
  test("resolves aliases to the same canonical key", () => {
    expect(resolveAttendanceActionKey("almuerzo-salida")).toBe("almuerzo-salida");
    expect(resolveAttendanceActionKey("salida-almuerzo")).toBe("almuerzo-salida");
    expect(resolveAttendanceActionKey("almuerzo")).toBe("almuerzo-salida");
  });

  test("resolves backend canonical keys (visita-entrada/visita-salida) to the same UI meta as the frontend aliases", () => {
    expect(resolveAttendanceActionKey("visita-entrada")).toBe(resolveAttendanceActionKey("cliente-entrada"));
    expect(resolveAttendanceActionKey("visita-salida")).toBe(resolveAttendanceActionKey("cliente-salida"));
  });

  test("returns fallback label for unknown action", () => {
    expect(getAttendanceActionLabel("no-existe", "Fallback")).toBe("Fallback");
  });

  test("returns generic hint for unknown action", () => {
    expect(getAttendanceNextStepHint("no-existe")).toBe("Continúa con la siguiente marcación de tu flujo.");
  });
});

describe("attendanceFlowUtils - shortcut intents", () => {
  test("resolves known intent keys", () => {
    expect(resolveAttendanceIntentKey("iniciar-jornada")).toBe("iniciar-jornada");
    expect(resolveAttendanceIntentKey("no-existe")).toBeNull();
  });

  test("maps iniciar-jornada to permission start when a permission is active at day start", () => {
    const result = resolveAttendanceShortcutIntent({
      rawIntent: "iniciar-jornada",
      attendanceData: {
        canonical_flow: {
          flow_kind: "time_off",
          current_step: "time_off_pending_departure",
          next_step: "permission-entry-start",
          allowed_actions: ["permission-entry-start", "entrada"],
          context_flags: { has_active_time_off: true },
        },
      },
    });
    expect(result.isAvailable).toBe(true);
    expect(result.resolvedActionKey).toBe("permission-entry-start");
  });

  test("maps continuar-jornada to lunch out on a normal morning", () => {
    const result = resolveAttendanceShortcutIntent({
      rawIntent: "continuar-jornada",
      attendanceData: {
        canonical_flow: {
          flow_kind: "regular",
          current_step: "working_morning",
          next_step: "almuerzo-salida",
          allowed_actions: ["almuerzo-salida", "salida-oficina", "salida"],
          context_flags: { has_entry: true },
        },
      },
    });
    expect(result.isAvailable).toBe(true);
    expect(result.resolvedActionKey).toBe("almuerzo-salida");
  });

  test("maps gestionar-permiso-activo to permission finish when a permission exception is in progress", () => {
    const result = resolveAttendanceShortcutIntent({
      rawIntent: "gestionar-permiso-activo",
      attendanceData: {
        canonical_flow: {
          flow_kind: "permission",
          current_step: "permission_in_progress",
          next_step: "permission-exit-finish",
          allowed_actions: ["permission-exit-finish"],
          context_flags: { has_active_permission_exception: true },
        },
      },
    });
    expect(result.isAvailable).toBe(true);
    expect(result.resolvedActionKey).toBe("permission-exit-finish");
  });
});

describe("attendanceFlowUtils - resolveAttendanceFlowStep", () => {
  test("returns idle defaults when canonical_flow is missing", () => {
    const step = resolveAttendanceFlowStep(null);
    expect(step.flowKind).toBe("none");
    expect(step.nextActionKey).toBeNull();
    expect(step.allowedActions).toEqual([]);
  });

  test("maps next_step/allowed_actions from the backend envelope to labeled entries", () => {
    const step = resolveAttendanceFlowStep({
      flow_kind: "regular",
      current_step: "working_morning",
      next_step: "almuerzo-salida",
      allowed_actions: ["almuerzo-salida", "salida-oficina", "salida"],
      context_flags: { has_entry: true },
    });
    expect(step.nextActionKey).toBe("almuerzo-salida");
    expect(step.nextStepLabel).toBe("Salida a almuerzo");
    expect(step.allowedActions.map((a) => a.key)).toEqual(["almuerzo-salida", "salida-oficina", "salida"]);
    expect(step.contextFlags.has_entry).toBe(true);
  });
});

describe("attendanceFlowUtils - resolveAttendancePendingActions", () => {
  const now = new Date("2026-07-07T15:00:00.000Z");

  test("returns no pending items on a clean idle day", () => {
    const pending = resolveAttendancePendingActions({ canonical_flow: { context_flags: {} } }, now);
    expect(pending).toEqual([]);
  });

  test("flags an open operational exit", () => {
    const pending = resolveAttendancePendingActions(
      { canonical_flow: { context_flags: { has_active_operational: true } } },
      now,
    );
    expect(pending.some((item) => item.id === "operational_open")).toBe(true);
  });

  test("uses the dedicated close action for active telework", () => {
    const pending = resolveAttendancePendingActions(
      { canonical_flow: { context_flags: { has_active_operational: true } } },
      now,
      { operational_category: "teletrabajo", uses_personal_vehicle: false },
    );
    const item = pending.find((entry) => entry.id === "operational_open");
    expect(item.label).toBe("Teletrabajo activo");
    expect(item.actionKey).toBe("entrada-oficina");
  });

  test("prioritizes regular lunch actions for telework started during work hours", () => {
    const attendanceData = {
      lunch_start_time: null,
      lunch_end_time: null,
      canonical_flow: { context_flags: { has_active_operational: true } },
    };
    const activeException = {
      operational_category: "teletrabajo",
      canonical_flow: { context_flags: { telework_requires_lunch: true } },
    };
    const pending = resolveAttendancePendingActions(attendanceData, now, activeException);
    const item = pending.find((entry) => entry.id === "operational_open");
    expect(item.label).toBe("Salida a almuerzo pendiente");
    expect(item.actionKey).toBe("almuerzo-salida");
  });

  test("adds a viatico-expected notice only when the active exception used a personal vehicle", () => {
    const attendanceData = { canonical_flow: { context_flags: { has_active_operational: true } } };
    const withoutVehicle = resolveAttendancePendingActions(attendanceData, now, { uses_personal_vehicle: false });
    const withVehicle = resolveAttendancePendingActions(attendanceData, now, { uses_personal_vehicle: true });
    expect(withoutVehicle.some((item) => item.id === "viatico_expected")).toBe(false);
    expect(withVehicle.some((item) => item.id === "viatico_expected")).toBe(true);
  });

  test("flags lunch overdue past the tolerance window", () => {
    const attendanceData = {
      lunch_start_time: "2026-07-07T13:00:00.000Z", // 2h before `now`
      canonical_flow: { context_flags: {} },
    };
    const pending = resolveAttendancePendingActions(attendanceData, now);
    expect(pending.some((item) => item.id === "lunch_overdue")).toBe(true);
  });

  test("does not flag lunch overdue within the tolerance window", () => {
    const attendanceData = {
      lunch_start_time: "2026-07-07T14:50:00.000Z", // 10min before `now`
      canonical_flow: { context_flags: {} },
    };
    const pending = resolveAttendancePendingActions(attendanceData, now);
    expect(pending.some((item) => item.id === "lunch_overdue")).toBe(false);
  });

  test("flags an extended open shift, but not while an operational exit is active", () => {
    const longShiftData = {
      entry_time: "2026-07-07T03:00:00.000Z", // 12h before `now`
      canonical_flow: { context_flags: {} },
    };
    const pending = resolveAttendancePendingActions(longShiftData, now);
    expect(pending.some((item) => item.id === "long_open_shift")).toBe(true);

    const whileOperational = resolveAttendancePendingActions(
      { ...longShiftData, canonical_flow: { context_flags: { has_active_operational: true } } },
      now,
    );
    expect(whileOperational.some((item) => item.id === "long_open_shift")).toBe(false);
  });
});

// Mitigacion D1: estas 3 funciones son la regla de negocio que hoy vive
// duplicada (con nombres de variable distintos) en
// AttendanceWidget.submitOperationalModal y
// AttendanceAction.handleManualClientSubmit. Sirven de contrato para que
// cualquier refactor futuro de esos dos componentes no cambie el comportamiento.
describe("attendanceFlowUtils - operational step validation (shared rule, D1 mitigation)", () => {
  test("category is required to start an operational exit", () => {
    expect(validateOperationalCategoryStep("")).toEqual({
      ok: false,
      error: "Selecciona el tipo de salida.",
    });
    expect(validateOperationalCategoryStep("cliente")).toEqual({ ok: true, error: null });
    expect(validateOperationalCategoryStep("teletrabajo")).toEqual({ ok: true, error: null });
    expect(isOperationalExitCategory("operacional")).toBe(true);
    expect(isOperationalExitCategory("teletrabajo")).toBe(false);
    expect(isTeleworkCategory("teletrabajo")).toBe(true);
    expect(isTeleworkCategory("operacional")).toBe(false);
  });

  test("every operational exit requires a city and field exits also require a destination", () => {
    expect(validateOperationalDestinationStep({ category: "teletrabajo" })).toEqual({
      ok: false,
      error: "Selecciona o busca la ciudad de la salida.",
    });
    expect(validateOperationalDestinationStep({ category: "teletrabajo", destinationCity: "Quito" })).toEqual({ ok: true, error: null });
    expect(validateOperationalDestinationStep({ category: "operacional", visitType: "cronograma" })).toEqual({
      ok: false,
      error: "Selecciona el cliente del cronograma.",
    });
    expect(validateOperationalDestinationStep({
      category: "operacional",
      visitType: "prospecto",
      destinationLabel: "Prospecto ABC",
      destinationCity: "Quito",
    })).toEqual({ ok: true, error: null });
  });

  test("vehicle start requires km and photo only when using a personal vehicle", () => {
    expect(validateOperationalVehicleStart({ usesPersonalVehicle: false })).toEqual({ ok: true, error: null });
    expect(
      validateOperationalVehicleStart({ usesPersonalVehicle: true, startKm: "", startPhoto: null }),
    ).toEqual({ ok: false, error: "Debes registrar el kilometraje inicial." });
    expect(
      validateOperationalVehicleStart({ usesPersonalVehicle: true, startKm: "100", startPhoto: null }),
    ).toEqual({ ok: false, error: "Debes tomar la foto del kilometraje inicial." });
    expect(
      validateOperationalVehicleStart({ usesPersonalVehicle: true, startKm: "100", startPhoto: "file.jpg" }),
    ).toEqual({ ok: true, error: null });
  });

  test("vehicle closure requires km and photo only when the active exit used a personal vehicle", () => {
    expect(validateOperationalVehicleClosure({ requiresClosure: false })).toEqual({ ok: true, error: null });
    expect(
      validateOperationalVehicleClosure({ requiresClosure: true, endKm: "", endPhoto: null }),
    ).toEqual({ ok: false, error: "Debes registrar el kilometraje final." });
    expect(
      validateOperationalVehicleClosure({ requiresClosure: true, endKm: "150", endPhoto: null }),
    ).toEqual({ ok: false, error: "Debes tomar la foto del kilometraje final." });
    expect(
      validateOperationalVehicleClosure({ requiresClosure: true, endKm: "150", endPhoto: "file.jpg" }),
    ).toEqual({ ok: true, error: null });
  });
});

// Mitigacion D1 (segundo tramo): estos builders son la forma exacta de payload
// que hoy arma cada componente por su cuenta antes de llamar a
// marcarSalidaOficina/marcarEntradaOficina/marcarCierreViaje. Fijar el shape
// aqui evita que un componente mande un campo y el otro no sin que nadie lo note.
describe("attendanceFlowUtils - operational payload builders (shared shape, D1 mitigation)", () => {
  test("start payload falls back to a default description when blank", () => {
    expect(
      buildOperationalStartPayload({
        description: "  ",
        category: "cliente",
        usesPersonalVehicle: true,
        startKm: "100",
        startPhoto: "foto.jpg",
        destinationLabel: "Cliente ABC",
        destinationCity: "Quito",
      }),
    ).toEqual({
      description: "Salida operacional de campo / oficina",
      operational_category: "cliente",
      uses_personal_vehicle: true,
      odometer_start_km: "100",
      start_odometer_photo: "foto.jpg",
      operational_destination_label: "Cliente ABC",
      operational_destination_city: "Quito",
    });
  });

  test("start payload keeps a real description and coerces vehicle flag to boolean", () => {
    expect(
      buildOperationalStartPayload({
        description: "Reunion con proveedor",
        category: "proveedor",
        usesPersonalVehicle: "si", // AttendanceAction guarda este campo como string "si"/"no"
        startKm: "",
        startPhoto: null,
        destinationLabel: "Banco Pichincha",
        destinationCity: "Guayaquil",
      }),
    ).toEqual({
      description: "Reunion con proveedor",
      operational_category: "proveedor",
      uses_personal_vehicle: true,
      odometer_start_km: "",
      start_odometer_photo: null,
      operational_destination_label: "Banco Pichincha",
      operational_destination_city: "Guayaquil",
    });
  });

  test("telework payload uses a telework default description and no destination", () => {
    expect(buildOperationalStartPayload({
      category: "teletrabajo",
      usesPersonalVehicle: false,
      destinationLabel: "",
      destinationCity: "",
    })).toEqual({
      description: "Teletrabajo",
      operational_category: "teletrabajo",
      uses_personal_vehicle: false,
      odometer_start_km: undefined,
      start_odometer_photo: undefined,
      operational_destination_label: "",
      operational_destination_city: "",
    });
  });

  test("closure payload only carries odometer fields", () => {
    expect(buildOperationalClosurePayload({ endKm: "250", endPhoto: "foto2.jpg" })).toEqual({
      odometer_end_km: "250",
      end_odometer_photo: "foto2.jpg",
    });
  });

  test("trip close payload falls back to a default closure reason when blank", () => {
    expect(
      buildOperationalTripClosePayload({ closureReason: "", endKm: "300", endPhoto: "foto3.jpg" }),
    ).toEqual({
      closure_reason: "Cierre de viaje operacional",
      odometer_end_km: "300",
      end_odometer_photo: "foto3.jpg",
    });
  });

  test("trip close payload keeps a real closure reason", () => {
    expect(
      buildOperationalTripClosePayload({ closureReason: "Fin de ruta", endKm: "300", endPhoto: "foto3.jpg" }),
    ).toEqual({
      closure_reason: "Fin de ruta",
      odometer_end_km: "300",
      end_odometer_photo: "foto3.jpg",
    });
  });
});
