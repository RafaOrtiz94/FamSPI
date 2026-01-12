/**
 * src/modules/departments/departments.routes.js
 * Rutas RESTful para el CRUD de departamentos
 */

const express = require("express");
const router = express.Router();
const controller = require("./departments.controller");
const { verifyToken } = require("../../middlewares/auth");

// 🔒 Todas las rutas protegidas por autenticación
router.use(verifyToken);

// 1️⃣ Listar todos los departamentos
router.get("/", controller.getDepartments);

// 2️⃣ Obtener un departamento por ID
router.get("/:id", controller.getDepartmentById);

// 3️⃣ Crear un nuevo departamento
router.post("/", controller.createDepartment);

// 4️⃣ Actualizar un departamento
router.put("/:id", controller.updateDepartment);

// 5️⃣ Eliminar un departamento
router.delete("/:id", controller.deleteDepartment);

module.exports = router;
