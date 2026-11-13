# TestFlight de BeaMotion

Proyecto Expo: lloren27/beamotion-entrenamientos.
Identificador iOS: com.lloren27.beamotion (pendiente de registrar en Apple).

El perfil production de eas.json genera una build para dispositivos físicos,
con distribución store, válida para TestFlight. No publica la app en la tienda.
EAS gestiona remotamente el número de build y lo incrementa automáticamente.

## Variables antes de compilar

En el proyecto de Expo, Environment variables, entorno production, configurar:

- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- EXPO_PUBLIC_TRAINING_SUPABASE_URL
- EXPO_PUBLIC_TRAINING_SUPABASE_PUBLISHABLE_KEY

Usar los valores del entorno elegido para las pruebas. Los archivos .env locales
están ignorados por Git: no asumir que estarán disponibles en la build remota.
Estas cuatro variables son públicas y se incorporan a la app; nunca añadir
service_role, contraseñas ni claves privadas. No guardar sus valores en eas.json.

## Compilar y enviar

Desde la raíz del repositorio, con sesión iniciada en Expo:

```sh
eas build --platform ios --profile production
```

El asistente solicitará el acceso a Apple para configurar los certificados y
el perfil de aprovisionamiento. Introducir credenciales y códigos directamente
en el asistente, no en archivos del repositorio.

Cuando la build termine correctamente:

```sh
eas submit --platform ios --profile production
```

Seleccionar la build correcta y la app de App Store Connect con el mismo
bundleIdentifier. El perfil submit no fija todavía ascAppId porque la ficha
Apple no se ha confirmado. No usar auto-submit hasta verificar esta configuración.

En App Store Connect, completar la información beta, la declaración de cifrado
y la cuenta de revisión con datos de prueba. Invitar a la clienta por correo
como tester externa después de la revisión beta de Apple. Las cuentas de acceso
a BeaMotion y sus permisos en ambos Supabase son independientes de TestFlight.

No se han generado builds ni enviado versiones al preparar estos archivos.
