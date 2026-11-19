# TestFlight de BeaMotion

Proyecto Expo: lloren27/beamotion-entrenamientos.
Identificador iOS: com.lloren27.beamotion. App Store Connect ID: 6833997527.

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
npm run deploy
```

El script espera a que termine la build y envía su ID exacto a App Store
Connect. Termina con error si falla cualquier paso. El perfil submit fija
`ascAppId` 6833997527, correspondiente a `com.lloren27.beamotion`.
La primera ejecución requiere tener las credenciales de Apple configuradas
previamente en EAS.

En App Store Connect, completar la información beta, la declaración de cifrado
y la cuenta de revisión con datos de prueba. Invitar a la clienta por correo
como tester externa después de la revisión beta de Apple. Las cuentas de acceso
a BeaMotion y sus permisos en ambos Supabase son independientes de TestFlight.

La build iOS 1.0.0 (2) se envió a App Store Connect el 19 de noviembre de 2026.
