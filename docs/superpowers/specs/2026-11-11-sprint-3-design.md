# Sprint 3: compatibilidad de ejercicios y distribución semanal

## Comportamiento confirmado

- **3.1:** un ejercicio solo se admite en un modelo si tiene al menos un patrón coincidente con los del modelo. Una coincidencia basta aunque tenga otras etiquetas. Sin etiquetas no se admite. Se conserva la comprobación de cobertura de todos los patrones al publicar.
- **3.2:** publicar una versión distribuye automáticamente sus ejercicios a las sesiones pendientes de esa semana y letra. Conserva las personalizaciones, las sesiones realizadas y los resultados.
- La semana se obtiene de las reservas de **Lovable**, decisión confirmada por el usuario. Se mantienen semanas de lunes a domingo, recortadas al mes y calculadas en Europe/Madrid.
- Trabajar en `feature/sprint-3`, sin commits, pushes ni despliegues. El usuario comprobará el funcionamiento al terminar.

## Enfoque

Se mantiene Expo/React Native/TypeScript y los dos proyectos Supabase. La app lee reservas, bonos y asistencias de Lovable; el Supabase de entrenamientos guarda las copias y aplica las protecciones transaccionales.

Se consideraron la asignación manual de semana y la vinculación a reservas: el usuario eligió reservas. Para comunicar ambos proyectos, se propone usar la sesión administrativa actual desde la app. Un servicio permanente de sincronización requeriría infraestructura y despliegue adicionales, fuera de este sprint.

## 3.1: admisión

El selector muestra solo ejercicios compatibles. La entrada manual exige seleccionar un patrón permitido antes de guardar; copiar otro modelo tampoco puede introducir ejercicios incompatibles. La base de datos valida guardado y publicación para evitar que se eluda la regla desde otro cliente. Los borradores antiguos incompatibles se pueden abrir y corregir; no se eliminan automáticamente ni se reescriben versiones históricas.

## 3.2: reservas, publicación y copias

Antes de publicar, consultar de forma paginada los clientes y bonos del mes, sus reservas y las asistencias. Preparar únicamente planes con un bono activo validado y no ambiguo de 4, 8 o 12 sesiones. La publicación debe incluir clientes cuyo perfil todavía no se haya abierto.

Conservar las secuencias C-C-C-C, A-B-A-B-A-B-A-B y A-B-C-A-B-C-A-B-C-A-B-C. Vincular reservas por identificador estable y orden cronológico a las sesiones disponibles. No reasignar silenciosamente contenido personalizado o realizado cuando cambie una reserva; señalar el conflicto y excluir la sesión de la distribución. Las sesiones sin reserva no reciben una semana inventada.

Consultar el estado de reserva y la asistencia más reciente. Las cancelaciones no reciben ejercicios; una asistencia confirmada protege la sesión aunque todavía no se haya abierto el perfil. Proteger también sesiones con resultados, contenido individual previo o fechas pasadas. Ante bonos ambiguos, exceso de reservas o vinculación histórica dudosa, conservar datos y mostrar la exclusión.

Después de obtener una lectura completa de Lovable, una RPC del Supabase propio valida revisiones, sincroniza los vínculos necesarios, publica y distribuye en una transacción. Si falla la consulta previa, no publicar parcialmente. No es posible una transacción entre ambos Supabase: la lectura de reservas representa el estado observado al iniciar la operación.

Copiar el contenido, orden, instrucciones, patrones, series, repeticiones, duración, descanso, carga, material y adaptación; registrar versión de origen. Los valores realizados permanecen vacíos. Publicar de nuevo reemplaza solo copias pendientes sin modificaciones individuales. Un reintento no duplica ejercicios ni sesiones.

Al abrir un perfil, actualizar sus reservas y completar las sesiones elegibles desde la última versión publicada de su semana. Así se atienden reservas creadas después de publicar. Esta sincronización ocurre al publicar o abrir/actualizar el perfil; no hay un proceso permanente en segundo plano.

## Protección y concurrencia

La base de datos registra personalizaciones al modificar ejercicios o series y serializa estas escrituras con la distribución bloqueando la sesión. Sesiones antiguas con contenido se consideran personalizadas de forma conservadora. Un guardado desde una pantalla obsoleta debe fallar de forma visible, no comunicar éxito tras actualizar cero filas.

Mantener RLS administrativa y comprobar autorización en cada RPC privilegiada. No introducir secretos de servidor en Expo. Migración incremental solo para el Supabase propio, conservando datos y resultados existentes.

## Presentación y validación

Mostrar fecha/semana, contenido pendiente, origen del modelo y personalización en el perfil; al publicar, informar cuántas sesiones recibieron contenido y cuáles quedaron excluidas. Preservar las ediciones locales ante errores.

Probar coincidencias múltiples y ausencia de etiquetas; semanas parciales y cambios de mes; bonos 4/8/12; reservas nuevas, canceladas y reprogramadas; perfiles no abiertos; personalizaciones y resultados; reintentos, concurrencia, permisos y reversión completa ante fallo.

La validación local no sustituye la prueba de integración con las cuentas configuradas ni autoriza aplicar migraciones remotas.
