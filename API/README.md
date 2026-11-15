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

## Ejecución

En producción la API corre con `npm start`, es decir, `node src/server.js`. Si el proceso termina por un error, el contenedor se detiene y Docker lo levanta de nuevo. `GET /health` responde 200 si la API y la base están disponibles.

Para desarrollo con recarga automática se usa `npm run dev` (nodemon). Con docker-compose, se puede crear en la raíz del repo un `docker-compose.override.yml`, que está en `.gitignore` y que Compose combina solo si existe:

```yaml
services:
  api:
    command: ["npm", "run", "dev"]
```

Ese archivo no debe existir en la instancia de producción.

## Tests

```bash
npm test          # la suite completa salvo tests/models
npm run test:models   # sólo tests/models: BORRA la base configurada
```

`npm test` excluye `tests/models` a propósito. Esos tests hacen
`sequelize.sync({ force: true })`, así que borran y recrean todas las tablas de
la base que apunte el `.env` en ese momento. El resto de la suite no toca la
base: mockea los modelos, y `server.test.js` bloquea axios antes de cargar nada
para que ningún camino pueda transmitir a la DGA.

Antes, `npm test` corría todo y el filtro dependía de que quien lo ejecutara se
acordara de escribirlo. Correrlo con el `.env` de desarrollo apuntando a una
base con datos era suficiente para perderlos.

`tests/helpers/safe-database.js` sigue siendo la última barrera de
`test:models`, pero es una comprobación de nombre de base, no una garantía.

**El CI corre `npm test` en cada PR que toque `API/`.** Está en
`.github/workflows/ci.yml` y no necesita ni Postgres ni secretos, justamente
porque la suite que corre no depende de ninguno de los dos.

## Endpoints sin autenticación

El resto de la API exige un token válido, que el middleware acepta tanto en el
header `Authorization` como dentro del body (`body.headers.Authorization`). El
fallback al body existe porque varios services del portal todavía lo mandan así.

Estos endpoints quedan abiertos:

| Endpoint | Consumidor | Por qué |
|---|---|---|
| `POST /wellData` | dispositivos IoT (Layrz) | no tienen forma de autenticarse |
| `POST /massImportWellData` | dispositivos IoT (Layrz) | no tienen forma de autenticarse |
| `POST /users/login` | portal | es el que emite el token |
| `POST /send-email` | landing page | formulario de contacto público |
| `GET /placeholder` | ninguno | ruta de ejemplo |

Los dos primeros deberían pasar a validar un secreto o a restringirse por IP.
Eso requiere coordinar el cambio con Layrz (issue #62).

**Rutas del SENDER.** `GET /fetchUnsentReports` y `POST /repostToDGA` no usan
JWT porque el SENDER no tiene usuario, pero exigen la clave interna compartida
en el header `X-Internal-Api-Key`, igual a `INTERNAL_API_KEY`. Si la variable no
está configurada con al menos 32 caracteres, se rechaza toda llamada.

**`GET /well`.** Exige sesión de admin. Antes era anónimo y entregaba el código
de todos los pozos. Se cerró después de revisar los logs de producción: ni el
portal ni los dispositivos lo usan.

### Consecuencias que conviene tener presentes

**Se puede inyectar telemetría falsa.** `POST /wellData` y `POST
/massImportWellData` aceptan reportes de cualquiera que conozca el `code` de un
pozo. Ese código viaja en las respuestas de varios endpoints del portal.

**`POST /send-email` es un relay de correo abierto.** No tiene rate limit ni
captcha, y despacha desde la cuenta de Gmail configurada en `EMAIL_USER`. Abusarlo
puede terminar con la cuenta bloqueada por Google.

**Ni el borrado masivo ni el reenvío validan pertenencia.**
`DELETE /wellData/bulk` y `POST /repostAllReportsToDGA` operan sobre los `id` que
reciben sin comprobar que los reportes sean de un pozo del cliente que hace la
petición. Exigen sesión, pero cualquier usuario autenticado puede tocar reportes
de otro cliente. Los `id` son autoincrementales, así que no hay que adivinarlos.
