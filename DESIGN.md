---
name: FamSPI
description: Sistema de procesos internos de FAM — operaciones centralizadas para equipos de campo y oficina.
colors:
  naval-slate: "#1E293B"
  storm-slate: "#334155"
  midnight-slate: "#0F172A"
  action-blue: "#2563EB"
  sky-signal: "#0EA5E9"
  surface-white: "#FFFFFF"
  paper-white: "#F9FAFB"
  dark-surface: "#111827"
  dark-card: "#1F2937"
  ink-slate: "#1F2937"
  warm-ash: "#6B7280"
  fog: "#D1D5DB"
  soft-border: "#E5E7EB"
  operative-green: "#16A34A"
  green-soft: "#DCFCE7"
  alert-red: "#DC2626"
  red-soft: "#FEE2E2"
  caution-amber: "#D97706"
  amber-soft: "#FEF3C7"
typography:
  display:
    fontFamily: "'Geist', system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 2rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "'Geist', system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "'Geist', system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "'Geist', system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "'Geist', system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.01em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
zIndex:
  sticky: 10
  dropdown: 20
  modalBackdrop: 30
  modal: 40
  toast: 50
animation:
  durationButtonPress: "120ms"
  durationTooltip: "150ms"
  durationDropdown: "200ms"
  durationModal: "280ms"
  easingOut: "cubic-bezier(0.23, 1, 0.32, 1)"
  easingInOut: "cubic-bezier(0.77, 0, 0.175, 1)"
  easingDrawer: "cubic-bezier(0.32, 0.72, 0, 1)"
components:
  button-primary:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    activeScale: "0.97"
    transition: "120ms cubic-bezier(0.23, 1, 0.32, 1)"
  button-primary-hover:
    backgroundColor: "#1D4ED8"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    activeScale: "0.97"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.warm-ash}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  button-danger:
    backgroundColor: "{colors.alert-red}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    activeScale: "0.97"
  badge-neutral:
    backgroundColor: "#F3F4F6"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  badge-blue:
    backgroundColor: "#DBEAFE"
    textColor: "#1D4ED8"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  badge-green:
    backgroundColor: "{colors.green-soft}"
    textColor: "{colors.operative-green}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  badge-red:
    backgroundColor: "{colors.red-soft}"
    textColor: "{colors.alert-red}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  badge-amber:
    backgroundColor: "{colors.amber-soft}"
    textColor: "{colors.caution-amber}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  input-default:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    minHeight: "40px"
    focusBorder: "{colors.action-blue}"
    focusRing: "2px {colors.sky-signal}/20"
  card-default:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.lg}"
    padding: "20px"
    border: "1px solid {colors.soft-border}"
    shadow: "0 2px 10px rgba(0,0,0,0.06)"
---

# Design System: FamSPI

## 1. Carácter del sistema

**North Star: "El Escritorio Profesional"**

FamSPI vive en la oficina bien organizada: cada documento en su lugar, cada acción disponible sin buscar. La interfaz cede el espacio al usuario; los colores orientan, no decoran. La jerarquía se percibe antes de que el usuario la lea conscientemente.

El sistema no es un SaaS genérico ni una app de consumo. Es una herramienta de equipo usada en tres contextos físicos: oficina iluminada con múltiples pestañas abiertas, tablet en campo revisando entre reuniones, y mobile en movimiento para acciones rápidas. El diseño responde a los tres sin compromisos.

**Lo que distingue FamSPI visualmente:**
- Naval Slate como ancla estructural — no decoración, no "dark mode por moda"
- Action Blue aparece exactamente donde hay una decisión. Cuando se ve, el usuario sabe que ahí hace algo
- Radio de 16px como firma constante: más generoso que Bootstrap, más controlado que Material
- Sombras que revelan jerarquía, no que decoran superficies
- Status colors estrictamente semánticos — verde no "decora", verde dice "aprobado"

**La pregunta de la escena.** Antes de cada decisión de diseño significativa, escribe una oración sobre quién usa esto, dónde, bajo qué luz y en qué estado de ánimo. "Asesor comercial aprobando una solicitud de permiso desde el móvil en el estacionamiento antes de entrar a una reunión" fuerza mejores decisiones que "pantalla de aprobación". Si la oración no fuerza la respuesta, no es suficientemente concreta.

---

## 2. Colors: La Paleta Naval

Una paleta contenida: un único acento de acción sobre Slate Naval y grises neutros. La escasez del azul es lo que le da peso. Los colores de estado son semánticos — comunican condición, no decoran.

### Primary
- **Deep Naval Slate** `#1E293B` — Color estructural. Fondos de navegación, encabezados de sección, elementos de anclaje. Nunca fondo de card, nunca acento decorativo.
- **Storm Slate** `#334155` — Hover en navegación, bordes de card enfocada, texto sobre fondos oscuros.
- **Midnight Slate** `#0F172A` — Fondo de página en oscuro. Máxima profundidad.

### Action
- **Action Blue** `#2563EB` — El único color de acción. Botones primarios, enlaces activos, indicadores de progreso, estados activos en navegación. Aparece en ≤10% de cualquier pantalla.
- **Sky Signal** `#0EA5E9` — Focus rings, notificaciones, estados secundarios.

### Neutral
- **Surface White** `#FFFFFF` — Fondo de cards, paneles, formularios.
- **Paper White** `#F9FAFB` — Fondo de página. Separación sutil respecto al blanco puro.
- **Dark Surface** `#111827` — Fondo de página en oscuro.
- **Dark Card** `#1F2937` — Cards en oscuro.
- **Ink Slate** `#1F2937` — Texto principal y títulos.
- **Warm Ash** `#6B7280` — Texto secundario, placeholders, timestamps.
- **Fog** `#D1D5DB` — Bordes de inputs, separadores, líneas de tabla.
- **Soft Border** `#E5E7EB` — Bordes de cards en reposo.

### Status (solo semántico, nunca decorativo)
- **Operative Green** `#16A34A` / soft `#DCFCE7` — Aprobado, activo, presente, completado.
- **Alert Red** `#DC2626` / soft `#FEE2E2` — Rechazado, error, destructivo, vencido.
- **Caution Amber** `#D97706` / soft `#FEF3C7` — Pendiente, parcial, por revisar.

### Reglas nombradas

**The Sparrow Rule.** Action Blue toca ≤10% de cualquier pantalla. Encabezados azules, fondos azules, bordes decorativos azules: prohibidos. La duda se resuelve con "no".

**The Naval Structure Rule.** Deep Naval Slate es estructura. Navegación y elementos de anclaje. Nunca fondo de card.

**The Semantic Seal.** Verde/rojo/ámbar no aparecen como color de marca, de bienvenida ni de decoración de sección. Cuando el usuario ve rojo, algo requiere atención. Cuando ve verde, algo fue aprobado. Si se usa por estética, pierde todo su significado.

**El test del contexto nocturno.** En modo oscuro, los colores de estado deben mantener ≥4.5:1 de contraste sobre el fondo oscuro. No reducir chroma sin verificar.

---

## 3. Typography: Geist

**Display + Body:** Geist — fallback `system-ui, -apple-system, sans-serif`
**Mono:** Geist Mono — para IDs, montos, fechas exactas, cualquier valor que el usuario pueda necesitar copiar.

**Carácter.** Geist tiene la precisión de una fuente técnica sin la frialdad monoespaciada. El tracking negativo en display y headline (-0.02em / -0.01em) refuerza la sensación de herramienta de alto rendimiento — apretada, sin ornamentos. El contraste de peso entre niveles es deliberado: ≥150 de diferencia en font-weight entre pasos crea jerarquía real.

### Jerarquía

| Nivel    | Peso | Tamaño                   | Line-height | Tracking | Uso |
|----------|------|--------------------------|-------------|----------|-----|
| Display  | 700  | clamp(1.5rem, 3vw, 2rem) | 1.2         | -0.02em  | Título de módulo. Máximo 1 por pantalla. |
| Headline | 600  | 1.25rem (20px)           | 1.3         | -0.01em  | Sección, modal header, card con peso propio. |
| Title    | 600  | 1.125rem (18px)          | 1.4         | 0        | Card secundaria, encabezado de tabla. |
| Body     | 400  | 0.875rem (14px)          | 1.6         | 0        | Contenido. Máx 70ch en lectura larga. |
| Label    | 500  | 0.75rem (12px)           | 1.4         | 0.01em   | Etiqueta de campo, metadata, timestamp. |

### Reglas nombradas

**The Geist Mono Rule.** IDs, montos en viáticos, fechas en tablas de asistencia van en `font-mono`. La diferencia es sutil pero marca que ese dato es exacto y copiable.

**La regla de contraste tipográfico.** Nunca dos niveles adyacentes con el mismo peso. Si el título es 600, el subtítulo que le sigue es 400, no 500. La jerarquía se lee en la escala de pesos antes que en el tamaño.

**Mayúsculas solo para labels de estado en badges.** `PENDIENTE` dentro de un badge ámbar funciona porque el color ya da el contexto. En texto corrido, nunca. En encabezados de sección, nunca.

---

## 4. Elevation: Estratificada

Las sombras revelan jerarquía, no decoran superficies. En reposo, las superficies son planas. La sombra aparece como respuesta a estado o como señal de una capa genuinamente superior.

### Vocabulario de sombras

| Nombre     | Valor                                                               | Uso |
|------------|---------------------------------------------------------------------|-----|
| Ambient    | `0 2px 10px rgba(0,0,0,0.06)`                                      | Cards en reposo. |
| Lifted     | `0 4px 16px rgba(0,0,0,0.10)`                                      | Hover, focus, panel activo. |
| Structural | `0 15px 35px rgba(15,23,42,0.08)`                                  | Paneles flotantes, sidebars. |
| Overlay    | `0 20px 60px rgba(15,23,42,0.18), 0 4px 16px rgba(15,23,42,0.10)` | Modales, dropdowns. |

En modo oscuro: las sombras se reducen a la mitad de opacidad. La elevación se expresa principalmente con tonal layering (superficies más claras en capas superiores).

**The Flat-Then-Lift Rule.** Una card que nace con sombra dramática le quita impacto al hover y confunde la jerarquía. Ambient en reposo, Lifted como respuesta.

**Nunca inventar valores.** Si la sombra necesitada no existe en la escala, revisar si el diseño es correcto — probablemente el elemento no necesita esa elevación.

---

## 5. Z-Index: Escala fija

No se usan valores arbitrarios. Toda capa tiene una posición semántica:

| Capa            | Valor | Descripción |
|-----------------|-------|-------------|
| Sticky header   | 10    | Headers fijos al scroll |
| Dropdown        | 20    | Menús flotantes, selects, popovers |
| Modal backdrop  | 30    | Overlay oscuro detrás del modal |
| Modal           | 40    | El modal en sí |
| Toast / Snack   | 50    | Notificaciones — siempre encima de todo |

Nunca `z-index: 9999`. Si hay conflicto, revisar cuál capa está mal posicionada.

---

## 6. Motion: Sistema de animación

*(Aportación directa del principio "unseen details compound" — Emil Kowalski / Design Engineering)*

Las animaciones existen para tres propósitos válidos: orientación espacial, feedback de estado, y prevención de cambios abruptos. Si el propósito no es uno de estos tres, la animación no se incluye.

### La decisión antes del código

Antes de animar cualquier cosa, responde:

**¿Con qué frecuencia lo verá el usuario?**

| Frecuencia             | Decisión |
|------------------------|----------|
| 100+ veces/día (AttendanceWidget, comando rápido) | Sin animación. Nunca. |
| Decenas/día (hover, navegación entre secciones)   | Reducir o eliminar |
| Ocasional (modales, drawers, toasts)              | Animación estándar |
| Raro/primera vez (onboarding, confirmaciones)     | Puede incluir detalle |

**Regla crítica.** Nunca animar acciones iniciadas por teclado. Se repiten cientos de veces al día — la animación hace la UI sentirse lenta y desconectada.

### Duraciones

| Elemento                          | Duración |
|-----------------------------------|----------|
| Press feedback (scale button)     | 100–160ms |
| Tooltip / popover pequeño         | 125–200ms |
| Dropdown, select                  | 150–250ms |
| Tab switch, content change        | 150–200ms |
| Modal open/close                  | 200–320ms |
| Drawer (lateral/bottom)           | 250–400ms |
| Spinner de carga                  | linear continuo — más rápido = más ágil percibido |

UI animations: máximo 300ms. Más lento = percibido como bug, no como elegancia.

### Curvas de easing

Los built-ins de CSS (`ease`, `ease-in-out`) son débiles. Usar curvas fuertes:

```css
/* Entradas y salidas de UI — fuerte al inicio */
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);

/* Movimiento en pantalla — aceleración/desaceleración natural */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);

/* Drawer bottom/lateral — curva tipo iOS */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
```

**Nunca `ease-in` para UI.** Empieza lento — exactamente en el momento en que el usuario mira más atento. Un dropdown con `ease-in` a 200ms se siente más lento que uno con `ease-out` a 250ms.

**La regla de dirección.** ¿El elemento entra o sale? → `ease-out`. ¿Se mueve en pantalla? → `ease-in-out`. ¿Hover / cambio de color? → `ease`. ¿Movimiento continuo? → `linear`.

### Implementación: patrones concretos

**Press feedback en botones y cards tappables:**
```css
.btn, .card-interactive {
  transition: transform 120ms cubic-bezier(0.23, 1, 0.32, 1);
}
.btn:active, .card-interactive:active {
  transform: scale(0.97);
}
```

Todo elemento presionable — botón, card de acción rápida, item de lista — debe dar feedback de escala al presionar. Sin esto, la UI parece no responder.

**Nunca animar desde scale(0).** Nada en el mundo real aparece de la nada. Empezar desde `scale(0.95) + opacity: 0`:
```css
/* Correcto */
.entering { transform: scale(0.95); opacity: 0; }

/* Incorrecto */
.entering { transform: scale(0); }
```

**Popovers y dropdowns — origin-aware.** El popover debe escalar desde su trigger, no desde el centro:
```css
.popover { transform-origin: var(--radix-popover-content-transform-origin); }
```
Excepción: modales. Los modales escalan desde el centro del viewport porque no están anclados a un trigger específico.

**Tooltips — skip en hover subsecuente:**
El primer tooltip tiene delay de entrada. Una vez que uno está abierto, el siguiente aparece instantáneamente al hacer hover (sin animación, sin delay). La toolbar entera se siente más rápida.

**CSS transitions > keyframes para UI interruptible.** Los transitions se retargetizan suavemente si el usuario cambia de estado a mitad de la animación. Los keyframes reinician desde cero. Para toasts, tabs, toggles: usar transitions.

**Hardware acceleration.** En Framer Motion, las propiedades shorthand (`x`, `y`, `scale`) corren en el main thread con rAF. Para hardware acceleration real:
```jsx
// Correcto — GPU
<motion.div animate={{ transform: "translateX(100px)" }} />

// Incorrecto — main thread
<motion.div animate={{ x: 100 }} />
```

**Reduced motion.** Siempre respetar `prefers-reduced-motion`:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Springs — cuándo usarlos

Springs no tienen duración fija; se resuelven según física. Usarlos solo para:
- Drag con momentum (drawers, cartas deslizables)
- Elementos que pueden interrumpirse mid-animation
- Decoraciones con mouse-tracking (no funcionales)

Para el 90% de UI de FamSPI: duration-based con custom easing es correcto y más predecible.

---

## 7. Components

### Buttons

Radio 16px como firma visual constante. Touch target mínimo 44px en mobile, 36px en desktop.

- **Primary:** Action Blue `#2563EB`, texto blanco, Ambient shadow en reposo, Lifted en hover. `scale(0.97)` en `:active`. Transición 120ms ease-out.
- **Secondary:** Fondo blanco, borde Fog, texto Ink Slate. Hover: Paper White + Lifted shadow.
- **Ghost:** Sin fondo ni borde. Texto Warm Ash. Hover: fondo `#F3F4F6`, texto Ink Slate.
- **Danger:** Alert Red, texto blanco. Solo para destructivas con confirmación previa. Nunca como "Cancelar".
- **Focus:** `outline: 2px solid #0EA5E9; outline-offset: 2px` — visible en todos los variantes.
- **Loading:** Deshabilitar el botón durante operaciones async. Nunca dejar que el usuario haga doble clic en submit.

### Badges / Chips

Pastillas `border-radius: 9999px`, fondo soft del color semántico, texto 12px/500.

| Variante | Fondo     | Texto      | Uso |
|----------|-----------|------------|-----|
| Neutral  | `#F3F4F6` | Ink Slate  | Sin connotación semántica |
| Blue     | `#DBEAFE` | `#1D4ED8`  | En proceso, informativo |
| Green    | `#DCFCE7` | `#16A34A`  | Aprobado, activo, presente |
| Red      | `#FEE2E2` | `#DC2626`  | Rechazado, error, vencido |
| Amber    | `#FEF3C7` | `#D97706`  | Pendiente, parcial |

### Cards

Fondo Surface White, borde Soft Border, sombra Ambient, radio 16px.

- **Interactivas:** hover → Lifted shadow + borde Fog. `scale(0.99)` en `:active` opcional.
- **No interactivas:** sin hover state. No añadir cursor ni sombra.
- **Padding:** 20px desktop, 16px mobile.
- **Nunca anidadas.** Si el contenido necesita sub-superficie: separador, cambio de `background-color` de sección, o indented layout.

### Inputs / Fields

- Fondo blanco, borde Fog, radio 12px, altura mínima 40px desktop / 44px mobile.
- Label siempre visible encima del campo (12px/500/Ink Slate). Nunca solo placeholder.
- Focus: borde Action Blue + ring 2px sky-signal/20.
- Error: borde Alert Red + mensaje debajo del campo en 12px/Alert Red. El error debe estar cerca del problema, nunca solo en la parte superior de la pantalla.
- Disabled: fondo Paper White, texto Warm Ash/50, cursor not-allowed.

### Navigation

**Desktop sidebar:** Naval Slate `#1E293B`. Ítems: texto blanco/70, icono 16px. Hover: Storm Slate. Activo: Action Blue, texto blanco.

**Mobile bottom bar:** Fondo blanco, borde superior Fog. Icono 20px + label 10px/500. Activo: Action Blue. Máximo 5 módulos.

**Tablet:** Sidebar colapsada a 56px, solo iconos, tooltip con nombre al hover.

### Workspace Layout

Páginas de módulo usan `WORKSPACE_PAGE_CLASS` (`"flex min-w-0 flex-col"`) como root. Las páginas de 3 columnas usan `WORKSPACE_3COL_CLASS`. El DashboardLayout provee el fondo de página y el max-width. Las páginas no declaran `min-h-screen`, `bg-gray-50`, ni `max-w-*` propios — eso rompe el scroll compartido.

### Signature: AttendanceWidget

Componente de mayor frecuencia de uso en mobile. Reglas inamovibles:
- Botón de acción principal siempre visible sin scroll en viewport de 390px.
- Estado actual en Headline (20px/600) con badge semántico adyacente.
- Sin cards anidadas.
- Touch targets ≥48px.
- **Sin animación en el botón de marcar.** Se usa decenas de veces al día.

---

## 8. Progressive Disclosure & Gestión del Scroll

Cada sección visible compite por el mismo presupuesto de scroll del viewport. Cuando una pantalla tiene demasiadas zonas de interacción simultáneas, el usuario pierde contexto y necesita hacer scroll para recordar qué decidió antes. Las reglas de esta sección evitan ese problema.

### El presupuesto de scroll

Una página bien diseñada en FamSPI tiene **como máximo dos zonas de scroll independientes**: el área de contenido principal y, opcionalmente, un panel lateral. Todo lo demás debe revelarse bajo demanda.

**Señales de que el scroll está fuera de control:**
- El usuario hace scroll para llegar a un formulario de acción (crear, editar, configurar)
- Una vista secundaria reemplaza la vista principal sin navegación real (un "modo" dentro de la misma página)
- Hay más de 3 paneles apilados verticalmente en el mismo flujo
- Un formulario inline empuja el contenido circundante hacia abajo

### Cuándo usar modal

| Situación | Patrón |
|-----------|--------|
| Formulario de creación (≤ 12 campos) | Modal `max-w-lg` o `max-w-2xl` |
| Formulario de edición puntual (1–5 campos) | Modal compacto `max-w-md` |
| Acción destructiva con confirmación | Modal `max-w-sm` |
| Detalle de un ítem de lista sin navegación | Modal `max-w-2xl` |
| Formulario de configuración compleja (> 12 campos) | Página dedicada o side panel |
| Vista que reemplaza la pantalla actual | Página dedicada con back button |

**Regla de la acción inline.** Si al hacer clic en "Nueva solicitud", "Revisar" o "Configurar" se sustituye el contenido principal de la pantalla por otro contenido, es una señal clara de que ese flujo debe ir en un modal o drawer — no como un "activeMainView" dentro de la misma página.

### Cuándo usar accordion

El accordion es para contenido de lectura-escritura donde el usuario necesita ver otros campos simultáneamente (ej.: secciones de un formulario largo con progreso visible por sección). **No** es para acciones independientes — un accordión con un formulario de crear/editar dentro es un modal mal disfrazado.

| Patrón | Correcto | Incorrecto |
|--------|----------|------------|
| Secciones de un perfil con autosave | Accordion | Modal |
| Formulario de "Iniciar requerimiento de salida" | Modal | Accordion anidado |
| Checklist operativo con items | Lista inline | Modal |
| Formulario de creación de solicitud | Modal | View takeover |

### Cuándo usar drawer / bottom sheet

El drawer lateral o bottom sheet es para contenido que:
- El usuario necesita ver junto al contenido principal (no lo reemplaza)
- En mobile se convierte en bottom sheet automáticamente (el `Modal` del sistema ya lo hace)
- Tiene múltiples acciones pero no requiere navegación propia

### La regla del selector mobile

En mobile, un selector de ítems (lista de solicitudes, colaboradores, aspirantes) nunca debe renderizarse inline expandiendo el layout. Debe abrirse como un bottom sheet/modal. El layout mobile tiene un solo scroll y el selector no debe empujar el contenido de trabajo hacia abajo.

### Jerarquía de patrones para evitar scroll

```
Acción puntual (1–3 campos)    → Popover o modal compacto
Formulario medio (4–12 campos) → Modal
Formulario largo (> 12 campos) → Página dedicada o side panel
Vista secundaria               → Modal fullscreen o página
Selector de ítem (mobile)      → Bottom sheet / Modal
Secciones de expediente        → Accordions con autosave
```

### Checklist anti-scroll

Antes de renderizar algo inline, responde:
- [ ] ¿Este contenido empuja otros elementos hacia abajo cuando aparece?
- [ ] ¿El usuario necesita hacer scroll para encontrar el botón de acción principal?
- [ ] ¿Se sustituye el contenido de trabajo principal para mostrar esto?
- [ ] ¿Hay más de 3 bloques de interacción simultáneos en la misma pantalla?

Si alguna respuesta es "sí", el contenido va en modal, drawer o página dedicada.

---

## 10. Interaction Design

*(Aportación de ui-ux-pro-max: touch, cursors, accessibility, feedback)*

### Touch y clickabilidad

- **`cursor-pointer`** en todo elemento interactivo. Sin excepción. Si se puede clickear, lo dice el cursor.
- **Touch targets mínimos:** 44×44px en cualquier elemento interactivo en mobile. No negociable.
- **`touch-action: manipulation`** en botones para eliminar el delay de 300ms en iOS/Android.
- **Hover states:** solo aplicar con `@media (hover: hover)`. En touch, el hover persiste — es un bug visual.

### Feedback de estado

- **Loading:** Deshabilitar botón durante async. Mostrar spinner dentro del botón, no reemplazar el texto. El spinner debe girar más rápido que un spinner genérico — velocidad percibida importa.
- **Error feedback:** Siempre cerca del problema. Un input con error muestra el mensaje debajo, no en un toast. Los toasts son para mensajes del sistema que no tienen campo asociado.
- **Success:** Toast con mensaje conciso. Duración 3–4s con dismiss manual opcional.
- **Empty states:** Nunca dejar una sección vacía sin explicación. Siempre: ícono neutral + una línea de qué esperar + acción si corresponde.

### Focus management

- Focus rings visibles en todos los elementos interactivos: `outline: 2px solid #0EA5E9; outline-offset: 2px`
- Nunca `outline: none` sin reemplazo visual.
- Al abrir un modal, el focus va al primer elemento interactivo del modal. Al cerrar, regresa al trigger.
- Tab order sigue el orden visual. Si el DOM no coincide con el visual, arreglarlo en el DOM, no con `tabindex`.

---

## 11. Loading y Empty States

*(Aportación de ui-ux-pro-max + frontend-design: perceived performance, atmosphere)*

### Skeletons

Para cualquier contenido que tarda >300ms en cargar: mostrar skeleton, no spinner de página completa. El skeleton tiene la misma forma que el contenido real — mismo número de líneas, misma proporción. Fondo `#F3F4F6` animado con pulso suave (opacity 0.5 → 1, 1.5s linear infinite). No usar gradients shimmer — penaliza en mobile de gama baja.

### Empty states

Anatomía estándar:
1. Ícono neutral en `#D1D5DB` (Fog), 40px
2. Línea principal en 14px/500/Ink Slate: qué hay aquí cuando hay datos
3. Línea secundaria opcional en 12px/Warm Ash: qué acción crea el primer dato
4. Botón de acción si corresponde (primary, variant="primary")

Nunca: ilustraciones complejas, texto de marketing, múltiples párrafos.

### Error states de red

- Mostrar el error cerca de los datos que fallaron, no en un banner de página completa.
- Incluir un botón "Reintentar" con acción concreta.
- Mensaje en español directo: "No se pudieron cargar los datos. Verifica tu conexión." No códigos de error al usuario.

---

## 12. Copy y Contenido

*(Aportación de impeccable: word economy, label hierarchy)*

**Cada palabra gana su lugar.** Si se puede eliminar y el significado no cambia, se elimina. Encabezados que repiten el título de la página, intros que dicen "En esta sección encontrarás...", subtítulos que son sinónimos del título: todos eliminados.

**Formato de etiquetas.** Las etiquetas de campo van en formato oración (primera letra mayúscula, resto minúsculas). Las etiquetas de estado en badges pueden ir en mayúsculas si el badge ya aporta el color semántico.

**Mensajes de error accionables.** "Error al guardar" no ayuda. "No se pudo guardar: verifica que todos los campos obligatorios estén completos" sí. El mensaje describe qué falló y qué hacer.

**Sin guión largo (—) en UI.** Usar coma, dos puntos, punto y coma, punto, o paréntesis. El em dash es ambiguo en pantallas pequeñas y rompe flow de lectura. En código, tampoco `--`.

**Números en texto.** Del 1 al 9: escribir la palabra ("tres solicitudes"). Del 10 en adelante: cifra ("45 solicitudes"). IDs, montos y fechas exactas: siempre cifras en Geist Mono.

---

## 13. El Estándar de Craft

*(Aportación de impeccable: the AI slop test, category-reflex check)*

### El test del slop

Si alguien puede mirar la interfaz y decir "una IA hizo esto" sin dudarlo, el diseño falló. Los síntomas:

- Cada sección tiene su propio color temático sin razón semántica (arcoíris visual)
- Los KPIs son siempre: número grande, label pequeña, ícono de colorcito, sombra de colorcito
- Las cards de acción son un grid de tarjetas idénticas: ícono + título + descripción, todas iguales
- El estado activo de un tab usa gradient azul
- Cada módulo parece hecho por un equipo diferente
- La sección de "estadísticas" tiene fondos gradientes por card individual

### El test del reflejo

Si alguien puede adivinar la paleta de color y la estética solo con saber el tipo de producto, el diseño falló. El reflejo a evitar: "app empresarial interna → azul corporativo + grays". FamSPI es azul porque el azul está reservado exclusivamente para acciones — no porque sea "corporativo". Si la respuesta al por qué del azul es "parecemos enterprise", el color está mal usado.

### Bans absolutos

Estos elementos se reconocen y se rechazan sin excepción:

| Elemento | Por qué está baneado | Alternativa |
|----------|---------------------|-------------|
| `border-left > 1px` como acento de color en cards o lista items | Side-stripe decorativa — cliché de "alerta" | Fondo suave semántico, badge, o ninguno |
| `background-clip: text` con gradiente | Texto gradiente — nunca meaningful | Color sólido, énfasis con peso o tamaño |
| Glassmorphism como default | `backdrop-blur` inconsistente entre módulos, penaliza mobile | Fondos sólidos Surface White |
| Hero-metric template | Número grande, label, stat supporting, gradient accent por card | Strip de datos en una sola superficie con dividers |
| Grid de cards idénticas | Ícono + título + texto × N, todas iguales | Jerarquía diferente entre items, lista con densidad variable |
| Modal como primera respuesta | Interrumpe cuando podría continuar inline | Inline form, progressive disclosure, side panel |
| Gradientes en fondos de cards de acción | Cada card tiene su propio color temático | Fondo blanco, icono del color semántico en badge pequeño |
| `min-h-screen` en páginas dentro de DashboardLayout | Crea scroll doble | `WORKSPACE_PAGE_CLASS` del layout system |

### Checklist pre-entrega

Antes de marcar un componente o página como listo:

**Visual**
- [ ] Sin `border-left > 1px` como acento de color
- [ ] Sin gradiente en texto
- [ ] Sin glassmorphism como default
- [ ] Sin cards anidadas dentro de cards
- [ ] Radio de 16px en todos los botones y cards
- [ ] Action Blue en ≤10% de la superficie

**Interacción**
- [ ] `cursor-pointer` en todos los elementos clickeables
- [ ] `scale(0.97)` en `:active` de botones y cards interactivas
- [ ] Touch targets ≥44px en mobile
- [ ] Botón deshabilitado durante operaciones async
- [ ] Focus ring visible en todos los elementos

**Contenido**
- [ ] Sin texto hardcodeado falso (fake data de ejemplo en producción)
- [ ] Empty state definido para todos los listados
- [ ] Mensajes de error accionables (no solo "Error")
- [ ] Sin em dashes en copy

**Estructura**
- [ ] Root de workspace usa `WORKSPACE_PAGE_CLASS`
- [ ] Sin `min-h-screen` en páginas dentro de DashboardLayout
- [ ] Modales usan `<Modal>` del sistema, no DIY `fixed inset-0`
- [ ] Z-index dentro de la escala definida

**Accesibilidad**
- [ ] Contraste WCAG AA: 4.5:1 texto, 3:1 UI elements
- [ ] `prefers-reduced-motion` respetado
- [ ] Labels sobre inputs (no solo placeholder)
- [ ] Alt text en imágenes funcionales

---

## 14. Accesibilidad

**Baseline obligatoria: WCAG AA**

- Contraste mínimo: 4.5:1 para texto normal, 3:1 para texto grande (≥18px/bold o ≥24px) y elementos UI.
- Focus rings visibles en todos los elementos interactivos. Nunca `outline: none` sin reemplazo.
- Imágenes informativas: `alt` descriptivo. Decorativas: `alt=""`.
- Formularios: label siempre asociada con `for`/`htmlFor`. Nunca solo placeholder.
- No depender exclusivamente del color para comunicar estado — siempre combinar con texto o ícono.
- `prefers-reduced-motion`: reducir o eliminar todas las transitions/animations cuando está activo.
- Tab order: lógico y predecible, siguiendo el flujo visual izquierda-derecha, arriba-abajo.

---

## 15. Do's and Don'ts (expandido)

### Do

- **Do** usar Deep Naval Slate para navegación y headers — da coherencia entre módulos.
- **Do** reservar Action Blue exclusivamente para botones primarios, links de acción y estados activos en navegación.
- **Do** mantener radio de 16px en botones y cards. La consistencia del radio es la firma visual del sistema.
- **Do** asegurar que la acción primaria sea alcanzable sin scroll en viewport de 390px.
- **Do** usar Geist Mono para IDs, montos, fechas exactas en tablas.
- **Do** seguir la escala de sombras (Ambient → Lifted → Structural → Overlay). Nunca inventar valores.
- **Do** garantizar WCAG AA en modo claro y oscuro.
- **Do** mostrar label encima del input siempre, nunca solo placeholder.
- **Do** usar `scale(0.97)` en `:active` en todos los elementos presionables.
- **Do** deshabilitar botones durante operaciones async.
- **Do** escribir la oración de escena antes de decidir dark vs light en componentes nuevos.
- **Do** usar `WORKSPACE_PAGE_CLASS` como root de cualquier página de módulo.
- **Do** agregar `cursor-pointer` a todo elemento interactivo.
- **Do** respetar `prefers-reduced-motion` eliminando transitions y animations.
- **Do** colocar mensajes de error cerca del campo o elemento que los originó.

### Don't

- **Don't** usar `backdrop-blur` con fondo semitransparente como default de cards.
- **Don't** replicar Bootstrap genérico: radios 4-6px, sombras azuladas, grids de tarjetas idénticas.
- **Don't** hacer que módulos distintos parezcan construidos por equipos distintos.
- **Don't** usar modal como primera respuesta. Agotar inline o progressive antes.
- **Don't** poner Action Blue en >10% de la superficie. Encabezados azules, fondos azules: prohibidos.
- **Don't** usar `border-left > 1px` como acento de color en cards o lista items.
- **Don't** usar gradientes en texto (`background-clip: text`).
- **Don't** anidar cards dentro de cards.
- **Don't** usar el mismo peso visual para toda la información en un dashboard.
- **Don't** animar acciones iniciadas por teclado o usadas 100+ veces/día.
- **Don't** animar desde `scale(0)`. Mínimo `scale(0.95) + opacity: 0`.
- **Don't** usar `ease-in` para entradas de UI — empieza lento donde el usuario mira.
- **Don't** aplicar gradientes en fondos de cards de acciones rápidas — cada una en su propio color es el problema.
- **Don't** usar `min-h-screen` dentro de DashboardLayout — rompe el scroll compartido.
- **Don't** dejar listados sin un empty state definido.
- **Don't** hardcodear datos de ejemplo en producción (fake stats, actividad reciente inventada).
- **Don't** inventar valores de z-index fuera de la escala definida (10/20/30/40/50).
- **Don't** mostrar mensajes de error genéricos. Cada error necesita contexto y siguiente paso.
- **Don't** usar colores de estado (verde/rojo/ámbar) como decoración de sección o marca visual.
