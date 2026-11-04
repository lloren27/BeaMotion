# Integración con Lovable Cloud

BeaMotion usa la URL y la clave publicable de Supabase mediante las variables
`EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` del `.env`
local. Un administrador inicia sesión con su cuenta de la web. La app consulta
`list_clients` y `client_overview` con esa sesión; las RPC aplican RLS.

Las RPC aplicadas están documentadas en `beamotion-rpc-v3.sql`. La política de
lectura para notas, formulario y diario quedó documentada en
`admin-client-read-policies.sql` y se aplicó en Lovable Cloud. El script
`scripts/check_lovable_rpc.py` permite repetir una prueba manual de login y
lectura sin imprimir datos de clientas.

El antiguo endpoint `sync-client-data` y `SYNC_API_KEY` no forman parte de esta
integración móvil. No copies secretos de servidor a Expo ni a Git.
