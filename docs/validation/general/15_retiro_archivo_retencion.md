# Retiro, Archivo y Retención

**Sistema:** FamSPI  
**Versión:** 1.0  
**Alineación:** WHO TRS 1019, Annex 3, Appendix 5, Sección 15

---

## 1. Objetivo

Definir los criterios, procedimientos y responsabilidades para el archivo del expediente de validación de FamSPI, la retención de registros y el proceso de retiro controlado de versiones o del sistema cuando aplique.

---

## 2. Archivo del expediente de validación

### 2.1 Criterio de archivo

El expediente de validación pasa a estado **archivado** únicamente cuando se cumplan todas las condiciones siguientes:

| Condición | Estado actual |
|---|---|
| IQ completamente ejecutado y firmado | Parcial (pendiente cierre de desviaciones) |
| OQ completamente ejecutado y firmado | Pendiente de ejecución controlada |
| PQ/UAT completamente ejecutado y firmado | Pendiente de ejecución |
| Todas las desviaciones críticas cerradas o aceptadas con justificación | Pendiente |
| Informe final de validación firmado por responsables | Pendiente |
| Acceso de lectura restringido al expediente (solo consulta) | Por definir |

**Estado actual del expediente:** En construcción — no archivado.

### 2.2 Repositorio de evidencias

Las evidencias de validación se conservan en el repositorio Git del proyecto bajo la ruta `docs/validation/`. Cada evidencia referenciada en protocolos IQ/OQ/PQ tiene un ID único con el formato:

```
EV_FAMSPI_V{version}_{tipo}_{ID-caso}_{fecha}_{revision}
```

Ejemplo: `EV_FAMSPI_V1_0_0_OQ_OQ-001_20260513_R1`

El repositorio Git garantiza trazabilidad de quién modificó cada evidencia, cuándo y qué cambió.

---

## 3. Política de retención documental

| Tipo de registro | Período de retención | Formato | Responsable de custodia |
|---|---|---|---|
| Expediente completo de validación | Vida del sistema + 5 años mínimo | Digital (Git + archivo offline) | TI |
| Bitácora de auditoría (`auditoria.logs`) | Mínimo 3 años desde generación | PostgreSQL + exportación CSV archivada | TI |
| Registros de cambio de estado de viáticos | Mínimo 5 años (obligación tributaria) | PostgreSQL | TI + Finanzas |
| Certificados de entrenamiento emitidos | Vigencia del certificado + 2 años | Almacenamiento Google Drive + registro DB | TI + Servicio Técnico |
| Listas de asistencia y evidencias de capacitación | Hasta revisión periódica siguiente + 2 años | PDF archivado | TI |
| Registros de accesos externos de auditoría | 2 años desde revocación | `audit_access_grants` + exportación | TI |

**Nota:** La retención efectiva de datos en Neon PostgreSQL depende del plan de respaldo contratado. TI debe verificar que los períodos de retención apliquen también al proveedor de base de datos.

---

## 4. Preservación de legibilidad y accesibilidad

Los registros de validación deben permanecer legibles, accesibles y trazables durante todo el período de retención:

- **Formato digital primario:** Markdown versionado en Git — legible en cualquier editor de texto, independiente de software propietario
- **Exportaciones de seguridad:** Generación de PDF de los documentos críticos del expediente al momento del archivo, almacenados en el expediente documental de Drive
- **Base de datos:** Exportaciones SQL periódicas (`.sql` dump) conservadas junto con el expediente
- **Acceso futuro:** El repositorio Git debe permanecer clonable en una ubicación no dependiente del servicio de alojamiento principal

---

## 5. Proceso de retiro de versión del sistema

Cuando una versión del sistema sea reemplazada por una versión mayor o el sistema sea retirado:

| Paso | Descripción | Responsable |
|---|---|---|
| 1. Aviso de retiro | Notificación formal con al menos 30 días de anticipación a usuarios | TI + Gerencia |
| 2. Exportación de datos | Generación de volcados completos de base de datos y archivos | TI |
| 3. Archivo de configuración | Documentar estado final de variables de entorno (sin secretos) | TI |
| 4. Cierre del expediente | Completar y firmar el expediente de validación si estaba abierto | TI + Funcional |
| 5. Preservación del repositorio | Asegurar acceso permanente al repositorio Git de la versión retirada | TI |
| 6. Comunicación de reemplazo | Informar sistema sucesor, cronograma de migración y contacto de soporte | TI + Gerencia |
| 7. Acta de retiro | Documentar versión, fecha, motivo, aprobadores y referencia al sistema sucesor | TI |

---

## 6. Retiro del sistema (cierre definitivo)

Si el sistema es retirado sin sucesor inmediato:

1. Exportar completamente todos los datos de todas las tablas en formato SQL y CSV
2. Descargar todos los archivos de Google Drive vinculados al sistema
3. Conservar el código fuente completo en repositorio archivado
4. Mantener el expediente de validación accesible según política de retención
5. Notificar a los responsables de datos personales para cumplimiento LOPDP
6. Revocar todas las credenciales y accesos OAuth del sistema
