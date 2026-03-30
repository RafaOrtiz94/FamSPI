import { z } from "zod";

const textField = z.union([z.string(), z.null(), z.undefined()]).transform((value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
});

const normalizeDigits = (value = "") => String(value || "").replace(/\D/g, "");
const normalizeStage = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase();

const computeMod10Verifier = (digits) => {
  const coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  const sequence = String(digits || "")
    .slice(0, 9)
    .split("");
  const sum = sequence
    .map((digit, index) => {
      const product = Number(digit) * coefficients[index];
      return product > 9 ? product - 9 : product;
    })
    .reduce((acc, value) => acc + value, 0);

  const nextTen = Math.ceil(sum / 10) * 10;
  return nextTen === sum ? 0 : nextTen - sum;
};

const computeMod11Verifier = (digits, coefficients) => {
  const sum = coefficients.reduce(
    (acc, coefficient, index) => acc + Number(digits[index]) * coefficient,
    0,
  );
  const residue = sum % 11;
  const verifier = 11 - residue;
  if (verifier === 11) return 0;
  if (verifier === 10) return 1;
  return verifier;
};

const isValidCedula = (value) => {
  const cedula = normalizeDigits(value);
  if (cedula.length !== 10) return false;

  const province = Number(cedula.slice(0, 2));
  const thirdDigit = Number(cedula[2]);
  if (province < 1 || province > 24) return false;
  if (thirdDigit >= 6) return false;

  const verifier = computeMod10Verifier(cedula);
  return verifier === Number(cedula[9]);
};

const isValidRuc = (value) => {
  const ruc = normalizeDigits(value);
  if (ruc.length !== 13) return false;

  const province = Number(ruc.slice(0, 2));
  const thirdDigit = Number(ruc[2]);
  if (province < 1 || province > 24) return false;

  if (thirdDigit >= 0 && thirdDigit <= 5) {
    if (!isValidCedula(ruc.slice(0, 10))) return false;
    return ruc.slice(10) !== "000";
  }

  if (thirdDigit === 6) {
    const verifier = computeMod11Verifier(ruc.slice(0, 8), [3, 2, 7, 6, 5, 4, 3, 2]);
    return verifier === Number(ruc[8]) && ruc.slice(9) !== "0000";
  }

  if (thirdDigit === 9) {
    const verifier = computeMod11Verifier(ruc.slice(0, 9), [4, 3, 2, 7, 6, 5, 4, 3, 2]);
    return verifier === Number(ruc[9]) && ruc.slice(10) !== "000";
  }

  return false;
};

const profileFieldRequirements = {
  base: [
    { path: ["personal", "nombres"], label: "Nombres" },
    { path: ["personal", "apellidos"], label: "Apellidos" },
    { path: ["personal", "email_personal"], label: "Correo personal" },
    { path: ["laboral", "cargo"], label: "Cargo" },
    { path: ["laboral", "area"], label: "Area" },
  ],
  aprobada: [
    { path: ["personal", "cedula"], label: "Cedula" },
    { path: ["personal", "telefono_personal"], label: "Telefono personal" },
  ],
  en_proceso: [
    { path: ["personal", "cedula"], label: "Cedula" },
    { path: ["personal", "telefono_personal"], label: "Telefono personal" },
    { path: ["laboral", "fecha_ingreso"], label: "Fecha de ingreso" },
    { path: ["laboral", "tipo_contrato"], label: "Tipo de contrato" },
  ],
  completada: [
    { path: ["personal", "cedula"], label: "Cedula" },
    { path: ["personal", "telefono_personal"], label: "Telefono personal" },
    { path: ["laboral", "fecha_ingreso"], label: "Fecha de ingreso" },
    { path: ["laboral", "tipo_contrato"], label: "Tipo de contrato" },
    { path: ["laboral", "email_famproject"], label: "Correo corporativo" },
    {
      path: ["laboral", "telefono_celular_famproject"],
      label: "Telefono corporativo",
    },
  ],
};

const personalSchema = z
  .object({
    nombres: textField,
    apellidos: textField,
    email_personal: textField,
    cedula: textField,
    ruc: textField,
    telefono_personal: textField,
  })
  .passthrough();

const laboralSchema = z
  .object({
    cargo: textField,
    area: textField,
    fecha_ingreso: textField,
    tipo_contrato: textField,
    email_famproject: textField,
    telefono_celular_famproject: textField,
  })
  .passthrough();

const onboardingSchema = z
  .object({
    workflow_stage: textField.optional(),
  })
  .passthrough()
  .optional();

const resolveRequiredFieldsByStage = (rawStage) => {
  const stage = normalizeStage(rawStage);
  if (stage === "completada") {
    return profileFieldRequirements.completada;
  }
  if (stage === "en_proceso") {
    return profileFieldRequirements.en_proceso;
  }
  if (stage === "aprobada") {
    return profileFieldRequirements.aprobada;
  }
  return profileFieldRequirements.base;
};

/**
 * Esquema de validacion para perfiles JSONB del command center.
 * Aplica reglas por etapa de flujo y validaciones fuertes de identificacion.
 */
export const commandCenterProfileSchema = z
  .object({
    personal: personalSchema,
    laboral: laboralSchema,
    onboarding: onboardingSchema,
  })
  .passthrough()
  .superRefine((value, ctx) => {
    const workflowStage = value?.onboarding?.workflow_stage;
    const requiredFields = resolveRequiredFieldsByStage(workflowStage);

    requiredFields.forEach((field) => {
      const resolved = field.path.reduce((acc, part) => acc?.[part], value);
      if (!String(resolved || "").trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: field.path,
          message: `${field.label} es obligatorio`,
        });
      }
    });

    const cedula = normalizeDigits(value?.personal?.cedula);
    if (cedula && !isValidCedula(cedula)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["personal", "cedula"],
        message: "Cedula invalida. Verifica el numero ingresado.",
      });
    }

    const ruc = normalizeDigits(value?.personal?.ruc);
    if (ruc && !isValidRuc(ruc)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["personal", "ruc"],
        message: "RUC invalido. Verifica el numero ingresado.",
      });
    }

    if (cedula && ruc && ruc.startsWith(cedula) === false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["personal", "ruc"],
        message: "El RUC debe corresponder a la cedula del colaborador.",
      });
    }
  });

export default commandCenterProfileSchema;
