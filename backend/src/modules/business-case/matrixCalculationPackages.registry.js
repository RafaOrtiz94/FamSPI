const { validatePackage } = require("./matrixCalculationEngine.service");
const determination = require("./calculationPackages/hematologyXp300Determination.package");
const xp300AdditionalPackages = require("./calculationPackages/hematologyXp300AdditionalPackages");
const xnl350NoLicensePackages = require("./calculationPackages/hematologyXnl350NoLicensePackages");
const xnlAllPurchasedPackages = require("./calculationPackages/hematologyXnlAllPurchasedPackages");
const xnl350WithLicenseEffective = require("./calculationPackages/hematologyXnl350WithLicenseEffective.package");

class MatrixPackageRegistryError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "MatrixPackageRegistryError";
    this.code = code;
    this.details = details;
  }
}

const packages = Object.freeze([
  determination,
  xp300AdditionalPackages.effective,
  xp300AdditionalPackages.allPurchased,
  xnl350NoLicensePackages.determination,
  xnl350NoLicensePackages.effective,
  xnl350NoLicensePackages.allPurchased,
  xnl350WithLicenseEffective,
  ...xnlAllPurchasedPackages,
]);

const packageIndex = new Map();

const quarantinedScopes = Object.freeze([
  ...[
    ["XNL-350 CON LICENCIAS", "B21"],
    ["XNL-450 SIN LICENCIAS", "B40"],
    ["XNL-450 CON LICENCIAS", "B59"],
    ["XNL-550 SIN LICENCIAS", "B78"],
    ["XNL-550 CON LICENCIAS", "B97"],
    ["XN-1000 SIN LICENCIAS", "B116"],
    ["XN-1000 CON LICENCIAS", "B137"],
  ].map(([equipment, referencedCell]) => ({
    family: "hematologia",
    equipment,
    modality: "determinacion",
    version: "2024-12-06.1",
    reason: "EMPTY_PROCESS_TOTAL_REFERENCE",
    evidence: {
      sheet: "DETERMINACION XN",
      referencedCell: `BIOMETRIA HEMATICA!${referencedCell}`,
    },
  })),
  ...[
    ["XNL-450 SIN LICENCIAS", "B40"],
    ["XNL-450 CON LICENCIAS", "B59"],
    ["XNL-550 SIN LICENCIAS", "B78"],
    ["XNL-550 CON LICENCIAS", "B97"],
    ["XN-1000 SIN LICENCIAS", "B116"],
    ["XN-1000 CON LICENCIAS", "B137"],
  ].map(([equipment, referencedCell]) => ({
    family: "hematologia",
    equipment,
    modality: "prueba_efectiva",
    version: "2024-12-06.1",
    reason: "EMPTY_PROCESS_TOTAL_REFERENCE",
    evidence: {
      sheet: "PRUEBA EFECTIVA XN",
      referencedCell: `BIOMETRIA HEMATICA!${referencedCell}`,
    },
  })),
  {
    family: "hematologia",
    equipment: "XN-1000 CON LICENCIAS",
    modality: "todo_comprado",
    version: "2024-12-06.1",
    reason: "CROSS_CONFIGURATION_REFERENCE",
    evidence: {
      sheet: "COMODATO TODO COMPRADO XN",
      cells: ["O167", "O168"],
      referencedCell: "L156",
    },
  },
]);

function buildKey({ family, equipment, modality }, version) {
  for (const [field, value] of Object.entries({ family, equipment, modality, version })) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new MatrixPackageRegistryError(
        "INVALID_PACKAGE_SELECTOR",
        `El selector ${field} es obligatorio`,
        { field }
      );
    }
  }
  return [family, equipment, modality, version].join("::");
}

for (const packageDefinition of packages) {
  validatePackage(packageDefinition);
  const key = buildKey(packageDefinition.scope, packageDefinition.version);
  if (packageIndex.has(key)) {
    throw new MatrixPackageRegistryError(
      "DUPLICATE_PACKAGE",
      `Existe mas de un paquete para ${key}`,
      { key }
    );
  }
  packageIndex.set(key, packageDefinition);
}

function getExactPackage(selector) {
  if (!selector || typeof selector !== "object") {
    throw new MatrixPackageRegistryError(
      "INVALID_PACKAGE_SELECTOR",
      "El selector de paquete debe ser un objeto"
    );
  }

  const key = buildKey(selector, selector.version);
  const packageDefinition = packageIndex.get(key);
  if (!packageDefinition) {
    const quarantine = quarantinedScopes.find((entry) =>
      entry.family === selector.family &&
      entry.equipment === selector.equipment &&
      entry.modality === selector.modality &&
      entry.version === selector.version
    );
    if (quarantine) {
      throw new MatrixPackageRegistryError(
        "PACKAGE_QUARANTINED",
        "La matriz fuente contiene una referencia no publicable para este alcance",
        { quarantine: { ...quarantine } }
      );
    }
    throw new MatrixPackageRegistryError(
      "PACKAGE_NOT_FOUND",
      "No existe un paquete de calculo exactamente compatible con el selector",
      { selector: { ...selector } }
    );
  }
  return packageDefinition;
}

function listQuarantinedScopes() {
  return quarantinedScopes.map((entry) => ({
    ...entry,
    evidence: { ...entry.evidence },
  }));
}

function listPackages() {
  return packages.map((packageDefinition) => ({
    packageId: packageDefinition.packageId,
    version: packageDefinition.version,
    scope: { ...packageDefinition.scope },
    sourceWorkbook: { ...packageDefinition.sourceWorkbook },
    ruleCount: packageDefinition.rules.length,
  }));
}

module.exports = {
  MatrixPackageRegistryError,
  getExactPackage,
  listPackages,
  listQuarantinedScopes,
};
