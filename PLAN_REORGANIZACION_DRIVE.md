# Plan de Reorganización de Carpetas en Google Drive

## Problema Actual
- Las carpetas no tienen números identificativos claros
- Algunas carpetas se crean en ubicaciones personales
- La estructura no es consistente entre diferentes módulos

## Estructura Propuesta

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

## Cambios a Implementar

### 1. `drivePaths.js` - Mejorar nombres de carpetas
- ✅ Mantener estructura departamento → tipo → solicitud
- ✅ Agregar número de solicitud al nombre de carpeta
- ✅ Agregar nombre de cliente cuando esté disponible
- ✅ Formato: `REQ-0001 - Cliente XYZ` o `0001 - Cliente XYZ - Fecha`

### 2. `equipmentPurchases.service.js` - Estandarizar carpetas
- Cambiar de sistema actual a usar `drivePaths.js`
- Usar DRIVE_ROOT_FOLDER_ID como raíz
- Crear jerarquía: `ROOT → Comercial → Solicitudes de Compra → 0001 - Cliente`

### 3. `driveClientManager.js` - Estandarizar carpetas de clientes
- Cambiar nombres: `0001 - Razón Social del Cliente`
- Usar DRIVE_ROOT_FOLDER_ID como raíz

## Implementación por Archivos

### Archivo 1: `drivePaths.js`
```javascript
// Mejorar nombre de carpeta de solicitud individual
const requestFolderName = `REQ-${padId(requestId)}${clientName ? ` - ${clientName}` : ''}`;
```

### Archivo 2: `equipmentPurchases.service.js`
```javascript
// Cambiar getRootFolder y ensureRequestFolder para usar drivePaths.js
// Estructura: ROOT → Comercial → Solicitudes de Compra → 0001 - Cliente - Fecha
```

### Archivo 3: `requests.service.js`
```javascript
// Ya usa drivePaths.js - solo asegurar que pasa nombre de cliente
await resolveRequestDriveFolders({
  requestId: request.id,
  requestTypeCode,
  requestTypeTitle,
  departmentCode,
  departmentName,
  templateCode,
  clientName: payload.nombre_cliente // ← NUEVO
});
```

## Beneficios
1. ✅ **Números visibles**: Todas las carpetas tendrán números identificativos
2. ✅ **Ordenamiento natural**: Las carpetas se ordenarán por número automáticamente
3. ✅ **Fácil búsqueda**: Buscar por número o nombre de cliente
4. ✅ **Consistencia**: Misma estructura en todos los módulos
5. ✅ **Trazabilidad**: Carpetas fáciles de identificar y seguir

## Variables de Entorno Requeridas
```env
DRIVE_ROOT_FOLDER_ID=0AILKwXtcdfRFUk9PVA  # ✅ Ya configurado
```

## Próximo Paso
Implementar los cambios en los 3 archivos manteniendo compatibilidad hacia atrás.
