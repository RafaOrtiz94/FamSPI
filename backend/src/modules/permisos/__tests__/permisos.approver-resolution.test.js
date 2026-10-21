const {
  buildCurrentRequesterActor,
  buildPreferredApproverRoles,
} = require("../permisos.service");

describe("resolucion de aprobador con identidad vigente", () => {
  test("ignora claims jerarquicos obsoletos del JWT", () => {
    const tokenUser = {
      id: 31,
      email: "lidia.viracocha@fam-project.com",
      role: "jefe_operaciones",
      scope: "operaciones",
      department: "OPE",
      department_id: 7,
    };
    const currentIdentity = {
      id: 31,
      email: "lidia.viracocha@fam-project.com",
      role: "calidad",
      department_id: 7,
    };

    const actor = buildCurrentRequesterActor(tokenUser, currentIdentity);

    expect(buildPreferredApproverRoles(actor)).toEqual([
      "jefe_calidad",
      "gerencia_general",
    ]);
  });
});
