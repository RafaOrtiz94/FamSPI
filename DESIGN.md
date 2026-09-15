---
name: FamSPI
version: "2.1"
updated: "2026-09-03"
description: Sistema de procesos internos de FAM. Una interfaz empresarial de precisión para coordinar decisiones, documentos y trabajo de campo.
designDirection: "Precisión operativa"
colors:
  naval-slate: "#182838"
  storm-slate: "#263C50"
  midnight-slate: "#101820"
  action-blue: "#2458D3"
  sky-signal: "#91B5FF"
  surface-white: "#FFFFFF"
  paper-white: "#F3F5F7"
  dark-surface: "#101820"
  dark-card: "#18232F"
  ink-slate: "#172B3A"
  warm-ash: "#586A79"
  fog: "#7B8B99"
  soft-border: "#DCE3E9"
  operative-green: "#166344"
  green-soft: "#E6F4ED"
  alert-red: "#B42336"
  red-soft: "#FDECEF"
  caution-amber: "#805500"
  amber-soft: "#FFF3D6"
typography:
  display:
    fontFamily: "'Geist', system-ui, -apple-system, sans-serif"
    fontSize: "clamp(1.75rem, 2.2vw, 2.25rem)"
    fontWeight: 650
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "'Geist', system-ui, -apple-system, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  title:
    fontFamily: "'Geist', system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "'Geist', system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Geist', system-ui, -apple-system, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
  mono:
    fontFamily: "'Geist Mono', ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
zIndex:
  sticky: 10
  dropdown: 20
  modalBackdrop: 30
  modal: 40
  toast: 50
animation:
  durationButtonPress: "100ms"
  durationTooltip: "120ms"
  durationDropdown: "160ms"
  durationModal: "200ms"
  durationDrawer: "240ms"
  easingOut: "cubic-bezier(0.2, 0.8, 0.2, 1)"
  easingInOut: "cubic-bezier(0.4, 0, 0.2, 1)"
components:
  button-primary:
    backgroundColor: "var(--action)"
    textColor: "var(--on-action)"
    rounded: "{rounded.md}"
    padding: "8px 14px"
    minHeight: "36px"
    activeScale: "1"
    shadow: "none"
  button-primary-hover:
    backgroundColor: "var(--action-hover)"
    textColor: "var(--on-action)"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  button-secondary:
    backgroundColor: "var(--surface)"
    textColor: "var(--text)"
    border: "1px solid var(--border-control)"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "var(--text-secondary)"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  button-danger:
    backgroundColor: "var(--danger-solid)"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  badge-neutral:
    backgroundColor: "var(--surface-subtle)"
    textColor: "var(--text-secondary)"
    rounded: "{rounded.sm}"
    padding: "2px 7px"
  badge-blue:
    backgroundColor: "var(--info-bg)"
    textColor: "var(--info-text)"
    rounded: "{rounded.sm}"
    padding: "2px 7px"
  badge-green:
    backgroundColor: "var(--success-bg)"
    textColor: "var(--success-text)"
    rounded: "{rounded.sm}"
    padding: "2px 7px"
  badge-red:
    backgroundColor: "var(--danger-bg)"
    textColor: "var(--danger-text)"
    rounded: "{rounded.sm}"
    padding: "2px 7px"
  badge-amber:
    backgroundColor: "var(--warning-bg)"
    textColor: "var(--warning-text)"
    rounded: "{rounded.sm}"
    padding: "2px 7px"
  input-default:
    backgroundColor: "var(--surface)"
    textColor: "var(--text)"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    minHeight: "40px"
    border: "1px solid var(--border-control)"
    focusRing: "2px solid var(--focus)"
  card-default:
    backgroundColor: "var(--surface)"
    textColor: "var(--text)"
    rounded: "{rounded.lg}"
    padding: "20px"
    border: "1px solid var(--border)"
    shadow: "none"
---

# FamSPI · Sistema de diseño 2.1

## 1. Dirección: precisión operativa

FamSPI debe sentirse como una herramienta propia de FAM: clara, sólida y cuidadosamente diseñada. Su identidad nace de la composición, del ritmo entre información y acciones, y de cómo muestra el avance del trabajo.

**La firma visual combina cuatro elementos:** navbar horizontal superior naval, lienzo mineral claro, tipografía de jerarquía marcada y una línea de etapas que hace visible la trazabilidad. El cobalto identifica la acción y la selección. Los estados conservan su significado empresarial.

Un usuario debe distinguir en pocos segundos qué necesita atención, quién tiene la siguiente acción y dónde continúa su trabajo. La personalización proviene de prioridades reales según rol, no de un saludo grande ni de estadísticas de relleno.

### Qué cambia frente a la versión anterior

| Antes | Decisión vigente |
|---|---|
| Botones y tarjetas con radio uniforme de 16px | Radios por función: 6px etiquetas, 8px controles, 12px paneles, 16px overlays |
| Casi toda superficie es una tarjeta con sombra | Lienzo abierto, separadores y paneles planos; sombra solo para capas flotantes |
| Diferenciación basada en restricciones de color | Identidad construida con navegación, tipografía, composición y trazabilidad |
| Mismo peso visual para muchos bloques | Un área dominante y contexto subordinado según tarea |
| Monoespaciada para todo dato exacto | Mono para identificadores; cifras tabulares en importes, fechas y métricas |
| Modales recomendados y desaconsejados simultáneamente | Una matriz de patrones según contexto, complejidad y continuidad |
| Overlay obligatorio a partir de dos segundos | Feedback local; bloqueo únicamente cuando la integridad del flujo lo exige |
| Escala al pulsar cualquier elemento | Feedback de color; movimiento mínimo y opcional en acciones aisladas |

### Cómo se incorporan referencias actuales

La actualización de Linear de marzo de 2026 prioriza consistencia de cabeceras y controles, navegación menos dominante y lectura rápida. FamSPI adopta esos principios, con su propia identidad naval y sus flujos operativos [1]. El uso de tokens semánticos y tipografía por función se apoya en las prácticas de Atlassian [2, 3]. Son referencias de producto, no una afirmación de que exista una estética universal de 2026.

Decisiones propias de FamSPI: densidad ajustable, panel de inspección contextual, jerarquía editorial en el inicio y trazabilidad como firma. No agregar efectos ni funcionalidades solo para parecer actual.

## 2. Alcance y precedencia

Este archivo sustituye las reglas visuales e interactivas de la versión anterior. El frontmatter mantiene las familias principales de configuración; sus valores evolucionan y se añaden tokens. **Esto no garantiza compatibilidad automática con un parser existente:** comprobar cómo consume el repositorio las referencias y variables CSS antes de migrarlo.

La tabla de tokens y su bloque CSS son la fuente de verdad para temas. Los valores `colors` del frontmatter son primitivas y aliases de transición del tema claro; los componentes nuevos consumen roles semánticos.

Se conservan `DashboardLayout`, `WORKSPACE_PAGE_CLASS`, `WORKSPACE_2COL_CLASS`, `WORKSPACE_3COL_CLASS`, `<Modal>` y `AttendanceWidget` como contratos descritos por el archivo original. Su implementación debe revisarse en el repositorio real antes de modificarla. Este documento no acredita cambios ya implementados en la aplicación.

## 3. Identidad visual reconocible

### 3.1 Navbar horizontal superior

**La navegación principal de FamSPI es una barra horizontal en la parte superior.** Esta definición se aplica a todos los módulos y tamaños de pantalla. El contenido aprovecha todo el ancho disponible debajo de la barra; no se reserva una columna lateral para navegar.

#### Anatomía y apariencia

| Zona | Contenido | Tratamiento |
|---|---|---|
| Izquierda | Logo aprobado de FAM e identificador FamSPI | Enlace al inicio; tamaño contenido, sin inventar activos de marca |
| Centro | Destinos principales autorizados para el usuario | Enlaces horizontales con nombres breves; agrupación desplegable cuando haga falta |
| Derecha | Utilidades existentes y perfil | Búsqueda y notificaciones solo si están implementadas; perfil como botón con desplegable |

Fondo sólido `var(--nav)`, texto `var(--nav-text)` y borde inferior discreto. Altura mínima de 64px en escritorio y 56px en móvil; permitir crecimiento con zoom o textos ampliados. Padding horizontal alineado con el contenido del `DashboardLayout`. Logo e iconos no deben competir con los nombres de los módulos.

Distribuir las zonas con flex o grid: marca y utilidades conservan su espacio; los destinos usan el ancho restante con `min-width: 0`. Mantener la barra en una sola fila a escala normal. Cuando no alcance el espacio, agrupar destinos antes de reducir fuentes, truncar etiquetas o producir scroll horizontal de página.

La navbar puede ser sticky con `top: 0` y nivel 10 dentro del contenedor de scroll real. Mantiene su espacio en el flujo. Si el layout existente la fija fuera del flujo, compensar su altura real una sola vez. Respetar `env(safe-area-inset-top)`; no duplicar el padding global ni ocultar contenido al navegar a un ancla.

#### Estados de los destinos

| Estado | Apariencia y comportamiento |
|---|---|
| Reposo | Fondo transparente, texto naval claro, peso 500 |
| Hover | Fondo `var(--nav-active)`, texto blanco; solo en dispositivos con hover |
| Ruta actual | Texto blanco, peso 600, fondo naval elevado sutil y subrayado inferior de 3px `var(--nav-marker)` |
| Foco de teclado | Outline azul claro de 2px con separación de 3px; independiente del subrayado de selección |
| Desplegable abierto | Superficie naval elevada y chevron orientado según estado; `aria-expanded="true"` |

El indicador activo es horizontal, bajo el nombre del destino. No usar un marcador vertical. Los enlaces de ruta llevan `aria-current="page"` cuando corresponda. Un grupo puede señalar que contiene la ruta actual, pero su botón no se anuncia como la página actual. No marcar dos destinos equivalentes como activos.

#### Desplegables y utilidades

Agrupar módulos según la organización y permisos existentes. En escritorio, los accesos críticos del rol permanecen visibles y los demás se organizan en triggers directos como «Trabajo», «Herramientas» y «Administración», mostrados solo cuando contienen opciones autorizadas. Cada trigger abre un panel amplio tipo navigation-menu con enlaces agrupados y desplazamiento interno si hace falta. No forzar un número fijo de enlaces si sus etiquetas no caben.

Los desplegables se abren por click, toque o teclado, no únicamente por hover. Usar botones para expandir y enlaces reales para navegar, dentro de `<nav aria-label="Navegación principal">`. Preferir el patrón disclosure con tabulación normal; no aplicar `role="menu"` a una lista de enlaces si no se implementa su interacción de teclado completa.

Un desplegable tiene superficie `surface-raised`, radio 12px, sombra de popover y nivel 20. Alinear con su activador y ajustar al viewport; limitar altura y permitir scroll interno si la lista es larga. `Escape` cierra y devuelve el foco al activador. Cerrar al seleccionar un destino; un click exterior también puede cerrar. No atrapar el foco en un desplegable no modal.

Búsqueda, notificaciones y perfil deben tener nombre accesible. Mostrar contadores solo con datos reales y comunicar su significado; no añadir un punto rojo decorativo. En móvil conservar acceso a las utilidades mediante el menú aunque sus botones dejen de estar expuestos en la barra.

#### Responsive

- **Escritorio:** marca, destinos y utilidades en la misma barra horizontal. Agrupar en «Más» según el espacio real disponible.
- **Tablet:** conservar la barra superior; compactar utilidades y agrupar destinos. Si las etiquetas no caben, usar el mismo menú de navegación de móvil.
- **Móvil:** la marca permanece en la cabecera y los destinos prioritarios se presentan en un dock inferior fijo de 3–5 accesos. Si existen más destinos autorizados, el último espacio se convierte en «Más» y abre una hoja inferior desplazable con el resto de módulos y utilidades.
- El menú móvil se limita al alto visible disponible y permite desplazarse; no exige que el usuario haga scroll horizontal. Al cambiar de breakpoint, limpiar estados abiertos incompatibles y conservar la ruta actual.

No introducir sidebar como sustituto de esta estructura. La navegación inferior móvil está permitida como adaptación táctil de la navbar superior, no como una columna permanente. Los inspectores laterales de expedientes siguen siendo paneles de contenido contextual y no forman parte de la navegación principal.

### 3.2 Cabecera de trabajo

La cabecera del módulo se sitúa debajo de la navbar global y no repite sus enlaces ni utilidades. Dos niveles consistentes: ubicación y contexto arriba; título, vistas y acciones debajo. El título usa 28–36px en páginas de entrada, 24–28px en bandejas densas. Puede acompañarse de un contador discreto, periodo o ámbito. Una sola acción primaria por zona de tarea.

Nada de contenedor blanco con borde alrededor de toda la cabecera. Un encabezado abierto sobre el lienzo hace visible la jerarquía y evita la apariencia de plantilla de tarjetas.

### 3.3 Trazabilidad como firma

Para solicitudes y expedientes con un flujo conocido, representar etapas reales mediante nodos y conectores finos: completada, actual, pendiente y bloqueada. Añadir texto, responsable y fecha cuando estén disponibles. La etapa actual se enfatiza con cobalto; los conectores son neutros.

En móvil, convertir la secuencia en una lista vertical o en un resumen de etapa actual con acceso al historial. No encoger los nombres hasta hacerlos ilegibles. Etapas, aprobaciones y fechas provienen del proceso real, no de una secuencia inventada por el diseño.

### 3.4 Composición por prioridad

Inicio: una bandeja de trabajo dominante y un panel menor de contexto. Listados: tabla o lista continua. Expedientes: contenido central y panel contextual. Reportes: gráfico principal y comparaciones subordinadas.

La asimetría responde al contenido. No convertir cada pantalla en una cuadrícula «bento» ni alterar el orden lógico de lectura para producir una composición vistosa.

## 4. Color y temas

| Rol | Claro | Oscuro | Uso |
|---|---|---|---|
| Canvas | `#F3F5F7` | `#101820` | Fondo global |
| Surface | `#FFFFFF` | `#18232F` | Contenido y controles |
| Surface subtle | `#EAF0F4` | `#213140` | Agrupación secundaria, hover |
| Surface raised | `#FFFFFF` | `#263A4C` | Menús y overlays |
| Text | `#172B3A` | `#EEF3F7` | Lectura principal |
| Text secondary | `#586A79` | `#B4C2CF` | Metadatos legibles |
| Border | `#DCE3E9` | `#3B4D5E` | Separación decorativa |
| Border control | `#7B8B99` | `#7D90A2` | Identificación de inputs y controles |
| Action | `#2458D3` | `#91B5FF` | CTA, enlace o selección |
| On action | `#FFFFFF` | `#101820` | Texto sobre botón primario |
| Focus | `#2458D3` | `#91B5FF` | Foco visible |

**Distribución orientativa:** predominan los neutros; el color de acción se concentra en decisiones y selección. No medir un porcentaje rígido de píxeles ni sacrificar claridad para cumplirlo.

El azul informativo comunica «En revisión» mediante tokens `info`; no convierte cada badge en un enlace. Los enlaces dentro de texto llevan subrayado. Los colores de éxito, alerta y error no se usan como decoración de módulos.

### Tokens CSS de referencia

```css
:root {
  color-scheme: light;
  --canvas: #F3F5F7;
  --surface: #FFFFFF;
  --surface-subtle: #EAF0F4;
  --surface-raised: #FFFFFF;
  --text: #172B3A;
  --text-secondary: #586A79;
  --border: #DCE3E9;
  --border-control: #7B8B99;
  --action: #2458D3;
  --action-hover: #1D47B0;
  --on-action: #FFFFFF;
  --selected: #EAF0FF;
  --focus: #2458D3;
  --nav: #182838;
  --nav-active: #263C50;
  --nav-text: #C5D1DC;
  --nav-selected-text: #FFFFFF;
  --nav-marker: #91B5FF;
  --success-bg: #E6F4ED;
  --success-text: #166344;
  --warning-bg: #FFF3D6;
  --warning-text: #805500;
  --danger-bg: #FDECEF;
  --danger-text: #B42336;
  --danger-solid: #B42336;
  --info-bg: #EAF0FF;
  --info-text: #234BA4;
  --radius-badge: 6px;
  --radius-control: 8px;
  --radius-panel: 12px;
  --radius-overlay: 16px;
  --shadow-popover: 0 8px 24px rgb(16 24 32 / 12%);
  --shadow-overlay: 0 24px 64px rgb(16 24 32 / 22%);
  --duration-fast: 100ms;
  --duration-panel: 200ms;
  --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
  --control-height: 40px;
  --row-height: 48px;
}
[data-theme="dark"] {
  color-scheme: dark;
  --canvas: #101820;
  --surface: #18232F;
  --surface-subtle: #213140;
  --surface-raised: #263A4C;
  --text: #EEF3F7;
  --text-secondary: #B4C2CF;
  --border: #3B4D5E;
  --border-control: #7D90A2;
  --action: #91B5FF;
  --action-hover: #B3CCFF;
  --on-action: #101820;
  --selected: #253D5D;
  --focus: #91B5FF;
  --nav: #111D29;
  --nav-active: #263C50;
  --success-bg: #173D30;
  --success-text: #9FE0BB;
  --warning-bg: #40331A;
  --warning-text: #F2D08A;
  --danger-bg: #44252E;
  --danger-text: #FFB4BF;
  --info-bg: #243650;
  --info-text: #B4CDFF;
  --shadow-popover: 0 8px 24px rgb(0 0 0 / 24%);
  --shadow-overlay: 0 24px 64px rgb(0 0 0 / 36%);
}
[data-density="compact"] {
  --control-height: 36px;
  --row-height: 40px;
}
@media (pointer: coarse), (max-width: 767px) {
  :root, [data-density="compact"] {
    --control-height: 44px;
    --row-height: 56px;
  }
}
:where(button, a, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 3px;
}
/* El cobalto oscuro no sirve de foco sobre la navegación naval. */
.fam-nav {
  --focus: var(--nav-marker);
}
.fam-numeric { font-variant-numeric: tabular-nums; }
.fam-id { font-family: 'Geist Mono', ui-monospace, monospace; }
@media (prefers-reduced-motion: reduce) {
  .fam-motion {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}
```

Integrar los tokens en el proveedor de tema existente. La preferencia explícita del usuario prevalece; «Sistema» sigue `prefers-color-scheme`. Evitar el destello de tema incorrecto al cargar. Las variables por sí solas no implementan persistencia ni detección de preferencias.

Los bordes decorativos no necesitan funcionar como identificadores de controles. Para campos, checkbox y límites imprescindibles de componentes usar `border-control`, no `border`. Comprobar cada pareja y estado sobre su fondo real.

## 5. Tipografía, ritmo e iconos

Mantener Geist para preservar continuidad. Preferir la fuente variable si está disponible; si solo existen pesos estáticos, resolver 650 como 600. Cargar únicamente los archivos necesarios con `font-display: swap`.

| Uso | Tamaño | Peso | Tratamiento |
|---|---|---|---|
| Título de entrada | 28–36px | 650 | Tracking −0.03em, máximo uno |
| Título operativo | 24–28px | 600 | Menor altura en bandejas |
| Sección | 20px | 600 | Tracking −0.015em |
| Título de panel | 16px | 600 | Breve, sin subtítulo redundante |
| Interfaz y tabla | 14px | 400/500 | Interlineado 1.5 |
| Lectura y campo móvil | 16px | 400 | Cómodo para lectura y captura |
| Etiqueta / metadato | 13px | 400/500 | Contraste completo |
| Nota secundaria | 12px | 400 | Uso excepcional, nunca acción principal |
| Métrica principal | 28–40px | 600 | Cifras tabulares, sin icono ornamental |

Usar `rem` para tamaños tipográficos. La jerarquía combina tamaño, peso, espacio y posición: no exige una diferencia arbitraria de peso entre todos los niveles. Importes alineados a la derecha con cifras tabulares; mono reservado a códigos y datos técnicos copiables. Fechas pueden usar Geist normal con cifras tabulares.

Escala espacial: 4, 8, 12, 16, 20, 24, 32 y 48px. Relacionados a 8–12px, grupos a 16–24px y secciones a 32–48px. En listas densas reducir espacio vertical antes de reducir la legibilidad.

Una única familia de iconos lineales, preferentemente la ya instalada. Tamaños 16, 20 y 24px; grosor consistente. Un icono apoya una acción o entidad: no añadir un cuadrado de color a cada encabezado. Tooltips complementan etiquetas; no sustituyen nombres accesibles.

## 6. Layout global y adaptación

`DashboardLayout` proporciona fondo, scroll principal y padding responsive. No añade `max-width`, `mx-auto`, tarjeta, borde, sombra ni radio global. Root de módulo: `WORKSPACE_PAGE_CLASS`, equivalente a `flex min-w-0 flex-col`.

Conservar el espacio operativo: `px-2 py-2`, `sm:px-4 sm:py-4`, `lg:px-6 lg:py-6`, `2xl:px-8`. El espaciado adicional corresponde al contenido del módulo. Prohibir márgenes negativos compensatorios en `WORKSPACE_2COL_CLASS` y `WORKSPACE_3COL_CLASS`.

| Ancho disponible | Composición |
|---|---|
| <768px | Navbar superior compacta con menú desplegable; contenido en una columna; inspector como pantalla completa |
| 768–1199px | Navbar horizontal con destinos agrupados o menú compacto; contenido fluido; detalle bajo demanda |
| ≥1200px | Navbar horizontal completa; contenido a todo el ancho; inspector opcional de 320–400px |
| ≥1600px | Más columnas útiles, no aumento ilimitado del tamaño de fuente |

Los breakpoints orientan; la aparición del inspector depende del ancho restante real. Si una tabla pierde sus columnas esenciales, cerrar el panel lateral o abrir el detalle en ruta propia. No forzar tres columnas por alcanzar un ancho fijo.

Lecturas y formularios lineales pueden limitar su ancho a 65–75ch o a 720–880px según campos. Tablas, kanban, bandejas, reportes y dashboards operativos permanecen fluidos.

Por defecto hay un scroll vertical principal. Un inspector puede tener scroll independiente si lo necesita; una tabla puede desplazarse horizontalmente dentro de su región. No introducir scroll dentro de cada tarjeta ni usar `min-h-screen` en páginas dentro del layout. Kanban puede tener columnas con scroll si la interacción lo requiere y se verifica con teclado y móvil.

En móvil: respetar safe areas, evitar que la navbar superior o su menú oculten el foco y mantener acceso al CTA durante captura. Una pantalla alta es válida cuando organiza bien una tarea; el objetivo no es eliminar todo scroll. Verificar 320px de ancho, zoom y teclado virtual.

## 7. Recetas de pantalla: decisiones de composición

Estas recetas describen estructura. Los ejemplos de texto no son datos de producción.

### Inicio operativo

- Cabecera abierta «Mi jornada» o el nombre vigente del módulo, con fecha y ámbito de trabajo.
- Franja horizontal de hasta tres indicadores relevantes, sin tarjetas independientes ni iconos decorativos. Cada indicador explica su periodo y permite ir al detalle si existe.
- Área dominante: «Requiere tu acción», con solicitudes reales ordenadas por la prioridad definida por el negocio. Mostrar estado, responsable, vencimiento y siguiente paso.
- Columna secundaria: asistencia y agenda o actividad real. En móvil, priorizar asistencia cuando corresponda al rol y después la bandeja.
- Accesos secundarios como lista compacta o menú; no un mosaico de doce tarjetas idénticas.

### Bandeja de solicitudes / aprobaciones

Cabecera con título, contador y «Nueva solicitud» si el rol puede crear. Debajo: vistas guardadas o pestañas existentes, búsqueda y filtros. Tabla continua en una superficie, con encabezado tranquilo y líneas horizontales sutiles.

Orden inicial sugerido: solicitud, solicitante, estado, vencimiento y responsable; incluir monto cuando sea relevante. Mantener visibles las columnas esenciales y permitir configurar las demás si está implementado. Inspeccionar un registro abre el panel contextual y conserva filtros, selección y posición.

### Expediente o detalle

Título con nombre y código copiable. Debajo, estado y etapa actual; después, contenido principal agrupado con separadores. Columna de contexto para responsable, fechas y acciones. Historial real como lista cronológica, con actor y momento; distinguir comentarios de cambios de estado.

Una aprobación muestra el objeto, alcance y consecuencia antes de confirmar. No comunicar éxito definitivo antes de recibir confirmación del servidor.

### AttendanceWidget

El estado actual tiene prioridad: «Sin registro», «Jornada iniciada» o el estado real equivalente. Hora, lugar o condiciones se muestran solo cuando existen y son pertinentes. Una única acción dominante, altura mínima de 48px y sin animación de transformación al marcar.

En el inicio móvil, situar el widget arriba para facilitar el registro. Verificar la acción visible en 390×844px a escala normal; con zoom, pantallas menores o teclado abierto permitir scroll accesible. No asumir que «390px» define por sí solo un viewport completo.

Mostrar inmediatamente «Registrando…», prevenir envíos duplicados y conservar el estado previo ante fallo. Presentar «Registro confirmado» solo tras la respuesta real. No simular asistencia, ubicación ni sincronización pendiente.

### Compras, servicio y formularios largos

Formulario en página dedicada cuando necesite varias secciones, adjuntos o navegación propia. Resumen lateral de lo capturado cuando ayude a decidir. Etapas visibles solo si el proceso tiene etapas reales. Validación junto al campo y resumen navegable de errores al enviar.

Las tarjetas kanban contienen información para decidir: referencia, responsable, vencimiento y próximo paso. Los colores pertenecen a estados o alertas. El movimiento entre columnas necesita alternativa accesible por menú y validación de permisos.

## 8. Componentes y estados

### Botones

Radio 8px; 36px en escritorio compacto, 40px por defecto, al menos 44px en táctil. Primario sólido sin sombra. Secundario con borde funcional. Ghost para acciones de menor jerarquía. Danger solo para acciones destructivas; «Cancelar» es neutral.

Hover cambia el color; pressed lo refuerza sin mover filas ni deformar controles. No escalar todos los botones. Mantener etiqueta durante carga y añadir estado accesible. Bloquear envíos duplicados desde el inicio, aunque el indicador de carga tenga un breve retraso para evitar destellos.

Los enlaces navegan; los botones ejecutan. Cursor de mano en enlaces y botones, cursor de texto en campos. El cursor no reemplaza semántica HTML ni feedback.

### Tablas y listas

Filas de 48px, 40px en compacto y al menos 56px cuando el contenido móvil lo necesite. Son alturas mínimas: permitir crecimiento por salto de línea o zoom. Padding horizontal de 12–16px. Sin líneas verticales por defecto.

Hover de superficie; selección con fondo `selected`, checkbox y estado accesible. Ordenamiento con botón en la cabecera y `aria-sort`. La acción principal del registro debe ser un enlace o botón real, aunque exista click auxiliar sobre la fila. Los controles internos no deben disparar la navegación de la fila.

Importes alineados a la derecha, texto a la izquierda. Acciones secundarias disponibles por menú accesible; no depender del hover. Barra de acciones masivas solo al seleccionar. Conservar paginación, filtros y retorno al registro. Virtualizar únicamente si el volumen lo justifica, verificando lectores de pantalla.

En móvil, presentar como lista resumida cuando la comparación por columnas no sea esencial; para comparación tabular conservar tabla con desplazamiento horizontal y señal clara de continuación.

### Paneles y superficies

Panel estándar: radio 12px, borde decorativo, sin sombra. Padding de 20px en escritorio y 16px en móvil. Secciones internas con espacio o separadores, evitando tarjeta dentro de tarjeta.

Un panel informativo no tiene hover ni cursor de acción. Un panel interactivo tiene acción identificable y foco. Las sombras de popover y overlay se reservan a capas flotantes. En oscuro, la elevación se expresa además mediante superficies más claras.

### Badges, filtros y estados

Badges de estado con radio 6px, texto en formato oración y color semántico. «Pendiente», «En revisión», «Aprobado» y «Vencido» son ejemplos; usar el vocabulario real del proceso. No comunicar estado exclusivamente mediante color.

Filtros seleccionables pueden ser pastillas con control para quitar. Su apariencia debe distinguirse de una etiqueta informativa. No añadir un punto de color a todas las etiquetas si no aporta una distinción.

### Campos

Label visible de 13px, texto de captura de 14px en escritorio y 16px en móvil. Ayuda vinculada con `aria-describedby`; error con `aria-invalid`. Mantener lo ingresado después de fallos.

Diferenciar obligatorio, opcional, solo lectura y deshabilitado. No reducir la opacidad de todo el formulario. Estados disabled pueden tener tratamiento atenuado, pero la explicación debe seguir siendo legible. Autosave solo cuando existe soporte, mostrando guardando, guardado y fallo reales.

## 9. Elegir inline, inspector, modal o página

| Necesidad | Patrón preferido | Condición |
|---|---|---|
| Cambiar un atributo simple | Inline | Validación y cancelación claras, sin desorganizar la vista |
| Consultar detalle mientras se compara una lista | Inspector lateral | Ancho suficiente y contexto preservado |
| Acción breve y autocontenida | Modal del sistema | Foco temporal; no necesita URL propia |
| Decisión destructiva de impacto | Confirmación del sistema | Explicar objeto y consecuencia |
| Captura con adjuntos, etapas o varias secciones | Página dedicada | URL, volver, conservar borrador si existe |
| Selector largo en móvil | Sheet o diálogo | Búsqueda y selección accesibles |
| Leer secciones secundarias | Accordion | El contenido principal sigue comprensible |

El número de campos orienta, pero no decide por sí solo. No abrir un modal automáticamente porque aparezca scroll. No encadenar modales para completar un proceso largo.

Reutilizar `<Modal>` y primitives existentes. En móvil, sheets para selección breve; captura larga en pantalla completa o página. No asumir que todo modal se transforma automáticamente en sheet: comprobar el componente real.

Al abrir un diálogo, ubicar el foco según su contenido, contenerlo mientras sea modal y devolverlo al activador al cerrar. Para textos largos, el título puede recibir foco inicial. `Escape` cierra cuando sea seguro; los cambios sin guardar siguen el patrón de confirmación existente.

Escala global: sticky 10, dropdown 20, backdrop 30, modal 40, toast 50. Popovers dentro del modal pertenecen a su contexto de apilado o al mecanismo del primitive; no enviarlos a un portal global por debajo del diálogo. Los toasts informan sin cubrir su acción principal.

## 10. Motion, rendimiento y asincronía

El movimiento comunica origen, continuidad o resultado. Navegación y trabajo repetitivo responden de inmediato; ningún usuario debe esperar una transición para poder actuar.

| Elemento | Duración | Tratamiento |
|---|---|---|
| Hover / pressed | 100ms | Color y borde |
| Tooltip | 120ms | Opacidad; delay inicial breve |
| Menú | 160ms | Opacidad y desplazamiento ≤4px desde su origen |
| Modal | 200ms | Opacidad; escala opcional 0.98 → 1 |
| Drawer | 240ms | Entrada corta y orientación espacial |
| Asistencia / selección de fila | Inmediata | Sin transformación |

Respetar `prefers-reduced-motion` en CSS y librerías; conservar mensajes de progreso aunque se retire la animación. No animar la entrada de todas las filas ni hacer cascadas en cada navegación. Hover solo con `@media (hover: hover)`.

Preferir `transform` y `opacity` cuando se necesite movimiento, sin prometer aceleración GPU por una sintaxis concreta. Medir en los dispositivos objetivo; no introducir librerías pesadas para animaciones que CSS resuelve.

### Esperas y resultados

| Situación | Feedback |
|---|---|
| Acción rápida | Respuesta inmediata y protección contra duplicación |
| Petición en curso | Indicador local; conservar el contenido útil |
| Primera carga sin datos | Skeleton con estructura estable si la espera es perceptible |
| Exportación o proceso largo | Estado persistente y resultado accesible; ejecución en segundo plano solo si está soportada |
| Transacción que exige impedir interacción | Bloquear únicamente el ámbito necesario con explicación |
| Fallo parcial | Error junto a la región fallida y reintento seguro |

La duración por sí sola nunca impone un overlay bloqueante. No inventar porcentajes, estimaciones, cancelación ni colas offline. Usar progreso determinado solo cuando exista medición; de lo contrario, describir la etapa real. Un reintento debe considerar si la operación anterior pudo completarse.

Skeletons discretos, sin cambiar la geometría del contenido; animación opcional. Toast para confirmaciones breves no esenciales. Errores, decisiones y acciones que requieren tiempo permanecen hasta resolverse o descartarse. Anunciar resultados con `role="status"`; errores urgentes con `role="alert"` cuando proceda.

Distinguir vacíos: todavía no hay registros, filtros sin coincidencias, acceso restringido y fallo de conexión. Cada uno tiene explicación y acción apropiada. No presentar un cero cuando los datos no pudieron cargarse.

## 11. Datos, gráficos y contenido

Mostrar cifras reales, periodo, unidad y actualización cuando sea relevante. Mantener el formato local del producto; usar `Intl.NumberFormat` e `Intl.DateTimeFormat` con locale, moneda y zona configurados. Los contadores operativos siempre usan cifras. Fechas ambiguas deben acompañarse de contexto.

Gráficos con un propósito claro: tendencia, comparación o composición. Evitar 3D, degradados ornamentales, indicadores circulares de adorno y sparklines sin datos. Un gráfico relevante puede usar más color que una tabla; la restricción de acción no debe impedir entender una visualización.

Para varias series, usar una paleta de datos separada: azul `#2458D3`, violeta `#7654A3`, verde azulado `#167D8D` y tierra `#98613C`. Estos colores distinguen categorías; no representan aprobación o error. Verificar contraste en el tema real y añadir etiquetas, marcadores o trazos. En oscuro se necesitan variantes validadas, no reutilización automática de estos valores.

Todos los gráficos requieren alternativa textual o tabular; tooltips accesibles por teclado cuando contienen información adicional. No depender del color para distinguir series.

Copy en español directo: «Crear solicitud», «Guardar cambios», «Revisar aprobación». No mostrar tecnicismos internos salvo que ayuden al usuario. No afirmar una causa de error desconocida: «No se pudo guardar. Inténtalo de nuevo» es preferible a culpar a campos válidos. Añadir detalle de validación solo cuando el sistema lo confirma.

## 12. Accesibilidad como criterio de entrega

Objetivo de conformidad: WCAG 2.2 AA [4]. Este documento define requisitos; la conformidad se verifica en la implementación completa.

- Texto normal ≥4.5:1; texto grande ≥3:1. Grande: al menos 24px normal o aproximadamente 18.67px en negrita [5].
- Límites y estados visuales necesarios para identificar controles: ≥3:1 respecto a colores adyacentes. No confundir separadores decorativos con bordes funcionales.
- Foco visible y no oculto por cabeceras o barras; nombres accesibles en controles, HTML semántico y navegación por teclado.
- Objetivos táctiles internos de FamSPI: mínimo 44×44px; asistencia 48px. Es una exigencia de producto más generosa que el mínimo de 24×24 CSS px de WCAG 2.2 AA, sujeto a sus excepciones [4].
- Reflow a 320 CSS px salvo contenido que requiera dos dimensiones, como tablas; texto al 200% sin pérdida de funcionalidad.
- No depender de arrastrar, hover, color ni animación para completar tareas.
- Logo e imágenes informativas con alternativa apropiada; decorativas con `alt=""`.
- Revisar también modo oscuro, alto contraste del sistema, contenido largo, estados vacíos y formularios con errores.

## 13. Reglas para evitar un resultado genérico

**Toda pantalla nueva debe definir primero:** la tarea dominante, la información que la sostiene y un patrón FamSPI reconocible. Reutilizar componentes mantiene coherencia; copiar su composición indiscriminadamente produce monotonía.

| Evitar | Resolver así |
|---|---|
| Cuatro KPI idénticos con iconos de colores | Franja compacta con indicadores pertinentes y contexto |
| Gran bienvenida que desplaza el trabajo | Título breve y prioridades del usuario |
| Cards y botones redondeados de la misma forma | Radios por función |
| Todo encerrado en tarjetas | Lienzo abierto, paneles necesarios y separadores |
| Un color distinto por módulo | Identidad compartida y estados semánticos |
| Azul sólido en cada elemento seleccionado | Selección tonal; cobalto concentrado en decisiones |
| Glassmorphism en tablas y formularios | Superficies opacas y contraste estable |
| Brillos, texto degradado y fondos orbitales | Jerarquía tipográfica y datos reales |
| Adornos para sugerir IA | Capacidades reales, alcance y revisión humana cuando corresponda |
| Prohibir cualquier repetición | Repetición útil en filas, controles y registros comparables |

Un tratamiento atmosférico muy discreto podría evaluarse en una futura pantalla de acceso, fuera del área de trabajo, si aporta identidad de marca y cumple contraste. No es requisito ni permiso para llenar de gradientes los módulos.

## 14. Implementación y validación

### Secuencia de adopción

1. Inventariar tokens, componentes y consumidores del frontmatter. Mapear nombres existentes; confirmar el soporte de variables CSS y tema.
2. Actualizar fundamentos y shell: paleta, tipografía, radios, navbar horizontal superior y cabecera de módulo. Mantener rutas, permisos y lógica de negocio.
3. Aplicar la receta de bandeja a una pantalla real representativa, con inspector si existe soporte. Revisar con usuarios frecuentes antes de extender el patrón.
4. Aplicar inicio operativo y `AttendanceWidget`; después formularios, expedientes y reportes.
5. Extender tokens a modo oscuro y completar accesibilidad. Retirar aliases obsoletos solo al comprobar que no quedan consumidores.

No introducir refactorizaciones ajenas al diseño. Si una capacidad propuesta no existe, separar su implementación funcional de la actualización visual y presentar una interfaz completa con las capacidades disponibles.

### Checklist de aceptación

- [ ] La primera vista deja clara la tarea principal y su siguiente acción.
- [ ] Se reconocen navbar horizontal naval, jerarquía tipográfica y composición FamSPI.
- [ ] No existe espacio lateral reservado para navegación; en móvil, el dock inferior se reserva únicamente para los accesos prioritarios y «Más».
- [ ] Destinos, grupos «Trabajo»/«Herramientas»/«Administración» y el dock móvil funcionan con teclado, toque y etiquetas largas.
- [ ] El estado activo usa subrayado horizontal; el foco permanece visible al abrir y cerrar desplegables.
- [ ] La trazabilidad aparece cuando existe un proceso que representar.
- [ ] Los módulos comparten componentes sin repetir innecesariamente el mismo layout.
- [ ] No hay tarjeta global centrada ni pérdida innecesaria de ancho operativo.
- [ ] Tabla, cabecera e inspector conservan alineación y contexto.
- [ ] Radios, sombras y colores proceden de tokens.
- [ ] Cada estado interactivo tiene tratamiento claro en ambos temas.
- [ ] El recorrido por teclado funciona; foco, zoom y contraste se revisaron.
- [ ] Móvil permite completar la acción con teclado virtual y safe areas.
- [ ] Carga, error, vacío, contenido largo y permisos están contemplados.
- [ ] No se muestran métricas, progreso ni capacidades ficticias.
- [ ] El diseño no altera validaciones, aprobaciones ni permisos.

Validar visualmente con registros representativos y anonimizados. Comparar capturas de la misma tarea antes y después a 390, 768 y 1440px; añadir revisión de reflow a 320px y zoom. Observar si usuarios reales encuentran y completan una tarea frecuente, registrando tiempo, errores y comprensión. La satisfacción visual por sí sola no demuestra una mejora operativa.

## 15. Referencias

Consultadas el 3 de septiembre de 2026. Informan principios; los valores de tokens y las composiciones de FamSPI son decisiones de esta propuesta.

1. Linear. (12 de marzo de 2026). *UI refresh*. https://linear.app/changelog/2026-03-12-ui-refresh
2. Atlassian Design. *Design tokens explained*. https://atlassian.design/tokens/design-tokens
3. Atlassian Design. *Typography*. https://atlassian.design/foundations/typography/
4. W3C. *Web Content Accessibility Guidelines (WCAG) 2.2*. https://www.w3.org/TR/WCAG22/
5. W3C WAI. *Understanding Success Criterion 1.4.3: Contrast (Minimum)*. https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
