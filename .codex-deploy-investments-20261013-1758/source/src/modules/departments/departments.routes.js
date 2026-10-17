/**
 * src/modules/departments/departments.routes.js
 * Rutas RESTful para el CRUD de departamentos
 */

const express = require("express");
const router = express.Router();
const controller = require("./departments.controller");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");

const DEPARTMENT_ADMIN_ROLES = [
  "talento_humano",
  "jefe_talento_humano",
  "gerencia",
  "ti",
  "jefe_ti",
  "admin_ti",
  "admin",
  "administrador",
];
const DEPARTMENT_READ_ROLES = [
  ...DEPARTMENT_ADMIN_ROLES,
  "finanzas",
  "financiero",
  "financiera",
  "jefe_finanzas",
  "jefe_financiero",
  "jefe_financiera",
  "gerencia_general",
  "gerente_general",
  "director",
];

// 🔒 Todas las rutas protegidas por autenticación
router.use(verifyToken);

// 1️⃣ Listar todos los departamentos
router.get("/", requireRole(DEPARTMENT_READ_ROLES), controller.getDepartments);

// 2️⃣ Obtener un departamento por ID
router.get("/:id", requireRole(DEPARTMENT_READ_ROLES), controller.getDepartmentById);

// 3️⃣ Crear un nuevo departamento
router.post("/", requireRole(DEPARTMENT_ADMIN_ROLES), controller.createDepartment);

// 4️⃣ Actualizar un departamento
router.put("/:id", requireRole(DEPARTMENT_ADMIN_ROLES), controller.updateDepartment);

// 5️⃣ Eliminar un departamento
router.delete("/:id", requireRole(DEPARTMENT_ADMIN_ROLES), controller.deleteDepartment);

module.exports = router;
