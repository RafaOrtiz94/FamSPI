const {
  POST_STATISTICS_SLA_HOURS,
  PARTICIPANT_ROLES,
  getPostStatisticsSla,
  getReminderCode,
  buildPersonalPendingTasks,
  isParticipantStageComplete,
} = require("../businessCaseWorkflowSla.service");

describe("business case workflow SLA", () => {
  test("uses the statistics upload timestamp and a single 48 hour deadline", () => {
    const sla = getPostStatisticsSla({
      determinations_gate: {
        document: { uploaded_at: "2026-07-22T10:00:00.000Z" },
      },
    });

    expect(sla.started_at).toBe("2026-07-22T10:00:00.000Z");
    expect(sla.deadline_at).toBe("2026-07-24T10:00:00.000Z");
    expect(POST_STATISTICS_SLA_HOURS).toBe(48);
  });

  test("increases reminder frequency as the 48 hour deadline approaches", () => {
    expect(getReminderCode(23.99)).toBeNull();
    expect(getReminderCode(24)).toBe("at_24h");
    expect(getReminderCode(36)).toBe("at_36h");
    expect(getReminderCode(42)).toBe("at_42h");
    expect(getReminderCode(46)).toBe("at_46h");
    expect(getReminderCode(47)).toBe("at_47h");
    expect(getReminderCode(48)).toBe("at_48h");
    expect(getReminderCode(54)).toBe("overdue_1");
  });

  test("keeps the required participant roles explicit", () => {
    expect(PARTICIPANT_ROLES).toEqual([
      "acp_comercial",
      "jefe_comercial",
      "jefe_servicio",
      "jefe_operaciones",
      "jefe_financiero",
      "jefe_ti",
      "contador",
    ]);
  });

  test("identifies the personal pending steps for jefe de servicio", () => {
    const tasks = buildPersonalPendingTasks({
      role: "jefe_servicio",
      metadata: {
        determinations_gate: {
          section_locks: {
            controles: false,
            calibradores: false,
            materiales: false,
          },
        },
        investments_cart: {
          acp_confirmed: true,
          service_confirmed: false,
        },
      },
      consumptionItems: [
        { item_type: "control", name: "Control B", annual_qty: 0 },
      ],
      investments: [{ selected: true, unit_price: null }],
    });

    expect(tasks.map((task) => task.key)).toEqual([
      "determinations_controles",
      "determinations_calibradores",
      "determinations_materiales",
      "service_investment_cart",
    ]);
    expect(tasks[0].detail).toContain("Control B");
  });

  test("excludes completed workflow stages from general reminders", () => {
    const metadata = {
      determinations_gate: {
        section_locks: {
          reactivos: true,
          controles: true,
          calibradores: true,
          materiales: true,
        },
      },
      investments_cart: {
        acp_confirmed: true,
        service_confirmed: true,
      },
      feasibility: {
        decision: { decided_at: "2026-07-23T10:00:00.000Z" },
      },
    };
    const investments = [{ selected: true, unit_price_financial: 100, unit_price: 120 }];

    expect(isParticipantStageComplete({ role: "acp_comercial", metadata, investments })).toBe(true);
    expect(isParticipantStageComplete({ role: "jefe_servicio", metadata, investments })).toBe(true);
    expect(isParticipantStageComplete({ role: "jefe_financiero", metadata, investments })).toBe(true);
    expect(isParticipantStageComplete({ role: "jefe_operaciones", metadata, investments })).toBe(true);
    expect(isParticipantStageComplete({ role: "jefe_comercial", metadata, investments })).toBe(true);
  });

  test("keeps a participant active while their stage is incomplete", () => {
    expect(isParticipantStageComplete({
      role: "jefe_servicio",
      metadata: {
        determinations_gate: {
          section_locks: {
            controles: true,
            calibradores: false,
            materiales: true,
          },
        },
        investments_cart: {
          acp_confirmed: true,
          service_confirmed: false,
        },
      },
      investments: [],
    })).toBe(false);
  });
});
