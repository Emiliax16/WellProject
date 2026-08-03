# WellProject Main App - API
El proyecto se basa en la creación de una aplicación que permita gestionar diferentes clientes que poseen pozos de agua y necesitan mandar la información del estado del pozo costantemente. Para esto, la aplicación recibe a todas horas un reporte por pozo registrado, siendo visible desde el perfil de cada cliente y siendo enviado a la Dirección general del agua (dga).

## índice
- Primeros pasos
  - [Instrucciones de Instalación](documentations/setup.md)
  - [Tecnologías utilizadas](documentations/technologies.md)
  - [Estructura del Código](documentations/files-order.md)
- Convenciones
  - [Proceso de desarrollo](documentations/dev-process.md)
  - [Convenciones de git](documentations/git-conventions.md)
  - [Prácticas para revisión de PR](documentations/review-pr-process.md)
- Base de datos
  - [Modelos de datos](documentations/model.md)
- Comandos útiles
  - [Modo de uso de técnologías](documentations/sequelize-command.md)
- Instancia de Amazon
  - [Navegación y comandos](documentations/amazon-instance.md)

## Endpoints sin autenticación

Todo el resto de la API exige un JWT válido en el header `Authorization`. Estos
cuatro endpoints quedan abiertos a propósito porque los consumen procesos que
hoy no tienen forma de autenticarse:

| Endpoint | Consumidor |
|---|---|
| `POST /wellData` | dispositivos IoT (Layrz) |
| `POST /massImportWellData` | dispositivos IoT (Layrz) |
| `GET /fetchUnsentReports` | servicio SENDER |
| `POST /repostToDGA` | servicio SENDER |

Son un pendiente conocido: los cuatro deberían pasar a validar un secreto
compartido (`INTERNAL_API_KEY`) enviado por header. Eso requiere coordinar el
cambio con Layrz y con el deploy del SENDER, así que no entra en el hotfix de
autorización.

Ojo con `POST /wellData` y `POST /massImportWellData`: hoy cualquiera puede
inyectar telemetría falsa si conoce el `code` de un pozo.
