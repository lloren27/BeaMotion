# Integración con Lovable Cloud

BeaMotion usa la URL y la clave publicable de Supabase mediante las variables
`EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` del `.env`
local. Un administrador inicia sesión con su cuenta de la web. La app consulta
`list_clients` y `client_overview` con esa sesión; las RPC aplican RLS.

## Entrenamientos en Supabase propio

Los planes, sesiones, ejercicios y resultados se guardan en un proyecto Supabase
separado, bajo control de BeaMotion. No se crean ni modifican tablas de
entrenamiento en Lovable. Configura `EXPO_PUBLIC_TRAINING_SUPABASE_URL` y
`EXPO_PUBLIC_TRAINING_SUPABASE_PUBLISHABLE_KEY` con los datos de ese proyecto,
aplica `supabase/migrations/202611040001_training_plans.sql` allí y crea en su
Auth una cuenta administradora con el mismo correo y contraseña usados en
Lovable. La cuenta de Lovable no se copia automáticamente. Si falta la cuenta
en BeaMotion, se podrá seguir consultando el listado de clientas, pero la sección
de entrenamientos indicará que su acceso no está disponible. La app inicia y
cierra sesión en ambos proyectos; en el proyecto
BeaMotion solo deben existir cuentas de confianza. Desactiva los registros
públicos en Auth para que las políticas RLS de las tablas de entrenamiento
solo den acceso a cuentas creadas por la administración. Después de crear la
cuenta de Auth, añade su usuario a la lista permitida desde el SQL Editor del
proyecto BeaMotion:

```sql
insert into public.training_admins (user_id)
select id from auth.users where email = 'CORREO_ADMIN'
on conflict (user_id) do nothing;
```

Sustituye `CORREO_ADMIN` por el correo de la cuenta administradora.
Si el `insert` no crea ninguna fila, comprueba en `Authentication > Users` que
esa cuenta existe y tiene el email confirmado. Crea la cuenta desde Auth, no
mediante un `insert` directo en `auth.users`.

Nunca pongas una clave `service_role` en Expo ni en el archivo `.env` de la app.

### Reparar el acceso de una entrenadora en TestFlight

Si puede ver clientas pero aparece «No se pudo iniciar sesión en el proyecto
de entrenamientos» o «Conecta la cuenta de entrenamientos», revisa la cuenta
con la que **inicia sesión la entrenadora**, no el correo del perfil abierto.
Ese mensaje indica que no hay sesión de entrenamientos; añadir un permiso
por sí solo no corrige una contraseña distinta ni una cuenta inexistente.

1. En el Supabase propio de entrenamientos, abre **Authentication > Users**.
   Comprueba que existe ese correo y que está confirmado. Si falta, crea la
   cuenta mediante Auth con el mismo correo y contraseña usados en Lovable.
   Si ya existe, comprueba que puede iniciar sesión con esas credenciales.
   No escribas contraseñas en SQL ni las compartas en el chat.
2. Abre `scripts/grant_training_admin.sql`, sustituye `CORREO_ADMIN` por su
   correo y ejecútalo en el **SQL Editor del proyecto de entrenamientos**.
   Valida la cuenta y añade el permiso sin duplicarlo. Este permiso permite
   gestionar los entrenamientos de todas las clientas: solo para personal
   administrador de confianza.
3. Cierra sesión en la app y vuelve a entrar. Comprueba **Ejercicios**,
   **Modelos mensuales** y **Entrenamientos** dentro de una ficha.

Este procedimiento no requiere una nueva build de TestFlight. El script no
comprueba contraseñas ni corrige problemas de red; si el mensaje persiste tras
el nuevo login, hay que revisar el error de Auth del proyecto de entrenamientos.

Prueba local del script (PostgreSQL disponible, nunca contra Supabase remoto):
`python3 tests/training-admin-access.py`. Crea y elimina su propia base desechable.

Al abrir una ficha, BeaMotion consulta los bonos de Lovable. Para el mes elegido
solo permite generar un plan si hay exactamente un bono `active` con el pago
validado y 4, 8 o 12 sesiones. Para el mes actual lo crea automáticamente al
abrir la ficha si todavía no existe; para otros meses ofrece un botón. El tamaño
del plan y su secuencia A/B/C salen de ese bono. La referencia se establece por clienta y mes; los bonos siguen
perteneciendo a Lovable y no se copian a la base de entrenamientos. Los planes
ya creados pueden consultarse aunque el bono deje de estar activo.

Al abrir el plan del mes actual, BeaMotion consulta las reservas de ese bono y
las asistencias `attended` enlazadas por `attendance.booking_id`. Ordena las
reservas por fecha y marca como realizadas las primeras sesiones disponibles
del plan, saltando las marcadas como no realizadas. El resultado se guarda en
el Supabase propio y puede actualizarse con «Actualizar asistencias». Las
reservas sin asistencia confirmada no cuentan como realizadas.

Las RPC aplicadas están documentadas en `beamotion-rpc-v3.sql`. La política de
lectura para notas, formulario y diario quedó documentada en
`admin-client-read-policies.sql` y se aplicó en Lovable Cloud. El script
`scripts/check_lovable_rpc.py` permite repetir una prueba manual de login y
lectura sin imprimir datos de clientas.

El antiguo endpoint `sync-client-data` y `SYNC_API_KEY` no forman parte de esta
integración móvil. No copies secretos de servidor a Expo ni a Git.

## Biblioteca de ejercicios

En el proyecto Supabase **propio de entrenamientos**, aplicar después de la
migración inicial `supabase/migrations/202611090001_exercise_catalog.sql`.
No aplicarla al proyecto de Lovable. La migración agrega el catálogo y la
copia de referencia para ejercicios de sesión sin modificar los registros ya
existentes. Mantiene el acceso mediante la lista `training_admins` y RLS.

En la app, abrir **Ejercicios** desde la lista de clientas para crear y editar
fichas; en una sesión, usar **Elegir de la biblioteca**. La copia queda guardada
en la sesión aunque se edite o archive la ficha de catálogo. El ejercicio libre
sigue disponible. La instancia Supabase propia y una cuenta administradora deben
estar configuradas antes de probar el guardado.

## Modelos mensuales

Para habilitar la preparación de modelos A, B y C, aplicar en el Supabase propio
de entrenamientos la migración incremental
`supabase/migrations/202611100001_monthly_models.sql`, después de las migraciones
anteriores. No ejecutar en Lovable. La pantalla «Modelos mensuales» permite
crear el mes desde cero o copiar los borradores del mes anterior, editar y
publicar versiones. Los modelos todavía no se asignan a clientas: esa función
pertenece al sprint 3.

### Semanas del mes

Aplicar también `supabase/migrations/202611100002_weekly_models.sql`, después
de `202611100001_monthly_models.sql`. Si ya se había aplicado la primera,
ejecutar únicamente la segunda. La migración conserva los modelos y versiones
existentes como primera semana y crea las semanas restantes heredando su base.

Las semanas van de lunes a domingo y se recortan a los días del mes. Las
semanas posteriores heredan su modelo de la primera mientras no se editen;
al personalizar una se conserva independiente. «Actualizar desde la semana 1»
pide confirmación, sustituye el borrador y reactiva la herencia; las versiones
publicadas no se cambian. Al copiar un mes anterior se usa su primera semana.

## Sprint 3: ejercicios compatibles y distribución semanal

Aplicar **solo en el Supabase propio de entrenamientos**, después de las cuatro
migraciones anteriores:
`supabase/migrations/202611110001_model_distribution.sql`.
La aplicación nueva requiere esta migración; instalar ambas conjuntamente.
No se ha aplicado automáticamente a ningún proyecto remoto.

El selector de modelos admite ejercicios con al menos un patrón coincidente.
El guardado también valida ejercicios libres y copias. Los borradores antiguos
incompatibles se conservan para corregirlos; las versiones históricas no cambian.

Al pulsar **Publicar**, la app consulta todos los bonos activos con pago validado
del mes, las reservas y las asistencias de Lovable. Incluye clientes cuyo perfil
no se haya abierto. Si falla una consulta, no publica. Después, una transacción
en el Supabase propio sincroniza vínculos, publica y copia ejercicios a las
sesiones elegibles de esa semana y letra. Repetir una publicación sin cambios
reutiliza la versión y no duplica contenido.

La semana se calcula con la fecha de la reserva en Europe/Madrid. Se conservan
las secuencias 4=C-C-C-C, 8=A-B-A-B-A-B-A-B y 12=A-B-C-A-B-C-A-B-C-A-B-C.
Las sesiones sin reserva no reciben una semana inventada. Los vínculos por ID
conservan la identidad de la reserva; si una reserva nueva o reprogramada rompe
el orden de la secuencia existente, se excluye el cliente y se muestra un enlace
para revisarlo. No se reasignan automáticamente sesiones con historial dudoso.

Se preservan sesiones personalizadas, realizadas, con resultados y de fechas
pasadas. La migración considera personalizado cualquier contenido individual
preexistente. Una reserva cancelada libera únicamente una copia pendiente,
intacta y no pasada. Una reprogramación con contenido protegido se informa como
conflicto. Sin versión publicada para la semana, aparece contenido pendiente.

Al abrir un perfil o pulsar **Actualizar reservas y ejercicios**, se consultan
reservas nuevas y se completa el contenido desde las versiones publicadas.
Esta sincronización no es un proceso permanente: ocurre al publicar o actualizar
el perfil. Si Lovable falla, sigue siendo posible consultar el plan ya guardado,
pero no se actualizan reservas ni se distribuye contenido.

La lectura de Lovable y la transacción propia pertenecen a dos bases distintas:
no existe atomicidad entre ambas. Las lecturas caducan a los cinco minutos y una
lectura anterior no puede sustituir a otra más reciente ya aplicada. Los errores
de revisión concurrente requieren recargar antes de volver a guardar.

### Prueba manual del sprint 3

1. En un modelo A, comprobar que un ejercicio solo de empuje inferior no se
   ofrece; un ejercicio con core y otra etiqueta sí se ofrece. Probar también
   un ejercicio libre sin etiquetas y corregirlo antes de guardar.
2. Preparar y publicar A/B/C de una semana futura con clientes de prueba cuyos
   bonos válidos y reservas estén en Lovable. Comprobar la fecha y letra en cada
   perfil, incluidos perfiles que no se habían abierto.
3. Verificar instrucciones, material, adaptación, series, repeticiones,
   duración, descanso y carga. Los campos realizados deben estar vacíos.
4. Personalizar y guardar un ejercicio de un cliente, registrar una asistencia
   de otro y republicar un cambio. Ambos conservan su contenido; una copia
   pendiente intacta recibe el cambio. Cerrar y reabrir para verificarlo.
5. Crear una reserva después de publicar y actualizar el perfil. Probar una
   cancelación y un cambio a una semana sin versión publicada. Revisar los
   mensajes de conflicto si se altera el orden o existe una adaptación.
6. Abrir dos dispositivos, editar y publicar a la vez: no debe haber duplicados
   ni pérdida silenciosa de personalizaciones; una pantalla obsoleta avisa.

### Pruebas locales reproducibles

- `node --test tests/*.test.ts`
- `npx tsc --noEmit`
- Con PostgreSQL local disponible: `PGHOST=/private/tmp PGPORT=55439 sh scripts/test_training_db.sh`.
  El script crea una base desechable, prueba cada migración con su suite original,
  valida datos anteriores al sprint 3 y ejecuta transacciones concurrentes.
  Elimina únicamente la base que acaba de crear. Nunca usa proyectos remotos.
