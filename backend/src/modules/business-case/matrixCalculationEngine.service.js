/**
 * Motor declarativo de matrices de calculo de Business Case.
 *
 * Este servicio no interpreta coordenadas de Excel. Ejecuta paquetes de reglas
 * semanticas cuya procedencia (libro, hash, hoja, celda y formula original) fue
 * validada previamente. Un paquete con referencias rotas o externas se rechaza
 * antes de calcular.
 */

const { create, all } = require("mathjs");

const math = create(all, {
  number: "BigNumber",
  precision: 32,
});

const OPERATIONS = Object.freeze({
  add: { min: 2 },
  subtract: { exact: 2 },
  multiply: { min: 2 },
  divide: { exact: 2 },
  min: { min: 2 },
  max: { min: 2 },
  abs: { exact: 1 },
  negate: { exact: 1 },
  round_up: { min: 1, max: 2 },
  round_down: { min: 1, max: 2 },
  gt: { exact: 2 },
  gte: { exact: 2 },
  lt: { exact: 2 },
  lte: { exact: 2 },
  eq: { exact: 2 },
  neq: { exact: 2 },
  and: { min: 2 },
  or: { min: 2 },
  not: { exact: 1 },
  if: { exact: 3 },
});

const FORBIDDEN_SOURCE_PATTERNS = [
  { pattern: /#REF!/i, code: "BROKEN_SOURCE_REFERENCE" },
  { pattern: /#VALUE!/i, code: "BROKEN_SOURCE_VALUE" },
  { pattern: /#DIV\/0!/i, code: "BROKEN_SOURCE_DIVISION" },
  { pattern: /\[[^\]]+\](?:[^!]+)?!/i, code: "EXTERNAL_SOURCE_REFERENCE" },
];

class MatrixCalculationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "MatrixCalculationError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new MatrixCalculationError(code, message, details);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireNonEmptyString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    fail("INVALID_PACKAGE", `El campo ${field} debe ser un texto no vacio`, { field });
  }
}

function validateSource(source, field) {
  if (!isPlainObject(source)) {
    fail("INVALID_PACKAGE", `${field} es obligatorio`, { field });
  }

  requireNonEmptyString(source.sheet, `${field}.sheet`);
  requireNonEmptyString(source.cell, `${field}.cell`);
  requireNonEmptyString(source.formula, `${field}.formula`);

  for (const forbidden of FORBIDDEN_SOURCE_PATTERNS) {
    if (forbidden.pattern.test(source.formula)) {
      fail(
        forbidden.code,
        `La formula fuente ${source.sheet}!${source.cell} no puede publicarse`,
        { field, sheet: source.sheet, cell: source.cell, formula: source.formula }
      );
    }
  }
}

function validateRuleIdentity(identity, field) {
  if (!isPlainObject(identity)) {
    fail("INVALID_PACKAGE", `${field} es obligatorio`, { field });
  }
  if (!['item', 'aggregate'].includes(identity.kind)) {
    fail("INVALID_PACKAGE", `${field}.kind debe ser item o aggregate`, { field });
  }

  if (identity.kind === "aggregate") {
    requireNonEmptyString(identity.name, `${field}.name`);
    return;
  }

  for (const property of ["configuration", "section", "productId", "productName"]) {
    requireNonEmptyString(identity[property], `${field}.${property}`);
  }
  if (!Number.isInteger(identity.occurrence) || identity.occurrence < 1) {
    fail("INVALID_PACKAGE", `${field}.occurrence debe ser un entero positivo`, { field });
  }
}

function validateArity(op, args, path) {
  const arity = OPERATIONS[op];
  if (!arity) {
    fail("UNSUPPORTED_OPERATION", `Operacion no permitida: ${op}`, { path, op });
  }
  if (!Array.isArray(args)) {
    fail("INVALID_EXPRESSION", `${path}.args debe ser un arreglo`, { path });
  }
  if (arity.exact !== undefined && args.length !== arity.exact) {
    fail("INVALID_EXPRESSION", `${op} requiere ${arity.exact} argumentos`, { path, op });
  }
  if (arity.min !== undefined && args.length < arity.min) {
    fail("INVALID_EXPRESSION", `${op} requiere al menos ${arity.min} argumentos`, { path, op });
  }
  if (arity.max !== undefined && args.length > arity.max) {
    fail("INVALID_EXPRESSION", `${op} permite como maximo ${arity.max} argumentos`, { path, op });
  }
}

function inspectExpression(expression, path, dependencies, usedInputs) {
  if (!isPlainObject(expression)) {
    fail("INVALID_EXPRESSION", `${path} debe ser un objeto`, { path });
  }

  const variants = ["input", "ref", "value", "op"].filter((key) =>
    Object.prototype.hasOwnProperty.call(expression, key)
  );
  if (variants.length !== 1) {
    fail("INVALID_EXPRESSION", `${path} debe declarar exactamente input, ref, value u op`, { path });
  }

  if (variants[0] === "input") {
    requireNonEmptyString(expression.input, `${path}.input`);
    usedInputs.add(expression.input);
    return;
  }

  if (variants[0] === "ref") {
    requireNonEmptyString(expression.ref, `${path}.ref`);
    dependencies.add(expression.ref);
    return;
  }

  if (variants[0] === "value") {
    if (
      typeof expression.value !== "number" &&
      typeof expression.value !== "string" &&
      typeof expression.value !== "boolean"
    ) {
      fail("INVALID_EXPRESSION", `${path}.value debe ser numerico o booleano`, { path });
    }
    if (typeof expression.value !== "boolean") {
      toBigNumber(expression.value, path);
    }
    return;
  }

  requireNonEmptyString(expression.op, `${path}.op`);
  validateArity(expression.op, expression.args, path);
  expression.args.forEach((argument, index) =>
    inspectExpression(argument, `${path}.args[${index}]`, dependencies, usedInputs)
  );
}

function validateInputDefinitions(inputs) {
  if (!isPlainObject(inputs)) {
    fail("INVALID_PACKAGE", "inputs debe ser un objeto", { field: "inputs" });
  }

  for (const [key, definition] of Object.entries(inputs)) {
    requireNonEmptyString(key, "inputs.<key>");
    if (!isPlainObject(definition)) {
      fail("INVALID_PACKAGE", `La definicion de entrada ${key} debe ser un objeto`, { key });
    }
    if (!['number', 'boolean'].includes(definition.type)) {
      fail("INVALID_PACKAGE", `Tipo de entrada no permitido para ${key}`, { key, type: definition.type });
    }
    if (!isPlainObject(definition.source)) {
      fail("INVALID_PACKAGE", `La entrada ${key} debe declarar su celda fuente`, { key });
    }
    requireNonEmptyString(definition.source.sheet, `inputs.${key}.source.sheet`);
    requireNonEmptyString(definition.source.cell, `inputs.${key}.source.cell`);
    requireNonEmptyString(definition.source.label, `inputs.${key}.source.label`);
    if (Object.prototype.hasOwnProperty.call(definition, "default")) {
      if (definition.type === "boolean" && typeof definition.default !== "boolean") {
        fail("INVALID_PACKAGE", `El valor por defecto de ${key} debe ser booleano`, { key });
      }
      if (definition.type === "number") {
        toBigNumber(definition.default, `inputs.${key}.default`);
      }
    }
  }
}

function validatePackage(packageDefinition) {
  if (!isPlainObject(packageDefinition)) {
    fail("INVALID_PACKAGE", "El paquete de calculo debe ser un objeto");
  }

  requireNonEmptyString(packageDefinition.packageId, "packageId");
  requireNonEmptyString(packageDefinition.version, "version");

  const workbook = packageDefinition.sourceWorkbook;
  if (!isPlainObject(workbook)) {
    fail("INVALID_PACKAGE", "sourceWorkbook es obligatorio", { field: "sourceWorkbook" });
  }
  requireNonEmptyString(workbook.fileName, "sourceWorkbook.fileName");
  if (typeof workbook.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(workbook.sha256)) {
    fail("INVALID_PACKAGE", "sourceWorkbook.sha256 debe ser un SHA-256 valido", {
      field: "sourceWorkbook.sha256",
    });
  }

  if (!isPlainObject(packageDefinition.scope)) {
    fail("INVALID_PACKAGE", "scope es obligatorio", { field: "scope" });
  }
  for (const field of ["family", "equipment", "modality"]) {
    requireNonEmptyString(packageDefinition.scope[field], `scope.${field}`);
  }

  validateInputDefinitions(packageDefinition.inputs);

  if (!Array.isArray(packageDefinition.rules) || packageDefinition.rules.length === 0) {
    fail("INVALID_PACKAGE", "rules debe contener al menos una regla", { field: "rules" });
  }

  const rulesById = new Map();
  const metadata = new Map();

  packageDefinition.rules.forEach((rule, index) => {
    const path = `rules[${index}]`;
    if (!isPlainObject(rule)) {
      fail("INVALID_PACKAGE", `${path} debe ser un objeto`, { path });
    }
    requireNonEmptyString(rule.id, `${path}.id`);
    if (rulesById.has(rule.id)) {
      fail("DUPLICATE_RULE", `La regla ${rule.id} esta duplicada`, { ruleId: rule.id });
    }
    validateRuleIdentity(rule.identity, `${path}.identity`);
    validateSource(rule.source, `${path}.source`);

    const dependencies = new Set();
    const usedInputs = new Set();
    inspectExpression(rule.expression, `${path}.expression`, dependencies, usedInputs);
    rulesById.set(rule.id, rule);
    metadata.set(rule.id, { dependencies, usedInputs });
  });

  for (const [ruleId, ruleMetadata] of metadata) {
    for (const dependency of ruleMetadata.dependencies) {
      if (!rulesById.has(dependency)) {
        fail("UNKNOWN_RULE_REFERENCE", `La regla ${ruleId} referencia ${dependency}, que no existe`, {
          ruleId,
          dependency,
        });
      }
    }
    for (const input of ruleMetadata.usedInputs) {
      if (!Object.prototype.hasOwnProperty.call(packageDefinition.inputs, input)) {
        fail("UNKNOWN_INPUT", `La regla ${ruleId} usa la entrada no declarada ${input}`, {
          ruleId,
          input,
        });
      }
    }
  }

  const order = buildEvaluationOrder(rulesById, metadata);
  return { rulesById, metadata, order };
}

function buildEvaluationOrder(rulesById, metadata) {
  const order = [];
  const visiting = new Set();
  const visited = new Set();

  function visit(ruleId, path = []) {
    if (visited.has(ruleId)) return;
    if (visiting.has(ruleId)) {
      fail("CYCLIC_DEPENDENCY", `Dependencia circular detectada en ${ruleId}`, {
        cycle: [...path, ruleId],
      });
    }

    visiting.add(ruleId);
    for (const dependency of metadata.get(ruleId).dependencies) {
      visit(dependency, [...path, ruleId]);
    }
    visiting.delete(ruleId);
    visited.add(ruleId);
    order.push(ruleId);
  }

  for (const ruleId of rulesById.keys()) visit(ruleId);
  return order;
}

function toBigNumber(value, field) {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && value.trim() === "") ||
    (typeof value === "number" && !Number.isFinite(value))
  ) {
    fail("INVALID_NUMBER", `${field} debe ser un numero finito`, { field, value });
  }
  try {
    const result = math.bignumber(value);
    if (!math.isFinite(result)) throw new Error("no finito");
    return result;
  } catch (_error) {
    fail("INVALID_NUMBER", `${field} debe ser un numero finito`, { field, value });
  }
}

function requireNumber(value, operation) {
  if (!math.isBigNumber(value)) {
    fail("TYPE_MISMATCH", `${operation} requiere operandos numericos`, { operation });
  }
  return value;
}

function requireBoolean(value, operation) {
  if (typeof value !== "boolean") {
    fail("TYPE_MISMATCH", `${operation} requiere operandos booleanos`, { operation });
  }
  return value;
}

function excelRound(value, digitsValue, direction) {
  const numericValue = requireNumber(value, direction);
  const digits = digitsValue === undefined
    ? 0
    : Number(requireNumber(digitsValue, direction).toString());
  if (!Number.isInteger(digits) || Math.abs(digits) > 100) {
    fail("INVALID_ROUNDING_DIGITS", "Los digitos de redondeo deben ser un entero entre -100 y 100", {
      digits,
    });
  }

  const factor = math.pow(math.bignumber(10), digits);
  const shifted = math.multiply(numericValue, factor);
  const isNegative = math.smaller(shifted, 0);
  let rounded;
  if (direction === "round_up") {
    rounded = isNegative ? math.floor(shifted) : math.ceil(shifted);
  } else {
    rounded = isNegative ? math.ceil(shifted) : math.floor(shifted);
  }
  return math.divide(rounded, factor);
}

function evaluateOperation(op, args) {
  switch (op) {
    case "add":
      return args.reduce((total, value) => math.add(total, requireNumber(value, op)), math.bignumber(0));
    case "subtract":
      return math.subtract(requireNumber(args[0], op), requireNumber(args[1], op));
    case "multiply":
      return args.reduce((total, value) => math.multiply(total, requireNumber(value, op)), math.bignumber(1));
    case "divide": {
      const dividend = requireNumber(args[0], op);
      const divisor = requireNumber(args[1], op);
      if (math.equal(divisor, 0)) {
        fail("DIVISION_BY_ZERO", "Division por cero bloqueada", {});
      }
      return math.divide(dividend, divisor);
    }
    case "min":
      return args.map((value) => requireNumber(value, op)).reduce((a, b) => (math.smaller(a, b) ? a : b));
    case "max":
      return args.map((value) => requireNumber(value, op)).reduce((a, b) => (math.larger(a, b) ? a : b));
    case "abs":
      return math.abs(requireNumber(args[0], op));
    case "negate":
      return math.unaryMinus(requireNumber(args[0], op));
    case "round_up":
    case "round_down":
      return excelRound(args[0], args[1], op);
    case "gt":
      return math.larger(requireNumber(args[0], op), requireNumber(args[1], op));
    case "gte":
      return math.largerEq(requireNumber(args[0], op), requireNumber(args[1], op));
    case "lt":
      return math.smaller(requireNumber(args[0], op), requireNumber(args[1], op));
    case "lte":
      return math.smallerEq(requireNumber(args[0], op), requireNumber(args[1], op));
    case "eq":
      if (math.isBigNumber(args[0]) && math.isBigNumber(args[1])) return math.equal(args[0], args[1]);
      return args[0] === args[1];
    case "neq":
      if (math.isBigNumber(args[0]) && math.isBigNumber(args[1])) return !math.equal(args[0], args[1]);
      return args[0] !== args[1];
    case "and":
      return args.every((value) => requireBoolean(value, op));
    case "or":
      return args.some((value) => requireBoolean(value, op));
    case "not":
      return !requireBoolean(args[0], op);
    case "if":
      return requireBoolean(args[0], op) ? args[1] : args[2];
    default:
      fail("UNSUPPORTED_OPERATION", `Operacion no permitida: ${op}`, { op });
  }
}

function evaluateExpression(expression, inputs, values) {
  if (Object.prototype.hasOwnProperty.call(expression, "input")) return inputs[expression.input];
  if (Object.prototype.hasOwnProperty.call(expression, "ref")) return values[expression.ref];
  if (Object.prototype.hasOwnProperty.call(expression, "value")) {
    return typeof expression.value === "boolean"
      ? expression.value
      : toBigNumber(expression.value, "expression.value");
  }

  // IF es perezoso: una rama no seleccionada no debe generar errores ni
  // reproducir el comportamiento de una celda que Excel no evaluaria.
  if (expression.op === "if") {
    const condition = evaluateExpression(expression.args[0], inputs, values);
    const selectedIndex = requireBoolean(condition, "if") ? 1 : 2;
    return evaluateExpression(expression.args[selectedIndex], inputs, values);
  }

  const args = expression.args.map((argument) => evaluateExpression(argument, inputs, values));
  return evaluateOperation(expression.op, args);
}

function resolveInputs(definitions, providedInputs) {
  if (!isPlainObject(providedInputs)) {
    fail("INVALID_INPUTS", "Las entradas deben ser un objeto");
  }

  const unknownInputs = Object.keys(providedInputs).filter(
    (key) => !Object.prototype.hasOwnProperty.call(definitions, key)
  );
  if (unknownInputs.length > 0) {
    fail("UNKNOWN_INPUT", "Se recibieron entradas no declaradas por el paquete", { unknownInputs });
  }

  const resolved = {};
  for (const [key, definition] of Object.entries(definitions)) {
    let value = providedInputs[key];
    if (value === undefined && Object.prototype.hasOwnProperty.call(definition, "default")) {
      value = definition.default;
    }
    if (value === undefined) {
      fail("MISSING_INPUT", `Falta la entrada requerida ${key}`, { key });
    }
    if (definition.type === "boolean") {
      if (typeof value !== "boolean") fail("INVALID_INPUT", `${key} debe ser booleano`, { key, value });
      resolved[key] = value;
    } else {
      resolved[key] = toBigNumber(value, key);
    }
  }
  return resolved;
}

function serializeValue(value) {
  return math.isBigNumber(value) ? value.toString() : value;
}

function executePackage(packageDefinition, providedInputs) {
  const validation = validatePackage(packageDefinition);
  const inputs = resolveInputs(packageDefinition.inputs, providedInputs);
  const values = {};
  const trace = [];

  for (const ruleId of validation.order) {
    const rule = validation.rulesById.get(ruleId);
    const value = evaluateExpression(rule.expression, inputs, values);
    values[ruleId] = value;
    trace.push({
      ruleId,
      value: serializeValue(value),
      dependencies: [...validation.metadata.get(ruleId).dependencies],
      identity: { ...rule.identity },
      source: { ...rule.source },
    });
  }

  return {
    packageId: packageDefinition.packageId,
    version: packageDefinition.version,
    sourceSha256: packageDefinition.sourceWorkbook.sha256.toLowerCase(),
    scope: { ...packageDefinition.scope },
    values: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, serializeValue(value)])),
    trace,
  };
}

module.exports = {
  MatrixCalculationError,
  executePackage,
  validatePackage,
};
