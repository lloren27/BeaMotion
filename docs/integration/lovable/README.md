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
