import { z } from "zod";

const textField = z.union([z.string(), z.null(), z.undefined()]).transform((value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
});

const personalSchema = z.object({
  nombres: textField,
  apellidos: textField,
  email_personal: textField,
}).passthrough();

const laboralSchema = z.object({
  cargo: textField,
  area: textField,
}).passthrough();

/**
 * Esquema de validación base para perfiles JSONB del command center.
 * Se centra en validar mínimos operativos antes de persistir.
 */
export const commandCenterProfileSchema = z
  .object({
    personal: personalSchema,
    laboral: laboralSchema,
    onboarding: z.object({}).passthrough().optional(),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    const requiredFields = [
      { path: ["personal", "nombres"], label: "Nombres" },
      { path: ["personal", "apellidos"], label: "Apellidos" },
      { path: ["personal", "email_personal"], label: "Correo personal" },
      { path: ["laboral", "cargo"], label: "Cargo" },
      { path: ["laboral", "area"], label: "Area" },
    ];

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
  });

export default commandCenterProfileSchema;
