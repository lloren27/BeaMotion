# Expo Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inicializar la aplicación privada de gestión de entrenamientos como un proyecto Expo con TypeScript y una estructura modular lista para crecer.

**Architecture:** Usar el template oficial Expo Router con navegación basada en archivos. Mantener rutas, componentes, features, dominio e integraciones separados; dejar los servicios externos como contratos/placeholders hasta auditar Lovable.

**Tech Stack:** Expo, React Native, TypeScript, Expo Router y dependencias del template oficial.

**Spec:** `/Users/lloren27/Downloads/PLAN_APP_GESTION_ENTRENAMIENTOS_FUSIONADO.md`, §§3, 4, 16, 17.

## Global Constraints

- React Native + Expo + TypeScript para iOS y Android, con prioridad de usabilidad en tablet.
- La app es privada para Beatriz; no crear acceso de clientes ni de otros profesionales en el MVP.
- No asumir backend, esquema ni credenciales de Lovable y no modificar su base de datos.
- No añadir claves o secretos al cliente móvil.
- No fijar versiones manualmente antes de inicializar; conservar las versiones compatibles elegidas por Expo.

## Review Focus

- Arranque con Expo Router en iOS/Android — verificar que la configuración generada use el entry point y plugin de Router.
- TypeScript y scripts disponibles — verificar los scripts del package manifest y el chequeo estático configurado.
- Rutas privadas sin backend configurado — mantener una pantalla inicial local claramente provisional, sin simular autenticación real.
- Integración externa sin configuración — verificar que `.env.example` no contenga credenciales ni valores que parezcan secretos reales.
- Estructura de dominio vacía — dejar README/índices simples donde haga falta; no añadir lógica de negocio ni migraciones aún.

---

### Task 1: Inicializar Expo y la estructura modular

**Files:**
- Create: configuración Expo, `package.json`, lockfile, `tsconfig.json` y rutas iniciales mediante template oficial Expo Router + TypeScript.
- Create: `src/components/`, `src/features/` (subcarpetas del plan), `src/domain/` (entities/rules/validators/serializers), `src/services/` (supabase/clients-integration), `src/stores/`, `src/hooks/` y `src/types/`.
- Create: `supabase/migrations/`, `supabase/functions/`, `supabase/tests/`, `docs/architecture/`, `docs/decisions/`, `docs/api/`, `tests/`.
- Create: `.env.example`, `.gitignore` si el template no lo genera, y `README.md` con arranque local y límites actuales.
- Modify: rutas generadas para mostrar una pantalla provisional privada y navegación de base, sin implementar login ni datos reales.

**Interfaces:**
- Consumes: especificación consolidada en la ruta indicada arriba.
- Produces: app Expo Router ejecutable con estructura lista para implementar funcionalidades por módulos.

- [x] Inicializar en la raíz con el template oficial Expo Router + TypeScript, conservando las versiones compatibles generadas.
- [x] Crear las carpetas descritas y un `.env.example` sin secretos; no añadir migraciones SQL, conexión Supabase ni cliente Lovable real.
- [x] Ajustar pantalla inicial y README para dejar claro que autenticación e integración están pendientes de implementación.
- [x] Revisar manifest, rutas, variables de entorno y cambios generados para confirmar que no se añadió configuración de producción ni secretos.

