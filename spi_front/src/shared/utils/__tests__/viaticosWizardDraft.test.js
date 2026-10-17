import { saveStep1Draft, loadStep1Draft, clearStep1Draft } from "../viaticosWizardDraft";

describe("viaticosWizardDraft", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("saves and reloads a draft, dropping File objects", () => {
    const fakeFile = new File(["x"], "factura.pdf");
    saveStep1Draft(42, {
      txtContent: "raw-txt",
      invoiceRows: [{ access_key: "abc", category: "combustible", file: fakeFile }],
    });

    const draft = loadStep1Draft(42);
    expect(draft.txtContent).toBe("raw-txt");
    expect(draft.invoiceRows).toEqual([{ access_key: "abc", category: "combustible" }]);
  });

  test("returns null when there is no draft or it has no rows", () => {
    expect(loadStep1Draft(999)).toBeNull();
    saveStep1Draft(43, { txtContent: "x", invoiceRows: [] });
    expect(loadStep1Draft(43)).toBeNull();
  });

  test("clearStep1Draft removes only the targeted allowance's draft", () => {
    saveStep1Draft(1, { txtContent: "a", invoiceRows: [{ access_key: "1" }] });
    saveStep1Draft(2, { txtContent: "b", invoiceRows: [{ access_key: "2" }] });

    clearStep1Draft(1);

    expect(loadStep1Draft(1)).toBeNull();
    expect(loadStep1Draft(2)).not.toBeNull();
  });
});
