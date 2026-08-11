import { z } from "zod";

const textField = z.union([z.string(), z.null(), z.undefined()]).transform((value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
});

const normalizeDigits = (value = "") => String(value || "").replace(/\D/g, "");

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

const isValidPeruvianDni = (value) => {
  const dni = normalizeDigits(value);
  return dni.length === 8;
};

const isValidIdentityDocument = (value) => {
  const digits = normalizeDigits(value);
  if (!digits) return true;
  if (digits.length === 8) return isValidPeruvianDni(digits);
  if (digits.length === 10) return isValidCedula(digits);
  return false;
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

/**
 * Esquema de validacion para perfiles JSONB del command center.
 * Solo valida formato de cedula/ruc si son llenados, no requiere campos obligatorios.
 */
export const commandCenterProfileSchema = z
  .object({
    personal: personalSchema,
    laboral: laboralSchema,
    onboarding: onboardingSchema,
  })
  .passthrough()
  .superRefine((value, ctx) => {
    const cedula = normalizeDigits(value?.personal?.cedula);
    if (cedula && !isValidIdentityDocument(cedula)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["personal", "cedula"],
        message: "Documento invalido. Ingresa una cedula ecuatoriana de 10 digitos o un DNI peruano de 8 digitos.",
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
