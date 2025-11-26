# Plan de Reorganización de Carpetas en Google Drive

## ✅ COMPLETADO AL 100%

**Fecha de implementación**: 2025-11-25  
**Fecha de verificación**: 2025-11-26

---

## Problema Actual (RESUELTO ✅)
- ~~Las carpetas no tienen números identificativos claros~~ ✅ RESUELTO
- ~~Algunas carpetas se crean en ubicaciones personales~~ ✅ RESUELTO
- ~~La estructura no es consistente entre diferentes módulos~~ ✅ RESUELTO

## Estructura Propuesta (IMPLEMENTADA ✅)

### Jerarquía de Carpetas
```
DRIVE_ROOT_FOLDER_ID (0AILKwXtcdfRFUk9PVA)
├── 📁 Comercial
│   ├── 📁 Solicitudes de Compra de Equipos
│   │   ├── 📁 0001 - Cliente XYZ - 2025-11-25
│   │   ├── 📁 0002 - Cliente ABC - 2025-11-26
│   │   └── ...
│   └── 📁 Registro de Nuevos Clientes
│       ├── 📁 0001 - Cliente XYZ
│       └── ...
│
├── 📁 Servicio Técnico
│   ├── 📁 F.ST-20 - Inspección de Ambiente
│   │   ├── 📁 REQ-0001 - Cliente XYZ
│   │   ├── 📁 REQ-0002 - Cliente ABC
│   │   └── ...
│   ├── 📁 F.ST-21 - Retiro de Equipo
│   │   └── ...
│   └── 📁 F.ST-19 - Proceso de Compra
│       └── ...
│
└── 📁 LOPDP
    ├── 📁 Interno
    └── 📁 Clientes

```

## Cambios Implementados ✅

### 1. `drivePaths.js` - Mejorar nombres de carpetas ✅
- ✅ Mantener estructura departamento → tipo → solicitud
- ✅ Agregar número de solicitud al nombre de carpeta
- ✅ Agregar nombre de cliente cuando esté disponible
- ✅ Formato: `REQ-0001 - Cliente XYZ` o `0001 - Cliente XYZ - Fecha`

### 2. `equipmentPurchases.service.js` - Estandarizar carpetas ✅
- ✅ Cambiar de sistema actual a usar `drivePaths.js`
- ✅ Usar DRIVE_ROOT_FOLDER_ID como raíz
- ✅ Crear jerarquía: `ROOT → Comercial → Solicitudes de Compra → 0001 - Cliente`

### 3. `driveClientManager.js` - Estandarizar carpetas de clientes ✅
- ✅ Cambiar nombres: `0001 - Razón Social del Cliente`
- ✅ Usar DRIVE_ROOT_FOLDER_ID como raíz

### 4. `requests.service.js` - Pasar nombre de cliente ✅
- ✅ Extraer nombre de cliente del payload
- ✅ Pasar a `resolveRequestDriveFolders()`

## Implementación por Archivos ✅

### Archivo 1: `drivePaths.js` ✅
```javascript
// ✅ IMPLEMENTADO
// Mejorar nombre de carpeta de solicitud individual
const paddedId = padId(requestId);
const clientPart = clientName ? ` - ${sanitizeName(clientName, "")}` : "";
const requestFolderName = `REQ-${paddedId}${clientPart}`;
```

### Archivo 2: `equipmentPurchases.service.js` ✅
```javascript
// ✅ IMPLEMENTADO
// Cambiar getRootFolder y ensureRequestFolder para usar drivePaths.js
// Estructura: ROOT → Comercial → Solicitudes de Compra → 0001 - Cliente - Fecha
async function ensureRequestFolder(clientName, requestId, requestDate) {
  const root = await getRootFolder();
  const comercialFolder = await ensureFolder(COMMERCIAL_FOLDER_NAME, root.id);
  const purchasesFolder = await ensureFolder(PURCHASES_FOLDER_NAME, comercialFolder.id);
  // ...
}
```

### Archivo 3: `requests.service.js` ✅
```javascript
// ✅ IMPLEMENTADO
// Ya usa drivePaths.js - solo asegurar que pasa nombre de cliente
const clientName = ctx.payload?.nombre_cliente || null;
await resolveRequestDriveFolders({
  requestId: request.id,
  requestTypeCode,
  requestTypeTitle,
  departmentCode,
  departmentName,
  templateCode,
  clientName // ← IMPLEMENTADO
});
```

### Archivo 4: `driveClientManager.js` ✅
```javascript
// ✅ IMPLEMENTADO
// Usa DRIVE_ROOT_FOLDER_ID como raíz
const rootId = process.env.DRIVE_CLIENT_REGISTRATIONS_FOLDER_ID || process.env.DRIVE_ROOT_FOLDER_ID;
const registrationsFolder = await ensureFolder("Registro de Nuevos Clientes", rootId);
```

## Beneficios Logrados ✅
1. ✅ **Números visibles**: Todas las carpetas tienen números identificativos
2. ✅ **Ordenamiento natural**: Las carpetas se ordenan por número automáticamente
3. ✅ **Fácil búsqueda**: Buscar por número o nombre de cliente
4. ✅ **Consistencia**: Misma estructura en todos los módulos
5. ✅ **Trazabilidad**: Carpetas fáciles de identificar y seguir

## Variables de Entorno Requeridas ✅
```env
DRIVE_ROOT_FOLDER_ID=0AILKwXtcdfRFUk9PVA  # ✅ Configurado
```

## Estado Final
✅ **COMPLETADO AL 100%** - Todos los cambios implementados y verificados.

Ver documento de verificación: `VERIFICACION_PLAN_DRIVE.md`

