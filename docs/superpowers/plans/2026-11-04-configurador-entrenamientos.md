# Configurador de entrenamientos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear y conservar planes mensuales de 4, 8 o 12 sesiones por clienta, con secuencia automática, estado visual y edición de ejercicios y resultados.

**Architecture:** Lovable continúa siendo la fuente de lectura de clientas. Una segunda instancia Supabase, propia de BeaMotion, almacena bonos, sesiones, ejercicios y resultados, con autenticación y RLS independientes. La ficha combina los datos existentes con el servicio de entrenamiento; no se escribe en Lovable.

**Tech Stack:** Expo Router, React Native, TypeScript, `@supabase/supabase-js`, PostgreSQL/Supabase.

**Spec:** Decisión aprobada en conversación el 2026-11-04 y reglas base de `docs/superpowers/plans/PLAN_APP_GESTION_ENTRENAMIENTOS_FUSIONADO.md` (§§4–6, 10.19.A–B, 10.18).

## Global Constraints

- No escribir en el proyecto Supabase de Lovable.
- Los IDs estables de clienta se usan como referencias externas; no se duplican datos personales en la base propia.
- Un plan mensual contiene exactamente 4, 8 o 12 sesiones, con secuencias `C-C-C-C`, `A-B` repetida cuatro veces, o `A-B-C` repetida cuatro veces.
- Cada sesión usa estado `pending`, `completed` o `not_completed`; motivo cancelación/cambio se conserva en las sesiones no realizadas.
- Los datos planificados y los realizados se guardan por separado.
- No añadir dependencias ni hacer commits.

## Review Focus

- Una clienta no tiene plan del mes actual: mostrar creación del plan sin generar uno automáticamente.
- Un plan del mismo mes ya existe: impedir duplicados y cargar el existente.
- Un error de conexión a la base propia: conservar la ficha visible y mostrar error/reintento de entrenamientos.
- Marcar una sesión no realizada: guardar motivo cancelación/cambio y mostrar rojo; pendientes en gris y realizadas en verde.
- Un valor realizado queda vacío: no inferir que equivale a cero ni sobrescribir la prescripción.

## Files

- Create `src/services/training-supabase/client.ts`: cliente Supabase propio.
- Create `src/services/training-plans/training-data.ts`: contratos y operaciones de lectura/escritura de planes y sesiones.
- Create `src/domain/rules/training-plan.ts`: secuencias deterministas y validación de tamaño/mes.
- Create `supabase/migrations/202611040001_training_plans.sql`: tablas, constraints, índices, RLS y permisos para el proyecto propio.
- Modify `src/app/(private)/client/[id].tsx`: carga y sección visual del plan mensual, selección de tamaño, estados y edición básica de ejercicios/series/notas.
- Modify `src/app/sign-in.tsx` and `src/services/supabase/session.tsx` only as needed to expose a separate BeaMotion account sign-in; keep Lovable login for client data.
- Modify `.env.example` and integration docs with separate project variables/setup.

## Tasks

### Task 1: Plan rules and dedicated database connection

- [x] Implemented the fixed sequences and lazy BeaMotion Supabase client.

Implement the 4/8/12 session sequences exactly, create the independent Supabase client using `EXPO_PUBLIC_TRAINING_SUPABASE_URL` and `EXPO_PUBLIC_TRAINING_SUPABASE_PUBLISHABLE_KEY`, and document that these credentials belong to BeaMotion's project. Do not expose or add service-role credentials.

### Task 2: Persistent monthly-plan schema and service

- [x] Added the migration, typed database contract, and authenticated data operations.

Add tables for monthly plans, sessions, exercises, set prescriptions, and per-set actuals. Store the external Lovable client UUID, period month, plan size, session number/model, status/reason, exercise note, prescribed sets/reps/rest/load, actual values and an additional actual-difference note. Enforce unique client/month and plan/session number. Enable RLS restricted to authenticated BeaMotion admins. Implement service operations to load the month and create the plan with sessions atomically through an RPC; update session status and exercise/set data through authenticated requests.

### Task 3: Client detail training section

- [x] Added month navigation, plan creation, colored statuses, exercises, prescriptions, actual values, and notes to the client profile.

Load the current month plan independently from `getClientOverview`. Show plan creation options for 4/8/12, the generated session sequence, and per-session status controls. Apply green to completed, red to not completed (require cancellation/change reason), and gray to pending. Allow exercises to be added/edited with an exercise note; allow set rows with prescribed series, repetitions, rest and load plus actual values and free text for differences. Keep all content available when a past month is chosen, and allow navigating between months.

### Task 4: Verification and setup handoff

- [x] TypeScript validation and diff whitespace checks pass; documented project setup.

Run TypeScript validation (`npx tsc --noEmit`) and inspect the final diff. Document steps to create/configure BeaMotion's Supabase project, apply the migration, create the admin login, and populate the separate environment variables. Report that live persistence cannot be exercised until project credentials and schema are set up.

