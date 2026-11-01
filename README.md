# BeaMotion · Gestión de entrenamientos

Aplicación privada móvil para iOS y Android, creada con Expo, React Native,
TypeScript y Expo Router. La configuración contempla pantallas adaptables a
tablet.

## Empezar

Requiere Node.js 24.3 o superior dentro de la línea 24 (ver `.nvmrc`).

```sh
npm install
npm start
```

Después, usa `i` para iOS, `a` para Android o `w` para web en el terminal de
Expo. Los comandos directos están disponibles como `npm run ios`,
`npm run android` y `npm run web`.

## Estructura

- `src/app/`: rutas y layouts de Expo Router.
- `src/features/`: módulos funcionales de la aplicación.
- `src/domain/`: entidades, reglas, validadores y serializadores del dominio.
- `src/services/`: adaptadores externos y acceso a servicios.
- `supabase/`: espacio para futuras migraciones, funciones y pruebas de base.
- `docs/`: arquitectura, decisiones y contratos.

## Estado

Este scaffold solo contiene navegación y una pantalla inicial provisional. No
implementa autenticación, no conecta con Supabase o Lovable y no contiene
migraciones. La conexión con clientes debe esperar a la auditoría del backend
real de Lovable descrita en el plan del proyecto.
