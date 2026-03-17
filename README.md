# SPI - Sistema de Procesos Internos

Repositorio principal del sistema SPI.

## Estructura
- backend/: API Node.js + Express, modulos, middlewares, jobs e integraciones.
- spi_front/: frontend React, rutas, contextos y modulos por area.
- docs/validation/: documentacion de validacion por areas.
- validacion_sistema/: documentacion historica de analisis y validacion.
- Mapeador_Sheets/: plantillas y activos del mapeo de Google Sheets para Business Case.
- scripts/: utilitarios operativos y de soporte.

## Puntos de entrada
- Backend: backend/src/app.js y backend/src/server.js
- Frontend: spi_front/src/App.js y spi_front/src/routes/AppRoutes.jsx

## Stack
- Backend: Node.js, Express, PostgreSQL, JWT, Google APIs
- Frontend: React, React Router, Axios, Firebase
- Infraestructura objetivo: Cloud Run + Neon + Google Workspace

## Areas funcionales principales
- Gobierno, seguridad y cumplimiento
- Comercial y business case
- Talento humano, permisos, vacaciones y asistencia
- Servicio tecnico y mantenimientos
- Compras, operaciones y logistica
- Finanzas, viaticos y aprobaciones

## Operacion
La configuracion sensible debe resolverse por variables de entorno o secretos del entorno de ejecucion. No se deben versionar claves, passwords, tokens temporales ni credenciales de service account.

## Documentacion relacionada
- Desarrollo local: README-SPI-DEV.md
- Validacion por areas: docs/validation/areas/
- Protocolos IQ/OQ/PQ: docs/validation/areas/*
