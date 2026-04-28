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
components:
  button-primary:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
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
  card-default:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.lg}"
    padding: "20px"
---

# Design System: FamSPI

## 1. Overview

**Creative North Star: "El Escritorio Profesional"**

FamSPI vive en la oficina bien organizada: cada documento en su lugar, cada carpeta etiquetada, cada acción disponible sin buscar. La interfaz no compite con el usuario — le cede el espacio para que trabaje. Los colores sirven para orientar, no para decorar. La jerarquía se siente antes de que el usuario la lea.

El sistema adopta un registro visual entre Rippling y Notion: la estructura firme de una herramienta de operaciones, atemperada por una calidez que previene la frialdad corporativa. Geist aporta la voz tipográfica — técnica pero no fría, moderna pero sin modismos. El Slate Naval oscuro ancla cada pantalla; el Azul Acción aparece únicamente donde el usuario necesita tomar una decisión. El sistema es multi-dispositivo de primera clase: desktop ve más información en paralelo, tablet navega cómodamente en modo landscape, mobile prioriza flujo vertical con acciones primarias siempre al alcance del pulgar.

Lo que FamSPI rechaza explícitamente: la sensación de plantilla Bootstrap de 2018 (bordes uniformes sin carácter, tipografía plana, grids de tarjetas intercambiables), los diseños que cambian de estilo entre módulo y módulo como si los hubiera construido equipos distintos, y los flujos que interrumpen con un modal cuando podrían continuar en línea.

**Key Characteristics:**
- Un lenguaje visual único, sin variaciones entre módulos
- Densidad adaptativa: más información en paralelo en desktop; flujo vertical con touch targets de 44px mínimo en mobile
- Profundidad estratificada: las sombras revelan jerarquía, no decoran superficies
- Action Blue reservado para decisiones — cuando aparece, el usuario sabe que ahí hay algo que hacer
- Modo claro y oscuro como primera clase, sin compromisos entre ambos

## 2. Colors: La Paleta Naval

Una paleta contenida: un único acento de acción sobre una base de Slate Naval y grises neutros. La escasez del azul es lo que le da peso. Los colores de estado (verde, rojo, ámbar) son semánticos — comunican condición, no decoración.

### Primary
- **Deep Naval Slate** (`#1E293B`): El color estructural del sistema. Fondos de navegación, encabezados de sección, elementos de anclaje visual. Nunca como fondo de card ni como acento decorativo.
- **Storm Slate** (`#334155`): Hover sobre ítems de navegación, bordes de card en foco, texto sobre fondos oscuros.
- **Midnight Slate** (`#0F172A`): Fondo de página en modo oscuro. Máxima profundidad.

### Secondary
- **Action Blue** (`#2563EB`): El único color de acción del sistema. Botones primarios, enlaces activos, indicadores de progreso, estados activos en navegación. Aparece en ≤10% de cualquier pantalla.
- **Sky Signal** (`#0EA5E9`): Variante más clara del acento. Focus rings, notificaciones, estados activos de menor jerarquía que el botón primario.

### Neutral
- **Surface White** (`#FFFFFF`): Fondo de cards, paneles y formularios en modo claro.
- **Paper White** (`#F9FAFB`): Fondo de página en modo claro. Diferencia sutil respecto al blanco puro para crear separación visual entre superficie y fondo.
- **Dark Surface** (`#111827`): Fondo de página en modo oscuro.
- **Dark Card** (`#1F2937`): Fondo de cards y paneles en modo oscuro.
- **Ink Slate** (`#1F2937`): Texto principal, títulos en modo claro.
- **Warm Ash** (`#6B7280`): Texto secundario, placeholders, etiquetas de campo, timestamps.
- **Fog** (`#D1D5DB`): Bordes de inputs, separadores, líneas de tabla.
- **Soft Border** (`#E5E7EB`): Bordes de cards en reposo.

### Status
- **Operative Green** (`#16A34A`) / suave `#DCFCE7`: Éxito, estados activos, asistencia marcada, aprobaciones.
- **Alert Red** (`#DC2626`) / suave `#FEE2E2`: Error, acciones destructivas, estados vencidos, rechazos.
- **Caution Amber** (`#D97706`) / suave `#FEF3C7`: Advertencias, estados pendientes, aprobaciones parciales.

### Named Rules
**The Sparrow Rule.** Action Blue toca ≤10% de cualquier pantalla. Encabezados azules, fondos azules, bordes decorativos azules: todos prohibidos. Si hay duda de si un elemento debe ser azul, la respuesta es no.

**The Naval Structure Rule.** Deep Naval Slate es estructura, no decoración. Navegación, headers y elementos de anclaje. Nunca como fondo de card ni como texto de acento en contenido corrido.

## 3. Typography: Geist

**Display + Body Font:** Geist (fallback: `system-ui, -apple-system, sans-serif`)
**Mono:** Geist Mono — para valores numéricos exactos, IDs de solicitud, montos, fechas en tablas.

*Nota de implementación: Geist se agrega via `npm install geist` o importando desde `https://fonts.googleapis.com/css2?family=Geist`. El proyecto actualmente usa system-ui por defecto; la migración a Geist es transparente al usuario.*

**Character:** Geist tiene la precisión de una fuente técnica sin la frialdad monoespaciada. En texto corrido lee fluido; en encabezados tiene presencia. El tracking negativo en display y headline refuerza la sensación de herramienta de alto rendimiento — apretada, segura, sin adornos.

### Hierarchy
- **Display** (700, clamp 24–32px, line-height 1.2, tracking -0.02em): Títulos de página, pantallas de módulo. Máximo uno por pantalla. Nunca en tarjetas.
- **Headline** (600, 20px, line-height 1.3, tracking -0.01em): Nombres de sección, títulos de modal, encabezados de card con peso propio.
- **Title** (600, 18px, line-height 1.4): Títulos de cards secundarias, encabezados de tabla, nombres de módulo en navegación.
- **Body** (400, 14px, line-height 1.6): Todo el texto de contenido. Máximo 70ch en columnas de lectura larga.
- **Label** (500, 12px, line-height 1.4, tracking 0.01em): Etiquetas de campo, metadatos, timestamps. En mayúsculas solo para badges de estado cuando el badge ya da el color semántico.

### Named Rules
**The Geist Mono Rule.** Valores numéricos de referencia — IDs, montos en viáticos, fechas en tablas de asistencia — van en Geist Mono. La diferencia es sutil pero señala que ese dato es exacto y copiable.

## 4. Elevation: Estratificada

FamSPI usa sombras estratificadas donde cada nivel de profundidad corresponde a un nivel semántico de jerarquía. Las superficies no flotan por defecto — la sombra aparece como respuesta a estado (hover, focus) o como señal de una capa genuinamente superior. En modo oscuro, la elevación se expresa con tonal layering: superficies más claras en capas superiores, complementado con sombras más contenidas.

### Shadow Vocabulary
- **Ambient** (`0 2px 10px rgba(0,0,0,0.06)`): Cards en reposo. Indica que la card está sobre el fondo, sin drama.
- **Lifted** (`0 4px 16px rgba(0,0,0,0.10)`): Cards en hover, paneles activos, inputs con focus. El elemento se aproxima al usuario.
- **Structural** (`0 15px 35px rgba(15,23,42,0.08)`): Paneles flotantes, sidebars desplegables, contenedores de sección con peso propio.
- **Overlay** (`0 20px 60px rgba(15,23,42,0.18), 0 4px 16px rgba(15,23,42,0.10)`): Modales, dropdowns, tooltips. La capa más alta visible.

### Named Rules
**The Flat-Then-Lift Rule.** Las superficies son planas en reposo. La sombra aparece como respuesta a estado, no como decoración por defecto. Una card que nace con sombra dramática le quita impacto al hover y confunde la jerarquía.

## 5. Components

### Buttons
Botones con radio muy redondeado (16px) que ablandan el tono profesional sin perder estructura. El radio grande es una firma visual deliberada — diferencia FamSPI de las interfaces Bootstrap con `rounded` (4px) genérico.

- **Shape:** 16px (rounded-2xl). Touch target mínimo 44px de altura en mobile, 36px en desktop.
- **Primary:** Action Blue (`#2563EB`), texto blanco. Sombra Ambient en reposo, Lifted en hover. Hover: `#1D4ED8`. Transición 150ms ease-out.
- **Focus:** Outline 2px sky-signal/50 + offset 2px en todos los variantes.
- **Secondary:** Fondo blanco, borde Fog (`#D1D5DB`), texto Ink Slate. Hover: fondo Paper White con sombra Lifted.
- **Ghost:** Sin fondo ni borde. Texto Warm Ash. Hover: fondo `#F3F4F6`, texto Ink Slate. Para acciones terciarias y links inline.
- **Danger:** Alert Red (`#DC2626`), texto blanco. Solo para acciones destructivas con confirmación explícita previa. Nunca como botón de cancelar.

### Chips / Badges
Pastillas completamente redondeadas (9999px), fondo suave del color semántico, texto en 12px/500. El color de fondo siempre es el tono soft del color semántico; el texto es el tono pleno.

- **Neutral:** `#F3F4F6` / Ink Slate. Estados sin connotación semántica, categorías.
- **Blue:** `#DBEAFE` / `#1D4ED8`. En proceso, informativo.
- **Green:** Green-soft / Operative Green. Aprobado, activo, completado, presente.
- **Red:** Red-soft / Alert Red. Rechazado, vencido, error.
- **Amber:** Amber-soft / Caution Amber. Pendiente, parcial, por revisar.

### Cards / Containers
Cards con sombra Ambient y borde Soft Border. El `backdrop-blur` con fondo semitransparente actualmente en `Card.jsx` está en proceso de migración hacia fondos sólidos — glassmorphism es inconsistente entre módulos y penaliza el rendimiento en mobile de gama media.

- **Corner Style:** 16px — consistente con botones, refuerza la firma visual del sistema.
- **Background:** Surface White en claro, Dark Card en oscuro.
- **Shadow:** Ambient en reposo, Lifted en hover si la card es interactiva.
- **Border:** Soft Border (`#E5E7EB`) en claro; sin borde en oscuro (contraste de superficie suficiente).
- **Padding:** 20px en desktop, 16px en mobile. Nunca cards anidadas dentro de cards.

### Inputs / Fields
- **Style:** Fondo blanco, borde Fog, radio 12px. Altura mínima 40px en desktop, 44px en mobile.
- **Label:** Siempre encima del campo en 12px/500/Ink Slate. Nunca solo como placeholder.
- **Focus:** Borde cambia a Action Blue + ring 2px sky-signal/20.
- **Error:** Borde Alert Red + mensaje de error en 12px/Alert Red debajo del campo.
- **Disabled:** Fondo Paper White, texto Warm Ash, borde Fog/50. Cursor not-allowed.

### Navigation
Sidebar vertical en desktop; bottom tab bar en mobile (máximo 5 módulos, resto en "más"); sidebar colapsada a iconos con tooltip en tablet.

- **Desktop sidebar:** Fondo Deep Naval Slate (`#1E293B`). Ítems: texto blanco/70, icono 16px. Hover: fondo Storm Slate. Activo: fondo Action Blue, texto blanco completo.
- **Mobile bottom bar:** Fondo Surface White con borde superior Fog. Icono 20px + label 10px/500. Activo: icono + label en Action Blue.
- **Tablet:** Sidebar colapsada a 56px con solo iconos. Tooltip con nombre del módulo al hover.

### Signature Component: AttendanceWidget
El widget de asistencia es el componente de mayor frecuencia de uso en mobile — presente en todos los dashboards. Reglas inamovibles:
- El botón de acción principal (Marcar Entrada, Marcar Salida) siempre visible sin scroll en viewport de 390px.
- Estado actual en Headline (20px/600) con badge semántico adyacente.
- Sin cards anidadas dentro del widget.
- Touch targets de los botones de estado: mínimo 48px de altura.

## 6. Do's and Don'ts

### Do:
- **Do** usar Deep Naval Slate (`#1E293B`) para navegación, headers y elementos estructurales — es el color que da coherencia entre módulos.
- **Do** reservar Action Blue (`#2563EB`) exclusivamente para botones primarios, links de acción y estados activos en navegación. Nada más.
- **Do** mantener radio de 16px en botones y cards en todos los módulos. La consistencia del radio es la firma visual.
- **Do** asegurarte de que cada acción primaria sea alcanzable con el pulgar sin scroll en viewport de 390px.
- **Do** usar Geist Mono para IDs, montos, fechas exactas y cualquier valor que el usuario pueda necesitar copiar.
- **Do** seguir la escala de sombras definida (Ambient → Lifted → Structural → Overlay). Nunca inventar valores nuevos.
- **Do** garantizar WCAG AA (4.5:1 en texto, 3:1 en elementos UI) en modo claro y oscuro.
- **Do** mostrar el label del campo siempre encima del input, nunca solo como placeholder que desaparece al tipear.

### Don't:
- **Don't** usar `backdrop-blur` con fondo semitransparente (glassmorphism) como estilo por defecto de cards. Es inconsistente entre módulos y penaliza rendimiento en mobile de gama media.
- **Don't** replicar el estilo Bootstrap genérico: radios de 4-6px, sombras azuladas, grids de tarjetas idénticas icono + encabezado + texto.
- **Don't** hacer que módulos distintos parezcan construidos por equipos distintos. Si un componente en `comercial` tiene un estilo diferente al mismo en `talento`, uno de los dos está mal.
- **Don't** usar modal como primera respuesta a una acción. Agotar alternativas inline o progresivas antes. Modales solo para confirmaciones destructivas o flujos que requieren contexto completamente aislado.
- **Don't** poner Action Blue en más del 10% de la superficie de cualquier pantalla. Encabezados azules, fondos azules, bordes decorativos azules: prohibidos.
- **Don't** usar `border-left` mayor a 1px como acento de color en cards o items de lista. Reemplazar con fondo suave o badge semántico.
- **Don't** usar gradientes en texto (`background-clip: text` con gradiente). Color sólido siempre.
- **Don't** anidar cards dentro de cards. Si el contenido necesita una sub-superficie, usar un separador, un cambio de fondo de sección, o un indented layout.
- **Don't** usar el mismo peso visual para toda la información en un dashboard. Si todo importa igual, nada importa.
