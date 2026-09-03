# TESTING E2E: ACTIVOS TI V2
**Fecha**: 2026-06-10  
**Status**: EN EJECUCIÓN

---

## CHECKLIST DE TESTING

### 1. CREAR EQUIPO CON VALOR (Prueba Depreciación)
- [ ] Crear equipo con:
  - Nombre: "Laptop Test"
  - Valor: USD 500
  - Serial: TEST-001
  - Fecha compra: 2026-01-01
- [ ] Verificar:
  - Categoría automática: "asset" (>=400)
  - Deprec. anual: $55.55
  - Valor residual (3 años): $333.35
  - Base de datos: columnas purchase_value y value_category creadas
  - Cálculo correcto: 500 * 0.1111 * 3 años = 166.65 depreciación total

**Resultado esperado**: ✓ Equipo creado con depreciación calculada automáticamente

---

### 2. ASIGNAR MÓVIL + COMPUTADOR → AUTO NÚMERO CORPORATIVO
- [ ] Crear equipos:
  - Móvil: type='mobile', name='iPhone Test'
  - Computador: type='computer', name='Desktop Test'
- [ ] Crear números corporativos:
  - Número: "+593-98-123-4567"
  - Número: "+593-98-765-4321"
- [ ] Asignar ambos equipos a usuario
- [ ] Verificar:
  - Número corporativo asignado automáticamente al móvil
  - Estado cambia a 'assigned'
  - Asignación registrada en ti_asset_assignments
  - Letra de cambio creada (si existe factura)

**Resultado esperado**: ✓ Ambos equipos asignados, número corporativo vinculado al móvil

---

### 3. CAMBIAR NÚMERO CORPORATIVO
- [ ] Cambiar número del móvil:
  - De: "+593-98-123-4567"
  - A: "+593-98-765-4321"
- [ ] Verificar:
  - Número anterior se libera (status='available')
  - Número nuevo vinculado al móvil
  - Historial registrado con quién cambió, cuándo, de qué a qué

**Resultado esperado**: ✓ Número cambiado, historial visible

---

### 4. SUBIR FACTURA → PERSISTE EN EQUIPO
- [ ] Subir factura PDF:
  - Documento: factura_test.pdf
  - Asset: equipo creado en paso 1
- [ ] Verificar:
  - ti_asset_financial_docs.doc_type = 'factura'
  - asset_id vinculado correctamente
  - Solo existe 1 factura activa (si subo otra, desactiva la anterior)

**Resultado esperado**: ✓ Factura guardada permanentemente en equipo

---

### 5. ASIGNAR A OTRO USUARIO → GENERA LETRA DE CAMBIO NUEVA
- [ ] Crear 2 usuarios:
  - User1: nombre "Juan Pérez"
  - User2: nombre "María López"
- [ ] Asignar equipo a User1
- [ ] Asignar mismo equipo a User2
- [ ] Verificar:
  - Letra de cambio creada para User1 (assignment_id vinculado)
  - Letra de cambio creada para User2 (nueva, assignment_id diferente)
  - Ambas visibles en: ti_asset_financial_docs (doc_type='letra_de_cambio')
  - User1 ve su letra en su perfil (asignación anterior)
  - User2 ve su letra en su perfil (asignación actual)

**Resultado esperado**: ✓ Cada asignación genera su propia letra de cambio, visible en historial

---

### 6. VER CARACTERÍSTICAS EN HISTORIAL
- [ ] Asignar equipo con características: "RAM 16GB, SSD 512GB, Intel i7"
- [ ] Verificar:
  - Características guardadas en ti_asset_assignments.characteristics
  - Visibles en historial de asignaciones
  - Se pueden editar en próxima asignación

**Resultado esperado**: ✓ Características persistidas y visibles en historial

---

### 7. LIBERAR EQUIPO → FOTO OBLIGATORIA, GENERA ACTA-D-RT
- [ ] Liberar equipo asignado:
  - Capturar foto (simular: cargar imagen)
  - Notas: "Equipo entregado por usuario en buen estado"
- [ ] Verificar:
  - Foto guardada en ti_asset_liberation_photos
  - Acta generada con tipo='retiro' y código ACTA-D-RT-2026-XXXXXX
  - Estado cambia automáticamente a 'available'
  - Foto subida a Google Drive (si configurado)
  - SHA256 calculado y guardado

**Resultado esperado**: ✓ Equipo liberado, acta generada, estado actualizado a available

---

### 8. EQUIPO LIBERADO PUEDE REASIGNARSE
- [ ] Después del paso 7, intentar asignar mismo equipo a otro usuario
- [ ] Verificar:
  - Asignación exitosa (estado=available permite)
  - Nueva acta de entrega generada
  - Nueva letra de cambio creada

**Resultado esperado**: ✓ Equipo reasignable después de liberación

---

### 9. VALIDAR ESTADOS: DAÑADO, MANTENIMIENTO → NO PUEDE ASIGNARSE
- [ ] Cambiar estado equipo a:
  - 'damaged' (dañado)
  - 'in_maintenance' (en mantenimiento)
- [ ] Intentar asignar
- [ ] Verificar:
  - Error HTTP 400: "No se puede asignar equipo en estado 'damaged'"
  - UI: botón Asignar deshabilitado
  - Solo TI puede cambiar a estos estados

**Resultado esperado**: ✓ Validación previene asignaciones inválidas

---

### 10. REPORTE: MOSTRAR VALOR, DEPRECIACIÓN, LETRAS CAMBIO
- [ ] Generar reporte de activo:
  - Valor original: USD 500
  - Depreciación acumulada: [calculada según fecha]
  - Valor neto: valor - depreciación
  - Historial asignaciones:
    - Usuario | Fecha | Acta | Letra de cambio (link descargar)
- [ ] Verificar:
  - Todos los campos presentes
  - Cálculos correctos
  - Enlaces funcionales

**Resultado esperado**: ✓ Reporte completo con información financiera

---

## RESUMEN DE VALIDACIONES TÉCNICAS

### Base de Datos
- [ ] `ti_corporate_numbers` creada con índices
- [ ] `ti_corporate_number_history` creada y registra cambios
- [ ] `ti_asset_liberation_photos` creada y guarda fotos
- [ ] Columnas agregadas en tablas existentes sin errores
- [ ] FKs correctas (references, ON DELETE)
- [ ] Índices para performance (asset, user, status)

### Backend API
- [ ] POST /ti-assets - crea con purchase_value
- [ ] GET /ti-assets - lista con depreciation_pct, residual_pct
- [ ] POST /ti-assets/:id/assign - valida estado + crea letra
- [ ] POST /ti-assets/:id/status - valida role (solo TI)
- [ ] POST /ti-assets/corporate-numbers - CRUD funcional
- [ ] POST /ti-assets/:id/liberate - requiere foto, genera acta
- [ ] GET /ti-assets/:id/liberation-photos - lista fotos

### Frontend
- [ ] Formulario crear: campo Valor de compra
- [ ] Cálculo deprec. en tiempo real: muestra categoría, deprec. anual, residual
- [ ] Botón Asignar: deshabilitado si estado != available/unassigned
- [ ] Modal liberación: carga foto, es obligatoria
- [ ] Historial: muestra características por asignación
- [ ] Badges estado: disponible (verde), asignado (azul), dañado (rojo), etc.

---

## EJECUCIÓN DE TESTS

**Comando para iniciar:**
```bash
cd backend && npm run dev
# En otra terminal:
cd spi_front && npm start
```

**Usuario de prueba:**
- Email: administrador@fam-project.com
- Rol: admin_ti (tiene acceso a todos los módulos)

---

## NOTAS IMPORTANTES

1. **Números Corporativos**: Solo para equipos de tipo 'mobile'. Validar en lógica de asignación.
2. **Depreciación**: Cálculo es por fecha de compra, no fecha de creación en sistema.
3. **Letras de Cambio**: Se crean SOLO si existe factura activa en el equipo.
4. **Liberación**: Cambia automáticamente a 'available', no permite retiro si status != 'assigned'.
5. **Audit Trail**: Todos los cambios de estado quedan registrados en ti_asset_events.

---

**Status Final**: LISTO PARA TESTING
