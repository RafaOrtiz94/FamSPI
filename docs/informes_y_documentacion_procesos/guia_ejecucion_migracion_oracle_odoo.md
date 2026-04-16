# Guía de ejecución: migración Oracle → Odoo

- **Última revisión:** 2026-04-11  
- **Objetivo:** Ejecutar de forma reproducible la migración de datos desde Oracle hacia la base PostgreSQL de Odoo, dejando documentados prerrequisitos, comandos y validaciones.  
- **Nota:** Oracle **dejará de existir** como fuente; esta guía describe el **proceso de transición**. Tras el corte, los scripts solo se usan para **re-migraciones en laboratorio** o recuperación documentada.

---

## 1. Prerrequisitos del entorno (Windows)

### 1.1 Software obligatorio

| Componente | Verificación |
|------------|--------------|
| **Oracle SQL*Plus** | `sqlplus -V` en PowerShell; debe estar en `PATH`. |
| **Python 3.10+** | `python --version` |
| **Cliente PostgreSQL** (opcional pero recomendado) | `psql --version` para inspección manual |
| **Odoo** instalado y **base PostgreSQL** creada (ej. `OdooFAM`) | Conexión probada desde Odoo UI |

### 1.2 Permisos Oracle

- Usuario con lectura sobre tablas de negocio del esquema operativo (en el código de referencia aparece `SYSTEM` y tablas `AUX_*`, `VEN_*`, etc.).  
- Para auditoría amplia: permisos de diccionario según `AuditERP/README.md`.

### 1.3 Dependencias Python (migradores)

Desde la raíz del repositorio FamSPI (o desde `AuditERP/`):

```powershell
cd "C:\Users\Departamento de TI\Desktop\PROYECTOS\FamSPI\AuditERP"
python -m pip install psycopg2-binary
```

(Ajuste la ruta si su clon del repo difiere.)

---

## 2. Ubicación de los scripts en el repositorio

| Script | Ruta relativa al repo | Uso típico |
|--------|------------------------|------------|
| Migración **ERP extendida** | `AuditERP/migrate_oracle_to_odoo_erp.py` | **Principal**: partners, proveedores, productos, precios, flujos asociados y reporte final. |
| Migración **mínima / legado** | `AuditERP/migrate_to_odoo.py` | Pruebas rápidas o referencia histórica (partners, productos básicos, ventas limitadas). |
| Lotes (si aplica al inventario) | `AuditERP/migrate_lots.py` | Complemento según definición del equipo. |
| Auditoría Oracle | `AuditERP/audit_gui.py` | Inventario de tablas, FK, conteos, export CSV. |

---

## 3. Configuración **antes** de ejecutar (obligatorio)

Los valores están **hardcodeados** en los scripts. Debe editarlos para su entorno.

### 3.1 Archivo `migrate_oracle_to_odoo_erp.py` (recomendado para migración seria)

Abrir el archivo y localizar al inicio (aprox. líneas 16–25):

```python
ORACLE_CONN = "SYSTEM/FamDb@XE"
ORACLE_EXE = "sqlplus"

POSTGRES_CONFIG = {
    "host": "localhost",
    "port": 5433,
    "user": "postgres",
    "password": "FamDb",
    "dbname": "OdooFAM",
}
```

**Acciones:**

1. `ORACLE_CONN`: sustituir por usuario/contraseña/TNS reales (formato SQL*Plus: `usuario/clave@TNS`).  
2. `POSTGRES_CONFIG`: `host`, `port`, `user`, `password`, `dbname` deben apuntar a la **misma base** que usa la instancia Odoo de destino.  
3. Guardar el archivo y **no commitear** contraseñas reales al repositorio público; usar variables de entorno en una iteración futura si la política de seguridad lo exige.

### 3.2 Archivo `migrate_to_odoo.py` (alternativa simple)

Misma estructura: `ORACLE_CONN`, `POSTGRES_CONFIG`, `ORACLE_EXE`. Ajustar igualmente.

---

## 4. Preparación de Odoo (base de destino)

1. **Backup** de la base PostgreSQL de Odoo antes de la primera migración completa:

   ```powershell
   pg_dump -h localhost -p 5433 -U postgres -Fc -f "C:\Backups\OdooFAM_pre_migracion.dump" OdooFAM
   ```

   (Ajuste host, puerto y nombre de base.)

2. Confirmar módulos instalados según informes en `AuditERP/reports/` (ventas, compras, stock, contabilidad, `l10n_ec`, CRM, etc.).

3. Si el script añade restricciones `UNIQUE` en tablas estándar, la primera ejecución puede fallar si ya existen; el script `migrate_to_odoo.py` intenta `ALTER TABLE ... ADD CONSTRAINT` en bloque `try/except`. Revisar salida en consola.

---

## 5. Ejecución paso a paso (migración ERP extendida)

### 5.1 Abrir PowerShell en la carpeta correcta

```powershell
cd "C:\Users\Departamento de TI\Desktop\PROYECTOS\FamSPI\AuditERP"
```

### 5.2 (Opcional) Auditoría previa de Oracle

```powershell
python .\audit_gui.py
```

- Activar modo **91 tablas negocio** si aplica.  
- Guardar la carpeta de salida `audit_YYYYMMDD_HHMMSS` para trazabilidad.

### 5.3 Ejecutar el migrador principal

```powershell
python .\migrate_oracle_to_odoo_erp.py
```

**Qué esperar:**

- Mensajes de progreso: cleanup, normalización de `ref`, partners, suppliers, products, precios, perfiles, contactos, etc.  
- Al final: conteos Oracle/Odoo, auditoría de módulos y ruta a un **informe Markdown** generado (ruta impresa en consola, típicamente bajo `AuditERP/reports/`).

### 5.4 Si falla la ejecución

1. Leer el traceback completo.  
2. Verificar conectividad Oracle: `sqlplus usuario/clave@TNS` y `SELECT 1 FROM DUAL;`.  
3. Verificar PostgreSQL: conexión con `psql` o cliente gráfico.  
4. Revisar si la transacción hizo `rollback` (el script indica "Migration failed; transaction rolled back.").  
5. Restaurar backup si la base quedó en estado inconsistente.

---

## 6. Ejecución alternativa (script mínimo `migrate_to_odoo.py`)

Solo para laboratorio o comparación:

```powershell
cd "C:\Users\Departamento de TI\Desktop\PROYECTOS\FamSPI\AuditERP"
python .\migrate_to_odoo.py
```

Orden interno aproximado: constraints opcionales → `migrate_partners()` → `migrate_products()` → `migrate_sales_orders()` (muestra limitada en consultas Oracle).

---

## 7. Post-migración: validaciones obligatorias

1. **Conteos**: comparar totales impresos al final de `migrate_oracle_to_odoo_erp.py` con umbrales aceptados por negocio.  
2. **Informe de productos**: revisar `AuditERP/reports/PRODUCTOS_SIN_PRECIOS_*.md` (o equivalente generado tras su proceso) y cerrar gaps.  
3. **Muestreo funcional en Odoo**: abrir partners aleatorios, productos, una orden de venta y una compra; verificar moneda, impuestos y UoM.  
4. **Clasificación de productos**: validar que equipos/reactivos/servicios tengan tipo y categoría correctos (post-proceso manual o script si aún todo figura como consumible).  
5. **Archivo de evidencias**: copiar o referenciar rutas de reportes en el acta de migración del proyecto.

---

## 8. Corte definitivo de Oracle

Checklist mínimo:

- [ ] Odoo validado en UAT con datos migrados.  
- [ ] SPI apunta a Odoo (o a réplica maestra) según diseño de integración, no a Oracle.  
- [ ] Backup final de Oracle archivado (solo lectura legal/auditoría).  
- [ ] Oracle apagado en producción tras ventana acordada.  
- [ ] Runbook de “solo Odoo + SPI” publicado al equipo.

---

## 9. Mejoras recomendadas (siguiente iteración de ingeniería)

- Externalizar credenciales a variables de entorno (`ORACLE_CONN`, `PG_DSN`).  
- Parámetros CLI (`--dry-run`, `--phase=partners`) para ejecutar por fases.  
- Pipeline CI que ejecute solo validaciones de esquema y conteos contra una BD de prueba.

---

## 10. Contacto y responsables

Completar en la organización:

| Rol | Nombre | Responsabilidad |
|-----|--------|-----------------|
| DBA Oracle | | Lectura final y apagado |
| DBA PostgreSQL / Odoo | | Backup, restore, tuning |
| Líder migración datos | | Aceptación de informes |
| TI / Integraciones | | SPI ↔ Odoo |
