# 💎 Prompts de Ingeniería Senior: Implementación Frontend 100% (Área 02)

Este documento contiene los "Mega-Prompts" de ingeniería diseñados para ejecutar las 25 recomendaciones senior en el Módulo de Talento Humano. Cada prompt es específico, extenso y cita los archivos reales para garantizar una implementación sin errores por parte de una IA experta.

---

## 🏗️ MEGA-PROMPT 1: Infraestructura de Datos y Rendimiento (BI & Performance)

> **Contexto:** Eres un **Senior React Performance Engineer**. Debes optimizar el flujo de datos y el renderizado del `CollaboratorCommandCenter`.
> 
> **Tarea:** Implementar una arquitectura de datos de alto rendimiento.
> 1.  **React Query Integration**: Sustituye el fetching manual en `useCommandCenterState.js` por `useQuery` de `@tanstack/react-query`. Implementa `staleTime: 1000 * 60 * 5` para evitar re-peticiones innecesarias.
> 2.  **List Virtualization**: En `EntityBrowserSection.jsx`, integra `react-window` para renderizar las listas de colaboradores y solicitudes. Asegura un `itemSize` dinámico para mantener la responsividad.
> 3.  **Lazy Loading de Secciones**: Refactoriza `CollaboratorCommandCenter.jsx` para usar `React.lazy` en la carga de `PersonnelProfile`, `PersonnelChecklist` y `PersonnelDocuments`. Envuelve el contenido en un `Suspense` con un `CommandCenterSkeleton`.
> 4.  **Context Optimization**: Divide `BusinessCaseWorkspaceContext.jsx` para que los cambios en el estado de "Documentos" no provoquen el re-renderizado de la sección de "Cálculos".
> 
> **Archivos a Modificar:**
> - `spi_front/src/modules/talento/hooks/useCommandCenterState.js`
> - `spi_front/src/modules/talento/pages/CollaboratorCommandCenter.jsx`
> - `spi_front/src/modules/talento/components/command-center/sections/EntityBrowserSection.jsx`
> 
> **Salida:** Código optimizado con 60fps en scroll y carga diferida inteligente.

---

## 🎨 MEGA-PROMPT 2: Design System y UX de Alta Fidelidad (UI/UX Mastery)

> **Contexto:** Eres un **Senior Frontend Developer experto en Tailwind CSS y Animaciones**. Debes elevar la estética del módulo.
> 
> **Tarea:** Implementar un sistema visual coherente y micro-interacciones.
> 1.  **Tailwind Design Tokens**: Crea un objeto `theme.extend` en `tailwind.config.js` con la paleta de colores de Talento Humano (`brand-hr-primary`, `hr-success`, `hr-warning`). Sustituye todos los colores hardcodeados en los componentes del módulo.
> 2.  **Framer Motion Enhancements**: En `PersonnelChecklist.jsx` y `PersonnelDocuments.jsx`, añade animaciones de entrada `initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}`. Usa `AnimatePresence` para las transiciones entre pestañas en el Workspace.
> 3.  **Adaptive Navigation**: Refactoriza `WorkspaceTabsSection.jsx`. Si el viewport es `< 640px`, renderiza un componente `Select` estilizado en lugar de la lista de Tabs horizontales.
> 4.  **Advanced Skeletons**: Mejora `CommandCenterSkeleton.jsx` para que coincida exactamente con las dimensiones de `CommandCenterSummaryStrip`. Usa el efecto `animate-pulse` con colores de la nueva paleta.
> 
> **Archivos a Modificar:**
> - `tailwind.config.js`
> - `spi_front/src/modules/talento/components/workspace/PersonnelChecklist.jsx`
> - `spi_front/src/modules/talento/components/command-center/sections/WorkspaceTabsSection.jsx`
> - `spi_front/src/modules/talento/components/command-center/CommandCenterSkeleton.jsx`
> 
> **Salida:** Interfaz "Pixel Perfect" con transiciones suaves y navegación adaptativa.

---

## 📝 MEGA-PROMPT 3: Gestión de Datos y Validación Proactiva (Data Integrity)

> **Contexto:** Eres un **Senior Software Engineer experto en Formularios Complejos**. Debes asegurar que los datos del colaborador sean perfectos.
> 
> **Tarea:** Refactorizar el sistema de edición y validación de perfiles.
> 1.  **Zod Schema Hardening**: Actualiza `commandCenterProfileSchema.js` para incluir validaciones de formato de RUC/Cédula y obligatoriedad según la etapa del flujo.
> 2.  **Auto-save Engine**: Implementa un hook `useLocalDraft` que guarde cambios parciales en `localStorage` cada 30 segundos, con un indicador visual "Borrador guardado localmente".
> 3.  **Input Masking**: Integra `react-number-format` o una utilidad similar en `PersonnelProfile.jsx` para forzar el formato de teléfonos y documentos de identidad.
> 4.  **Smart Saving Feedback**: El botón de guardado en `PersonnelProfile.jsx` debe usar `toast.promise` para mostrar estados: "Sincronizando expediente...", "Perfil actualizado en Drive y DB", "Error: [Motivo]".
> 
> **Archivos a Modificar:**
> - `spi_front/src/modules/talento/schemas/commandCenterProfileSchema.js`
> - `spi_front/src/modules/talento/components/workspace/PersonnelProfile.jsx`
> - `spi_front/src/modules/talento/components/collaboratorProfileDefinitions.js`
> 
> **Salida:** Sistema de formularios "Bullet-proof" que previene errores humanos y pérdida de datos.

---

## 📁 MEGA-PROMPT 4: Gestión Documental y Multimedia (Document Excellence)

> **Contexto:** Eres un **Senior Frontend Developer experto en File Systems y Multimedia**. Debes mejorar la gestión de archivos.
> 
> **Tarea:** Implementar un gestor de documentos avanzado.
> 1.  **Drag & Drop UI**: Integra `react-dropzone` en cada tarjeta de `PersonnelDocuments.jsx`. Muestra un overlay "Soltar para subir" cuando el usuario arrastre un archivo.
> 2.  **Document Lightbox**: Crea un componente `DocumentPreviewModal.jsx` que use `react-pdf-viewer` para previsualizar PDFs y una vista de imagen para JPG/PNG sin salir de la app.
> 3.  **Upload Progress**: En `handleUploadDocument` (dentro de `useCommandCenterState.js`), utiliza el callback `onUploadProgress` de Axios para actualizar un estado de porcentaje que se visualice en la tarjeta del documento.
> 4.  **Client-side Compression**: Antes de subir fotos de carnet, usa la API de `Canvas` o una librería ligera para redimensionar y comprimir la imagen, asegurando archivos < 500KB.
> 
> **Archivos a Modificar:**
> - `spi_front/src/modules/talento/components/workspace/PersonnelDocuments.jsx`
> - `spi_front/src/modules/talento/hooks/useCommandCenterState.js`
> 
> **Salida:** Módulo documental fluido con feedback en tiempo real y previsualización integrada.

---

## 🛠️ MEGA-PROMPT 5: Accesibilidad, Robustez y Estándares (Enterprise Standards)

> **Contexto:** Eres un **Senior Frontend Lead**. Debes asegurar que el código cumpla con estándares corporativos y sea inclusivo.
> 
> **Tarea:** Implementar robustez, accesibilidad y estándares de código.
> 1.  **Error Boundaries**: Envuelve `PersonnelProfile` y `PersonnelDocuments` en componentes `ErrorBoundary` que muestren un mensaje amigable y un botón de "Reintentar carga" en caso de crash.
> 2.  **ARIA & Accessibility**: Asegura que todos los iconos de `react-icons` tengan un `title` descriptivo y que los botones de acción tengan `aria-label`. Verifica el orden del `tabIndex` en el formulario de perfil.
> 3.  **Standardized Prop Naming**: Realiza un refactor de las props en los componentes de `/talento/components/workspace/` para que sigan el patrón `on[ActionName]` (ej: `onDocumentUpload`, `onProfileSave`).
> 4.  **Dark Mode Base**: Añade clases `dark:bg-slate-900` y `dark:text-slate-100` en los contenedores principales de `CollaboratorCommandCenter` para habilitar el soporte inicial de modo oscuro.
> 
> **Archivos a Modificar:**
> - Todos los archivos dentro de `spi_front/src/modules/talento/components/workspace/`
> - `spi_front/src/modules/talento/pages/CollaboratorCommandCenter.jsx`
> 
> **Salida:** Código accesible, resiliente a errores y listo para escalar a nivel internacional.

---

**Nota para la IA:** No asumas rutas de archivos que no se encuentren en el listado. Prioriza la mantenibilidad y el uso de Hooks personalizados para separar la lógica de la vista.
