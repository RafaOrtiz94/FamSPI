jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const {
  computeProfileCompletion,
  _buildReportDocumentsByUser,
} = require("../collaborators.service");

describe("collaborators – computeProfileCompletion", () => {
  it("marca complete=false y done=0 con un perfil vacio", () => {
    const out = computeProfileCompletion({});
    expect(out.done).toBe(0);
    expect(out.complete).toBe(false);
    expect(out.total).toBeGreaterThan(0);
  });

  it("total es consistente entre corridas (PROFILE_PATHS fijo)", () => {
    const a = computeProfileCompletion({});
    const b = computeProfileCompletion({});
    expect(a.total).toBe(b.total);
  });
});

describe("collaborators - buildReportDocumentsByUser", () => {
  it("separa curriculum vitae de hoja de vida de talento humano", () => {
    const docsByUser = _buildReportDocumentsByUser([
      {
        id: 1,
        user_id: 10,
        doc_type: "HOJA_VIDA",
        drive_file_id: "legacy-hoja",
        drive_url: "https://drive/legacy-hoja",
        file_name: "hoja_legacy.pdf",
        created_at: "2026-03-01T00:00:00Z",
      },
      {
        id: 2,
        user_id: 10,
        doc_type: "HR_RESUME",
        drive_file_id: "hr-resume",
        drive_url: "https://drive/hr-resume",
        file_name: "hoja_th.pdf",
        created_at: "2026-02-01T00:00:00Z",
      },
      {
        id: 3,
        user_id: 10,
        doc_type: "CURRICULUM_VITAE",
        drive_file_id: "curriculum",
        drive_url: "https://drive/curriculum",
        file_name: "curriculum.pdf",
        created_at: "2026-04-01T00:00:00Z",
      },
    ]);

    expect(docsByUser[10].HR_RESUME.drive_file_id).toBe("hr-resume");
    expect(docsByUser[10].CURRICULUM_VITAE.drive_file_id).toBe("curriculum");
  });
});
