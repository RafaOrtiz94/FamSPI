# MANUAL DE TESTING E2E: ACTIVOS TI V2
**Instrucciones para validar las 7 fases sin asumir nada**

---

## 📋 PRE-REQUISITOS

- Backend corriendo en puerto 8080
- Frontend corriendo en puerto 3000
- Usuario logueado como TI (rol: ti, jefe_ti, admin_ti, o gerencia)
- Base de datos actualizada con las nuevas tablas

---

## 🧪 TEST CASES

### **TEST 1: Crear equipo con depreciación**

**Objetivo**: Validar que Fase 3 funciona

**Pasos**:
1. Ir a "Activos TI" → Tab "Dispositivos"
2. Botón "Nuevo activo"
3. Llenar:
   - Nombre: "iPhone 15 Pro"
   - Brand: "Apple"
   - Type: "mobile"
   - **Valor de compra: 1200** (para que sea >= $400)
4. Guardar

**Validar**:
- [ ] Se crea el equipo
- [ ] Al llenar valor, aparece:
  - "Categoría: asset" (en rojo o badge)
  - "Depreciación anual: $133.20"
  - "Valor residual: $400" (después de 3 años)
- [ ] Estado inicial es "unassigned" o "available"

**Si falla**: Revisar consola del navegador y logs del backend

---

### **TEST 2: Asignar equipo móvil**

**Objetivo**: Validar que Fase 4 (estados) y 2 (números corporativos) funcionan

**Pasos**:
1. Seleccionar el iPhone 15 creado
2. En sección "Asignación", botón "Asignar equipo"
3. Modal: seleccionar colaborador
4. Se autocompleta: Nombre, Cédula, Cargo
5. Agregar motivo: "Asignación inicial"
6. Botón "Confirmar y generar acta"

**Validar**:
- [ ] No se puede asignar si estado es 'damaged', 'in_maintenance', 'retired'
- [ ] Se genera acta ACTA-D-ET-2026-XXXXXX
- [ ] Estado cambia automáticamente a "assigned"
- [ ] Se crea letra de cambio (si existe factura)
- [ ] **NOTA IMPORTANTE**: Números corporativos requieren fase 2 UI (no se asigna automáticamente aún)

**Si falla**: Revisar:
- ¿Está en estado 'available'?
- ¿El equipo es móvil (type='mobile')?
- ¿Hay factura subida?

---

### **TEST 3: Asignar múltiples equipos**

**Objetivo**: Validar batch assign (Fase 4 + 5)

**Pasos**:
1. Crear 2-3 equipos más
2. En listado, hacer check en 2-3 equipos
3. Aparece botón "Asignar 2 equipos"
4. Se abre modal batch
5. Editar para cada equipo:
   - ¿Nuevo o Usado?: "Nuevo"
   - Estado (1-10): "10"
   - Observaciones: "Sin rayones"
6. Seleccionar usuario
7. Confirmar

**Validar**:
- [ ] Se genera UNA acta para todos los equipos
- [ ] Acta tiene TODOS los equipos + accesorios
- [ ] Estado de cada equipo = "assigned"
- [ ] Se pueden ver características en historial

**Si falla**: Revisar rutas en tiAssets.routes.js (¿corporate-numbers está antes de :id?)

---

### **TEST 4: Subir factura**

**Objetivo**: Validar Fase 5 (documentos)

**Pasos**:
1. Seleccionar un equipo asignado
2. Botón "Documentos" (o pestaña financiera)
3. Subir factura (PDF o imagen)
4. doc_type: "factura"

**Validar**:
- [ ] Se sube sin error
- [ ] Permanece ligada al equipo (no se borra)
- [ ] Si sube otra factura, desactiva la anterior (upsert)
- [ ] Visible en historial de documentos

**Si falla**: Revisar:
- ¿El file upload es correcto?
- ¿Hay permiso en Google Drive?

---

### **TEST 5: Subir letra de cambio**

**Objetivo**: Validar Fase 5 (letra de cambio nueva por asignación)

**Pasos**:
1. Seleccionar equipo asignado
2. En modal de asignación (reasignar a otro usuario)
3. Seleccionar nuevo usuario
4. Se debería generar nueva letra de cambio automáticamente (si existe factura)

**Validar**:
- [ ] Se crea NUEVA letra de cambio (no reemplaza)
- [ ] Visible en "Letras de cambio - Historial"
- [ ] Cada asignación tiene su propia letra
- [ ] Letra vinculada al usuario asignado

**Si falla**: Revisar:
- ¿Existe factura?
- ¿El usuario ya tiene asignaciones anteriores?

---

### **TEST 6: Liberar equipo con foto**

**Objetivo**: Validar Fase 6 (liberación)

**Pasos**:
1. Seleccionar equipo asignado
2. Botón "Liberar" (aparece solo si está asignado)
3. Modal "Liberar equipo"
4. Subir foto (obligatoria)
5. Notas: "Equipo devuelto en buen estado"
6. Botón "Generar acta de retiro"

**Validar**:
- [ ] Botón "Liberar" deshabilitado si estado != 'assigned'
- [ ] Foto es obligatoria (error si no se carga)
- [ ] Se genera ACTA-D-RT-2026-XXXXXX
- [ ] Estado cambia a "available"
- [ ] Foto se guarda en BD y Drive
- [ ] Se ve historial de fotos anteriores

**Si falla**: Revisar:
- ¿El archivo subido es imagen válida?
- ¿Hay carpeta en Google Drive?
- ¿El estado actual es 'assigned'?

---

### **TEST 7: Ver características en historial**

**Objetivo**: Validar Fase 7 (características)

**Pasos**:
1. Seleccionar equipo que fue asignado múltiples veces
2. Ir a "Historial de asignaciones"
3. Ver tabla con asignaciones anteriores

**Validar**:
- [ ] Cada asignación muestra sus características
- [ ] Características se guardaron correctamente
- [ ] Historial muestra: Usuario | Fecha | Acta | Características | Estado

**Si falla**: Revisar:
- ¿Se capturaron características en asignación?
- ¿La tabla tiene datos?

---

### **TEST 8: Validaciones de estado**

**Objetivo**: Validar Fase 4 (estados automáticos)

**Pasos**:
1. Seleccionar equipo
2. En "Estado del equipo", cambiar a "Dañado"
3. Actualizar
4. Intentar asignar

**Validar**:
- [ ] Solo TI puede cambiar a 'damaged', 'in_maintenance', 'retired'
- [ ] Botón "Asignar" deshabilitado si estado = 'damaged'
- [ ] Mensaje: "No se puede asignar: equipo en estado 'dañado'"
- [ ] Se puede cambiar de vuelta a 'available'

**Si falla**: Revisar:
- ¿Usuario tiene rol TI?
- ¿El estado es válido?

---

### **TEST 9: Flujo completo (usuario 1 → usuario 2)**

**Objetivo**: Validar workflow completo

**Pasos**:
1. Crear equipo "Laptop HP" con valor $800 (>=400)
2. Subir factura
3. Asignar a Usuario1 (genera ACTA-D-ET-000001)
4. Ver acta en historial
5. Reasignar a Usuario2 (genera nueva letra de cambio)
6. Ver características en historial: Usuario1 tuvo 10/10 (nuevo), Usuario2 recibe 9/10 (usado)
7. Liberar equipo con foto (genera ACTA-D-RT-000001)
8. Verificar estado = 'available'

**Validar**:
- [ ] 2 actas generadas (ET para usuario1, RT para liberación)
- [ ] Factura persiste
- [ ] 2 letras de cambio creadas (una para usuario1, una para usuario2)
- [ ] Historial muestra ambas asignaciones con características
- [ ] Foto visible en historial

**Si todo funciona**: ✅ SISTEMA LISTO

---

### **TEST 10: Reporte de activo TI**

**Objetivo**: Validar reporte con depreciación e historial

**Pasos**:
1. Seleccionar un equipo con múltiples asignaciones
2. Botón "Descargar reporte de activo"
3. Abrir PDF

**Validar**:
- [ ] Encabezado: Nombre, Serial, Estado
- [ ] Valores: Valor original | Depreciación acumulada | Valor neto
- [ ] Asignación actual: Usuario | Fecha | Acta
- [ ] Historial tabla: Usuario anterior | Fecha | Acta | Características | Estado entrega | Estado recepción

**Si falla**: Revisar que los datos estén en BD

---

## 🔍 VERIFICACIÓN ADICIONAL

### **Rutas API (Backend)**
Abrir en terminal:
```bash
# Listar números corporativos
curl -H "Authorization: Bearer <token>" http://localhost:8080/api/v1/ti-assets/corporate-numbers

# Listar actas
curl -H "Authorization: Bearer <token>" http://localhost:8080/api/v1/ti-assets/actas

# Liberar equipo
curl -X POST -H "Authorization: Bearer <token>" \
  -F "photo=@/path/to/photo.jpg" \
  -F "notes=Equipo devuelto" \
  http://localhost:8080/api/v1/ti-assets/1/liberate
```

### **Base de Datos**
```sql
-- Verificar tablas nuevas
SELECT * FROM ti_corporate_numbers;
SELECT * FROM ti_corporate_number_history;
SELECT * FROM ti_asset_liberation_photos;

-- Verificar columnas nuevas
SELECT purchase_value, value_category FROM ti_assets LIMIT 1;
SELECT characteristics FROM ti_asset_assignments LIMIT 1;

-- Verificar acta codes
SELECT id, acta_code, tipo FROM ti_asset_actas ORDER BY id DESC LIMIT 5;
```

---

## ✅ CHECKLIST FINAL

- [ ] Test 1: Depreciación funciona
- [ ] Test 2: Asignación funciona
- [ ] Test 3: Batch assign funciona
- [ ] Test 4: Factura persiste
- [ ] Test 5: Letra de cambio nueva por asignación
- [ ] Test 6: Liberación con foto
- [ ] Test 7: Características en historial
- [ ] Test 8: Estados restrictivos
- [ ] Test 9: Flujo completo
- [ ] Test 10: Reporte correcto

---

## 🚨 PROBLEMAS COMUNES

### **Problema**: "No se puede descargar acta"
**Solución**: Verificar que Google Drive está configurado. Si no, las actas se generan pero sin PDF en Drive.

### **Problema**: "Equipo no se puede asignar"
**Solución**: 
- ¿Estado es 'available' o 'unassigned'?
- ¿Usuario tiene rol TI?
- ¿Hay validación de estado en backend?

### **Problema**: "Foto no se sube en liberación"
**Solución**:
- ¿El archivo es imagen válida?
- ¿Hay permisos en Drive?
- Revisar logs del backend

### **Problema**: "Acta code no se guarda"
**Solución**: Revisar que la columna `acta_code` existe en tabla `ti_asset_actas`

---

## 📝 REPORTE DE TESTING

**Escribir aquí el resultado de cada test**:

```
Test 1 - Depreciación: [ ] PASS [ ] FAIL
Test 2 - Asignación: [ ] PASS [ ] FAIL
Test 3 - Batch assign: [ ] PASS [ ] FAIL
Test 4 - Factura: [ ] PASS [ ] FAIL
Test 5 - Letra cambio: [ ] PASS [ ] FAIL
Test 6 - Liberación: [ ] PASS [ ] FAIL
Test 7 - Características: [ ] PASS [ ] FAIL
Test 8 - Estados: [ ] PASS [ ] FAIL
Test 9 - Flujo completo: [ ] PASS [ ] FAIL
Test 10 - Reporte: [ ] PASS [ ] FAIL

Errores encontrados:
1. [Descripción exacta del error]
2. [Stack trace si aplica]

Notas:
- [Observaciones adicionales]
```

---

**FECHA DE TESTING**: __________  
**PROBADOR**: __________________  
**RESULTADO FINAL**: [ ] TODO OK [ ] PROBLEMAS ENCONTRADOS

