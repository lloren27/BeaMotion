# Configuración de entrenamientos: plan de entregas por sprints

> Para la ejecución futura: usar `superpowers:executing-plans` y trabajar un sprint cada vez. Las casillas registran trabajo pendiente, no funcionalidades ya verificadas. No hacer commits, pushes ni despliegues sin autorización.

**Objetivo:** crear ejercicios reutilizables, preparar A/B/C cada mes, asignarlos según el bono y personalizar y registrar cada sesión sin alterar otros clientes ni el historial.

**Estado:** propuesta de entregas del 9 de noviembre de 2026. Esta tarea solo prepara el plan; no implementa funciones ni modifica bases de datos. Antes de ejecutar cada sprint se concreta su pequeño plan técnico y se revisa el código vigente.

**Fuente funcional:** `/Users/lloren27/Downloads/Especificacion_app_entrenamiento.pdf`, documento de 6 de noviembre de 2026, apartados 1–17. Sus recomendaciones y asuntos abiertos se distinguen de los requisitos. No constituye una autorización de despliegue o de cambios en servicios externos.

**Decisión confirmada por el usuario:** un único modelo A, B y C por mes, compartido entre bonos. El A de un bono de 8 y de uno de 12 tiene el mismo contenido base; después se personaliza por cliente. Esta decisión sustituye las seis variantes por bono del documento `PLAN_APP_GESTION_ENTRENAMIENTOS_FUSIONADO.md` para esta fase.

**Arquitectura:** conservar Expo, React Native, TypeScript y los clientes Supabase actuales. Lovable sigue siendo fuente de lectura de clientes, bonos y asistencias; los entrenamientos se almacenan en el Supabase propio. Separar biblioteca, versiones mensuales, copias de sesiones y resultados mediante referencias de origen y copias independientes del contenido.

## 1. Punto de partida comprobado en el código

- `src/domain/rules/training-plan.ts`: secuencias 4/8/12 y fechas de Madrid.
- `src/features/training-plans/ClientTrainingSection.tsx`: consulta mensual, generación al reconocer un único bono activo validado del mes actual, consulta de asistencias y edición básica de ejercicios y resultados.
- `src/services/training-plans/training-data.ts`: lectura y escritura de planes, sesiones, ejercicios y series.
- `supabase/migrations/202611040001_training_plans.sql`: esquema inicial, RPC de creación de planes y RLS de administradores.
- Hay columnas distintas para valores programados y realizados, pero todavía faltan biblioteca, modelos mensuales con contenido, agrupaciones, duración y propagación controlada.
- El texto realizado actual está asociado a series; el PDF pide además una descripción realizada por ejercicio, debajo de su nombre.
- La asistencia puede marcar una sesión realizada aunque no se hayan rellenado resultados. Esa diferencia debe conservarse.
- Hay cambios locales previos que se respetarán. El README y el plan del 4 de noviembre no describen completamente el código actual. No se ha comprobado aquí qué migraciones están aplicadas en remoto ni el funcionamiento real de la persistencia.

## 2. Reglas compartidas de todas las entregas

| Bono | Secuencia exacta |
|---|---|
| 4 | C-C-C-C |
| 8 | A-B-A-B-A-B-A-B |
| 12 | A-B-C-A-B-C-A-B-C-A-B-C |

| Modelo | Estructura del PDF |
|---|---|
| A | Core + empuje/press superior + tracción inferior |
| B | Core + tracción superior + tracción inferior |
| C | Core + empuje superior + empuje inferior + tracción superior + tracción inferior |

- Se mantiene literalmente la tracción inferior de A y B; no se cambia por una interpretación deportiva.
- La entrenadora elige ejercicios. La automatización asigna modelos y secuencias, no inventa rutinas.
- Editar biblioteca o modelos nunca modifica por referencia una sesión ya creada. Cada sesión conserva el contenido y la versión de origen.
- Los resultados comienzan vacíos: vacío no es cero ni equivale al valor programado.
- Las modificaciones individuales y los resultados no se transfieren a otras personas ni al modelo base.
- La protección histórica empieza con la primera entrega; no se deja para un sprint final.
- Mantener la introducción directa de ejercicios por nombre existente. Guardarlos en biblioteca es opcional; el formulario ofrece descripción y clasificación sin obligar a catalogar todo antes de entrenar.
- Nuevas migraciones incrementales; no reescribir la migración inicial como si nunca se hubiera aplicado. Mantener los datos existentes y sus resultados.
- No introducir dependencias, sincronización offline completa, cambios de reservas/cancelaciones ni nuevos roles profesionales sin una necesidad y alcance concretos.

## 3. Enfoque y orden propuestos

Se propone trabajar por funciones completas, incluyendo interfaz, persistencia, permisos y pruebas en cada sprint. Una división por capas (primero toda la base, después todos los servicios y por último las pantallas) retrasaría la primera función utilizable. Construir todo el editor avanzado de una vez haría más difícil revisar y cerrar entregas pequeñas.

Cada sprint termina con una demostración usando datos de prueba y un registro de criterios cumplidos. Si no cabe todo su alcance, se divide antes de empezar; no se declara terminado con guardados simulados o controles sin funcionamiento. No se fijan fechas hasta validar la primera entrega y la disponibilidad para revisarla.

| Sprint | Función que queda utilizable | Dependencia |
|---|---|---|
| 1 | Crear, buscar y reutilizar ejercicios en una sesión actual | Base existente |
| 2 | Preparar y conservar los modelos A/B/C de cada mes | 1 |
| 3 | Asignar su contenido y personalizar sesiones por cliente | 2 |
| 4 | Organizar biseries, triseries, circuitos e HIIT | 3 |
| 5 | Registrar lo ejecutado y consultar el historial completo | 4 |
| 6 | Distribuir cambios de modelos con vista previa y protección | 5 |

### Sprint 1. Biblioteca de ejercicios utilizable desde las sesiones

**Entrega:** crear un ejercicio y añadirlo a una sesión desde un selector, conservando la entrada manual actual.

- [ ] Crear listado, búsqueda por nombre, filtros y ficha con nombre, instrucciones y etiquetas múltiples. Permitir editar y duplicar; proponer archivar en lugar de borrar ejercicios ya utilizados.
- [ ] Guardar clasificación y material de forma estructurada: familia/patrón, lateralidad, posición, acción, color de goma, peso en kg, tiempos de acción y notas. No inferir resistencia a partir del color.
- [ ] Incorporar el selector a la sesión. Copiar nombre, instrucciones y valores de referencia al seleccionar un ejercicio; conservar el identificador de origen sin depender de sus valores futuros.

**Taxonomía del PDF:** familias core, empuje superior, tracción superior, empuje inferior, tracción inferior, combinada, movilidad e HIIT; lateralidad unilateral, bilateral, combinado y otros; posición horizontal, vertical, sentado, tumbado, caballero, cuadrupedia y combinado; acciones rotación/antirrotación, inclinación, flexión/extensión, giro, abducción/aducción, rebote y combinado. Un ejercicio puede tener varias etiquetas en cada dimensión; combinado no significa agrupación.

**Cierre y demostración:** crear un ejercicio con dos patrones y material, localizarlo por nombre y etiquetas, añadirlo a dos sesiones y cambiar la ficha original. Ambas sesiones conservan su contenido. Duplicar la ficha y editar la copia tampoco altera el original. Recargar conserva todos los cambios. Un usuario no autorizado no accede al catálogo.

**Archivos previstos:** nuevas rutas `src/app/(private)/exercises/index.tsx` y `[id].tsx`, módulo `src/features/exercises/`, servicio `src/services/exercises/exercise-data.ts`; adaptar el acceso desde `src/app/(private)/index.tsx`, `ClientTrainingSection.tsx` y los tipos de base. Nueva migración de biblioteca.

### Sprint 2. Preparación mensual de A, B y C

**Ampliación acordada:** semanas de lunes a domingo recortadas al mes; A/B/C de la primera semana como base. Las semanas posteriores heredan automáticamente hasta personalizarlas. Una semana personalizada conserva sus cambios y puede volver a la base con confirmación expresa; las versiones publicadas no cambian. Al copiar el mes anterior se copia su primera semana como base del nuevo mes.


**Entrega:** abrir un mes, preparar sus tres modelos y dejar una versión lista para asignar.

- [ ] Crear editor mensual con dos opciones: copiar el mes anterior o empezar vacío manteniendo la estructura A/B/C. No inventar los ejercicios iniciales: el PDF define patrones, no una lista concreta.
- [ ] Añadir, quitar y ordenar ejercicios; configurar series, repeticiones, duración, descanso, carga/material y progresión/regresión. Duplicar modelos como copias independientes.
- [ ] Separar borrador de versión publicada. Propuesta: comprobar los patrones requeridos antes de publicar, permitiendo borradores incompletos y ejercicios adicionales de movilidad/HIIT. Los ejercicios libres pueden asociarse a un patrón del modelo sin catalogarlos obligatoriamente.
- [ ] Conservar versiones publicadas y meses anteriores. Crear una nueva versión no actualiza sesiones distribuidas; hasta el sprint 6 solo cambia el contenido que usarán nuevas asignaciones.

**Cierre y demostración:** preparar A/B/C de un mes, reabrirlos y copiar al siguiente. Cambiar un ejercicio o peso en la copia no altera el mes original. Empezar desde cero conserva los patrones y no arrastra ejercicios. El mismo A queda disponible para bonos de 8 y 12.

**Archivos previstos:** rutas `src/app/(private)/training-models/`, módulo `src/features/training-models/`, servicio `src/services/training-models/model-data.ts`, reglas `src/domain/rules/training-model.ts`, tipos y migración de modelos/versiones. Añadir navegación desde la pantalla privada.

### Sprint 3. Asignación con contenido y personalización por cliente

**Entrega:** reconocer un bono y disponer de sesiones con los ejercicios de sus modelos, adaptables individualmente.

- [ ] Ampliar la creación actual para copiar transaccionalmente la versión mensual correspondiente a cada letra. Registrar origen, versión y personalización. Reintentar o abrir desde dos dispositivos no crea planes o sesiones duplicados.
- [ ] Integrar la edición individual de carga, material, series, repeticiones, duración, descansos, progresión/regresión, sustitución de ejercicios y orden. Los campos realizados siguen vacíos.
- [ ] Conservar los planes existentes sin regenerarlos. Proponer una acción explícita con vista previa para completar contenido de sesiones pendientes vacías; las sesiones con trabajo previo se mantienen intactas.
- [ ] Permitir duplicar una sesión como borrador reutilizable o copiar su programación a una sesión pendiente con confirmación. No copiar resultados ni aumentar automáticamente las sesiones del bono.
- [ ] Si falta una versión publicada, mostrar “contenido pendiente de preparar”. Propuesta: conservar la secuencia existente sin usar silenciosamente modelos de otro mes. Cuando estén disponibles, completar el contenido pendiente mediante una acción explícita.

**Cierre y demostración:** con tres clientes de prueba obtener exactamente las secuencias 4/8/12 y el contenido correcto. Modificar el A de un cliente deja intactos el A base y otro cliente. Reabrir conserva la adaptación. Probar modelo ausente, plan antiguo, reintento y dos bonos activos; ante ambigüedad no elegir uno arbitrariamente ni borrar datos.

**Archivos previstos:** `src/services/training-plans/training-data.ts`, `src/features/training-plans/ClientTrainingSection.tsx`, `src/types/training-database.ts`; nueva migración para referencias de versión, copias y RPC atómica. Mantener las reglas y la lectura de bonos/asistencias existentes.

### Sprint 4. Agrupaciones e HIIT en modelos y sesiones

**Entrega:** construir entrenamientos con ejercicios sueltos, biseries, triseries y agrupaciones de cuatro o más, sin un límite funcional rígido.

- [ ] Añadir bloques ordenables, con ejercicios de cualquier familia, tanto al editor del modelo como a la adaptación individual.
- [ ] Configurar modalidad por vueltas o por ejercicios; distinguir vueltas del bloque de series de cada ejercicio. Guardar por separado el descanso entre ejercicios y al finalizar vuelta/bloque, ambos opcionales.
- [ ] Insertar HIIT al principio, entre ejercicios/bloques o al final, con trabajo y recuperación. Permitir duplicar y reutilizar agrupaciones sin compartir datos editables con el original.
- [ ] Extender copias, asignación y personalización a toda la estructura del bloque. Migrar las listas existentes conservando su orden y sus resultados.

**Cierre y demostración:** guardar una biserie de core y empuje, una triserie y un circuito de cinco ejercicios; probar ambas modalidades y cada descanso por separado. Intercalar HIIT, copiar el bloque y modificar la copia. Reabrir reproduce orden y parámetros. Un ejercicio combinado sigue siendo una única entrada, no se convierte en biserie.

**Archivos previstos:** componentes compartidos en `src/features/training-editor/`, reglas `src/domain/rules/training-block.ts`, servicios de modelos y sesiones, tipos y migración de bloques.

### Sprint 5. Registro real, notas e historial

**Entrega:** usar una vista de sesión en móvil/tablet para registrar lo realizado durante o después del entrenamiento y consultarlo posteriormente.

- [ ] Mostrar programación y campos realizados separados: series, repeticiones, descanso, carga y duración. Añadir descripción realizada inicialmente vacía debajo del nombre de cada ejercicio y notas generales de sesión. Conservar las notas existentes por serie.
- [ ] Permitir registros parciales sin rellenar datos automáticamente. Propuesta inicial: guardado explícito frecuente, indicador de cambios pendientes y aviso antes de salir; el guardado automático queda como mejora a valorar, no como requisito cerrado.
- [ ] Mantener separado el estado de asistencia/cancelación del seguimiento del contenido. Proponer un indicador “realizada con modificaciones” sin reemplazar `not_completed` ni deducir resultados a partir de la asistencia.
- [ ] Consultar por cliente y mes las copias de programación y resultados. Una plantilla posterior nunca los reescribe. Rellenar resultados después de asistir sigue permitido; una corrección posterior no debe cambiar silenciosamente la programación histórica y debe conservar trazabilidad.

**Cierre y demostración:** registrar solo repeticiones y un texto de sustitución, dejando carga y descanso vacíos. Guardar/reabrir conserva exactamente esos valores y la programación original. Cambiar biblioteca o modelos del mes siguiente no altera el historial. Una sesión con asistencia pero sin resultados no aparece rellenada. Simular fallo de guardado conserva el formulario y permite reintentar.

**Archivos previstos:** `src/features/training-plans/ClientTrainingSection.tsx`, componentes del editor, servicio de sesiones, tipos y migración para campos faltantes y trazabilidad. Evitar mezclar la descripción por ejercicio con `actual_notes` de cada serie.

### Sprint 6. Actualización controlada de modelos

**Entrega:** cambiar un modelo y decidir de forma explícita qué programación individual recibe la nueva versión.

- [ ] Ofrecer los tres alcances del PDF: todos los clientes correspondientes; solo nuevas sesiones que todavía deban generarse; clientes seleccionados. Mostrar las sesiones pendientes existentes como un alcance explícito, sin incluirlas silenciosamente en “nuevas”.
- [ ] Generar vista previa con clientes, sesiones, diferencias, personalizaciones y exclusiones. Propuesta: excluir sesiones realizadas o con resultados, preservando su fotografía histórica; advertirlo incluso en la opción “todos”.
- [ ] Detectar conflictos con adaptaciones individuales, conservarlas por defecto y exigir selección y confirmación explícita para sustituirlas. Registrar quién aplicó qué versión y a qué sesiones.
- [ ] Aplicar el cambio de forma atómica y verificar que los datos no han cambiado desde la vista previa. Si otro dispositivo personaliza una sesión, pedir revisar la vista previa; no sobrescribirla.

**Cierre y demostración:** probar los tres alcances con sesiones nuevas, pendientes sin personalizar, personalizadas y realizadas. Solo cambian las seleccionadas y elegibles. Cancelar no escribe nada; fallar a mitad no deja una actualización parcial; repetir la operación no duplica ejercicios. Cambiar una sesión entre vista previa y aplicación detecta el conflicto.

**Archivos previstos:** vista de distribución en `src/features/training-models/`, reglas `src/domain/rules/model-update.ts`, servicio `src/services/training-models/model-distribution.ts`, tipos y migración de operaciones de vista previa/aplicación y auditoría.

## 4. Condición común para cerrar un sprint

- [ ] Función accesible desde la app y persistencia comprobada tras cerrar/reabrir.
- [ ] Pruebas de sus reglas y escenarios de aceptación, más regresión del flujo afectado.
- [ ] `npx tsc --noEmit` y `git diff --check` correctos. No sustituyen las pruebas funcionales.
- [ ] Probar migraciones incrementales sobre datos de prueba nuevos y preexistentes; verificar RLS con acceso autorizado y denegado. Nunca usar producción como banco de pruebas.
- [ ] Comprobar móvil/tablet, estados vacíos, carga, errores y reintentos de la función entregada.
- [ ] Demostración con datos ficticios y anotación de lo validado, limitaciones y decisiones pendientes.

Actualmente `package.json` no declara un runner ni scripts de tests. En el primer sprint se concretará una forma mínima de ejecutar las pruebas de dominio y de base, justificando cualquier herramienta nueva. No se prometerá que existen suites que todavía no están configuradas. Si no se dispone de una base de pruebas, se deja esa validación pendiente y no se declara la persistencia verificada.

## 5. Riesgos que deben quedar cubiertos

| Riesgo | Prueba asignada |
|---|---|
| Editar el catálogo cambia sesiones antiguas | Sprint 1: comprobar las dos copias tras editar el original |
| Reintentos o dos dispositivos duplican sesiones | Sprint 3: creación concurrente/idempotente |
| Vacío se transforma en cero o valor programado | Sprint 5: guardado y recarga de resultados parciales |
| Copiar un bloque conserva referencias editables compartidas | Sprint 4: editar una copia y comprobar su origen |
| Vista previa antigua sobrescribe una personalización reciente | Sprint 6: conflicto concurrente antes de aplicar |

## 6. Decisiones pendientes y alcance opcional

- **Confirmado:** A/B/C comunes por mes, secuencias determinadas por bono y personalización individual.
- **Antes del sprint 2:** validar la propuesta de publicación con comprobación de patrones y el tratamiento de modelos incompletos. No afecta a poder empezar la biblioteca.
- **Antes del sprint 5:** decidir si duración se muestra siempre o solo cuando corresponde. Propuesta: campo opcional visible para trabajo temporizado; acordar el detalle del indicador de modificaciones y las correcciones históricas.
- **Antes del sprint 6:** validar la interpretación de “nuevas/no personalizadas” y la exclusión de realizadas o con resultados en acciones masivas.
- **Dibujos, entrega opcional posterior:** el PDF los condiciona a viabilidad. Elegir mano alzada, adjuntar imagen o ambas antes de estimar. Una entrega separada deberá guardar/reabrir el esquema de sesión con permisos privados y conservar sus versiones históricas. Las notas escritas sí están incluidas en el sprint 5.
- Bonos distintos de 4/8/12, varios bonos simultáneos, más profesionales y nuevos permisos requieren reglas propias. No se inventan en esta fase.
- Guardado automático y sincronización offline completa no son compromisos del plan. Las recomendaciones técnicas del PDF se evalúan por separado.

## 7. Cobertura del PDF

| Apartados | Entrega |
|---|---|
| 1–2: objetivo y separación de conceptos | Reglas globales y sprints 1–3 |
| 3–5: modelos, secuencias y preparación mensual | Sprints 2–3; HIIT en 4 |
| 6: biblioteca y clasificación múltiple | Sprint 1 |
| 7: parámetros por ejercicio | Sprints 2–3; realizado en 5 |
| 8: agrupaciones, modalidades y descansos | Sprint 4 |
| 9: personalización individual | Sprints 3–4 |
| 10: actualización de modelos | Sprint 6 |
| 11–12: programado/ejecutado, historial y estados | Sprint 5, con aislamiento desde el 1 |
| 13: notas y dibujos | Sprint 5; dibujos en entrega opcional |
| 14: duplicación y reutilización | Ejercicios 1, modelos/meses 2, sesiones 3, bloques 4 |
| 15: criterios de aceptación | Cierre de cada sprint y condición común |
| 16–17: recomendaciones y asuntos abiertos | Decisiones pendientes, sin convertir recomendaciones en requisitos |

**Primer paso propuesto:** revisar el alcance del sprint 1 y concretar sus tareas técnicas. Esta hoja de ruta no autoriza ejecutar todos los sprints de una vez.
