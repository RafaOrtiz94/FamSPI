MAPEO CANÓNICO FINAL – BC (v2.0)

Archivo: FORMATO BC – 15-01-2026
Hoja: BC
Rango estructural total: A1:F119
Naturaleza: Template completamente estático

1️⃣ REGLAS GENERALES DE AUTOMATIZACIÓN
- No insertar ni eliminar filas.
- No insertar ni eliminar columnas.
- No modificar fórmulas.
- No modificar encabezados.
- Solo escribir en celdas explícitamente mapeadas.
- Booleanos se escriben como texto: "SI" o "NO".
- No escribir en columnas A, B, C ni F dentro de la tabla de inversiones.
- Solo automatizar columnas D y E en la tabla de inversiones.
2️⃣ SECCIÓN 2.1 – KEY VALUE (B2:B55)
🔹 Naturaleza

Columna A = Etiqueta (solo lectura)
Columna B = Valor editable

📌 MAPEO COMPLETO
Campo lógico	Celda	Tipo	Automatizar
FechaDeActualizacion	B2	Fecha/Hora
FechaMaximaConsumibles	B3	Fecha	✅
TipoDeCliente	B4	Texto	✅
EntidadContratante	B5	Texto	✅
Cliente	B6	Texto	✅
CodigoProceso	B7	Texto/Numérico	✅
ObjetoContratacion	B8	Texto	✅
ProvinciaCiudad	B9	Texto	✅
DiasLaboratorio	B11	Numérico	✅
TurnosPorDia	B12	Numérico	✅
HorasPorTurno	B13	Numérico	✅
ControlesCalidadPorTurno	B14	Numérico	✅
NivelesDeControl	B15	Texto/Numérico	✅
FrecuenciaControlesRutina	B16	Texto	✅
PruebasEspeciales	B17	Texto	✅
FrecuenciaControlesEspeciales	B18	Texto	✅
NombreEquipoPrincipal	B20	Texto	✅
EstadoEquipoPrincipal	B21	Texto	✅
PropiedadEquipoPrincipal	B22	Texto	✅
ImagenReservaEquipo	B23	URL	
NombreEquipoBackUp	B24	Texto	✅
EstadoEquipoBackUp	B25	Texto	✅
InstalarJuntoPrincipal	B26	"SI"/"NO"	✅
UbicacionEquipos	B27	Texto	✅
PermiteEquipoProvisional	B28	"SI"/"NO"	
RequiereEquipoComplementario	B29	"SI"/"NO"	✅
EquipoComplementarioPrueba	B30	Texto	✅
IncluyeLIS	B32	"SI"/"NO"	✅
ProveedorSistemaTrabajar	B33	Texto	✅
IncluyeHadwareLIS	B34	"SI"/"NO"	✅
NumeroPacientesMensual	B35	Numérico	✅
InterfazSistemaActual	B36	Texto	✅
NombreSistema	B37	Texto	✅
ProveedorSistemaActual	B38	Texto	✅
IncluyeHadwareSistemaActual	B39	"SI"/"NO"	✅
ModeloProveedor1	B41	Texto	✅
ModeloProveedor2	B42	Texto	✅
ModeloProveedor3	B43	Texto	✅
CobroArriendoEquipamiento	B45	"SI"/"NO"	✅
Plazo	B46	Texto/Numérico	✅
ProyeccionPlazo	B47	Texto/Numérico	✅
PresupuestoReferencial	B49	Numérico	✅
PorcentajeMaximoCanje	B50	Numérico	✅
CompromisoDeCompra	B51	Texto	✅
TipoEntrega	B53	Texto	✅
DeterminacionEfectiva	B54	"SI"/"NO"	✅
Observaciones	B55	Texto largo	✅
3️⃣ SECCIÓN 2.2 – TABLA INVERSIONES ADICIONALES
📌 Rango Estructural
Encabezado: A57:F57
Datos: A58:F119
📌 Columnas
Columna	Uso	Automatizar
A	Descripción fija	❌
B	Características	❌
C	Estado	❌
D	Cantidad	✅
E	Precio	✅
F	Total (D×E)	❌
4️⃣ LISTA FIJA DE ÍTEMS (MAPEO FILA EXACTA)
Fila	Ítem
58	Control externo de tercera opinión
59	Control interno interlaboratorial
60	Póliza de Fiel Cumplimiento del Contrato
61	Póliza de seguro de equipos
62	Ups equipo
63	Ups servidor
64	LIS
65	Interfaz
66	Lantronix
67	IP publica
68	Punto de consulta web
69	Internet
70	Router para Internet
71	Servidor
72	Computadores
73	Mantenimiento Computador
74	Impresora
75	Man
76	Tinta
77	Toner para impresora de equipos
78	Impresora Zebra Termica ZD230
79	Lector inalambrico de codigo de barra
80	Sistema de destilación de agua pequeño
81	Sistema de osmosis
82	Mantenimiento sistema de osmosis
83	Sistema de prefiltracion
84	Mantenimiento sistema pre filtración
85	Tanque para resina mixta
86	Estructura de proteccion para sistema de agua
87	MEMBRANE EQ.OSMOSIS
88	FILTER NOM. P/SEDIMENTS PX10-20XX
89	FILTER NOM.P/SEDIMENTS GX05-20XX
90	RESINA IONICA REGENERADA
91	RESINA MUERTA
92	Sal en grano
93	Modificaciones espacio físico - estructura
94	Modificaciones espacio físico - mobiliario
95	Climatizacion del area
96	Rollo de cable UTP CAT5e
97	Conector RJ45 Delta CAT5E
98	Rack Cerrado POWEST 5UR
99	Switch HP Aruba Ion 5 puertos
100	Switch HP Aruba Ion 1430 24 puertos
101	Extensiones y cortapicos
102	Extras
103	Etiquetas
104	A4 printer paper
105	Refrigerador panorámico
106	Refrigerador médico
107	Termometro para refrigerador
108	Termohigrometros
109	Cronometros digitales
110	Centrifuga
111	Servicio Logisticos Proveedores
112	Servicio Logisticos Clientes
113	Ampolla de agua bidestilada
114	Agua destilada por galón
115	Hisopos
116	Gasas
117	Alcohol prepad
118	Tubos eppendorf
119	Otros
5️⃣ MODELO DE DATOS IDEAL DESDE BACKEND
{
  "fields": { ...key value... },
  "inversiones": {
    "Servidor": { "cantidad": 1, "precio": 3200 },
    "Ups equipo": { "cantidad": 2, "precio": 500 }
  }
}