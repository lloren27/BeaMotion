# Inicio de entrenamientos de hoy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Abrir en los clientes con reserva hoy y navegar a sus entrenamientos de esa fecha.
**Architecture:** Consulta paginada de reservas Lovable independiente de bonos y planes. Reutilizar ficha y editor con fecha opcional.
**Tech Stack:** Expo Router, React Native, TypeScript, Supabase, node:test.
**Spec:** docs/superpowers/specs/2026-11-18-inicio-entrenamientos-hoy-design.md

## Global Constraints
Sin dependencias nuevas, commits, pushes, despliegues ni cambios de esquema. Europe/Madrid para el día actual. Conservar Clientes y navegación habitual.

## Review Focus
- Medianoche y cambios de horario: filtrar por fecha Madrid, no UTC.
- Cancelaciones: excluir reserva o sesión cancelada.
- Varias reservas: un cliente con todas sus horas, ordenadas.
- Sin plan: incluir cliente y mostrar estado explicativo al entrar.
- Navegación: fecha válida, foco, cambio de día, errores sin resultados engañosos.

### Task 1: Datos del día
- [x] Añadir tests en tests/today-training.test.ts para agrupación, orden, cancelaciones, Madrid y fechas inválidas; comprobar fallo.
- [x] Crear src/domain/rules/today-training.ts con agrupación de reservas por cliente y validación de fecha de navegación; añadir servicio src/services/clients-integration/today-training-data.ts con lectura paginada y errores explícitos.
- [x] Compilar tests con TypeScript a CommonJS temporal y ejecutarlos con node --test (comando abajo).

### Task 2: Inicio y destino
- [x] Mover listado a src/app/(private)/clients/index.tsx y actualizar SectionMenu.
- [x] Crear inicio con reservas del día, estados de carga/error/vacío y actualización al recuperar foco/cambiar día.
- [x] Recibir fecha en client/[id].tsx y mostrar ClientTrainingSection primero con filtro de fecha y opción de mes completo.
- [x] Ejecutar suite TypeScript, tsc --noEmit y exportación web. Revisar diff y el código de navegación sin modificar datos externos; validación interactiva autenticada pendiente.

## Validación y cierre

- Tests iniciales: fallo por módulo nuevo todavía inexistente; después pasan las cuatro pruebas nuevas.
- Suite completa de reglas: 19/19 correctas.
- `./node_modules/.bin/tsc --noEmit`: correcto.
- `./node_modules/.bin/expo export --platform web --output-dir /tmp/beamotion-today-web`: correcto; advertencia del entorno sobre sharp-cli 5.1.0 frente a ^5.2.0.
- `git diff --check`: correcto.
- Revisión propia de filtrado, navegación y manejo de solicitudes obsoletas, manteniendo un único agente según instrucciones del usuario.
- No se han ejecutado pruebas interactivas con sesión autenticada ni pruebas de base de datos: no se modifica el esquema ni las operaciones de escritura existentes.
- Sin commits, push, merge o despliegue.

Comando reproducible de tests (sin cambiar la configuración de la app):

```sh
./node_modules/.bin/tsc --ignoreConfig tests/*.test.ts --module commonjs --target es2022 --types node --outDir /tmp/beamotion-today-tests --rewriteRelativeImportExtensions --skipLibCheck && node --test /tmp/beamotion-today-tests/tests/*.test.js
```

Se compilan los tests para resolver los imports sin extensión usados en la app. La ejecución directa mediante strip-types no resuelve esos imports; la comprobación de tipos de la app se ejecuta por separado con su tsconfig habitual.
