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

El resto de la API exige un token válido, que el middleware acepta tanto en el
header `Authorization` como dentro del body (`body.headers.Authorization`). El
fallback al body existe porque varios services del portal todavía lo mandan así.

Estos endpoints quedan abiertos:

| Endpoint | Consumidor | Por qué |
|---|---|---|
| `POST /wellData` | dispositivos IoT (Layrz) | no tienen forma de autenticarse |
| `POST /massImportWellData` | dispositivos IoT (Layrz) | no tienen forma de autenticarse |
| `GET /fetchUnsentReports` | servicio SENDER | llama por HTTP sin token |
| `POST /repostToDGA` | servicio SENDER | llama por HTTP sin token |
| `POST /users/login` | portal | es el que emite el token |
| `POST /send-email` | landing page | formulario de contacto público |
| `GET /placeholder` | ninguno | ruta de ejemplo |

Los cuatro primeros deberían pasar a validar un secreto compartido
(`INTERNAL_API_KEY`) enviado por header. Eso requiere coordinar el cambio con
Layrz y con el deploy del SENDER, así que no entra en el hotfix de autorización.

### Consecuencias que conviene tener presentes

**Se puede inyectar telemetría falsa.** `POST /wellData` y `POST
/massImportWellData` aceptan reportes de cualquiera que conozca el `code` de un
pozo. Ese código viaja en las respuestas de varios endpoints del portal.

**El reenvío a la DGA sigue siendo disparable sin sesión.**
`POST /repostAllReportsToDGA` exige sesión, pero `POST /repostToDGA` hace lo
mismo de a un reporte y queda abierto. Autenticar el primero sube el costo de
abusar el reenvío, no lo impide. Cerrar el segundo depende del SENDER.

**`POST /send-email` es un relay de correo abierto.** No tiene rate limit ni
captcha, y despacha desde la cuenta de Gmail configurada en `EMAIL_USER`. Abusarlo
puede terminar con la cuenta bloqueada por Google.

**Ni el borrado masivo ni el reenvío validan pertenencia.**
`DELETE /wellData/bulk` y `POST /repostAllReportsToDGA` operan sobre los `id` que
reciben sin comprobar que los reportes sean de un pozo del cliente que hace la
petición. Exigen sesión, pero cualquier usuario autenticado puede tocar reportes
de otro cliente. Los `id` son autoincrementales, así que no hay que adivinarlos.
