# Inicio: entrenamientos de hoy

Diseño aprobado en la conversación: mostrar clientes con reserva vigente hoy en Europe/Madrid, incluidos los que no tienen plan preparado. Cada cliente abre sus entrenamientos en esa fecha. Mantener el listado completo en Clientes.

## Enfoque
Consultar reservas vigentes y sus sesiones en Lovable, agrupar por cliente y ordenar por hora. Obtener únicamente nombres de los perfiles asociados. No depender de planes o bonos: filtrar por planes excluiría reservas sin contenido preparado. No crear migraciones, dependencias, commits ni despliegues.

## Interfaz y navegación
Inicio «Hoy» con fecha, total de clientes, nombre y horas. Estados de carga, error con reintento y día vacío. Actualizar al recuperar foco, volver a la aplicación, refrescar o cambiar el día. Pasar fecha a la ficha existente; colocar entrenamientos primero y filtrar sus sesiones por día, con opción de ver todo el mes. Mostrar ausencia de entrenamiento preparado cuando proceda.
