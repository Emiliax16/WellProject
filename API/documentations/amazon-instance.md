# Operación de la instancia de producción

Esta guía describe cómo está montada la instancia EC2 que corre la API y la base de datos, y cómo revisarla y actualizarla sin interrumpir la recepción de reportes. La instancia no se actualiza sola: cada cambio mergeado en `master` llega a producción solo cuando alguien lo despliega a mano siguiendo estos pasos.

Los valores sensibles (IP, ruta de la llave, contraseñas, correos) no se escriben en este repositorio, que es público. Donde aparecen `<IP_PUBLICA>`, `<ruta-a-la-llave.pem>` o `<DB_USERNAME>`, se deben reemplazar por los valores que tiene la persona responsable del proyecto.

## Cómo está montada

La instancia tiene menos de 1 GB de RAM y un swap de 2 GB, así que cualquier consulta o proceso que cargue muchos datos en memoria puede dejarla sin responder. Sobre ella corren los siguientes componentes:

| Componente | Dónde | Notas |
|---|---|---|
| Nginx | Host, puertos 80 y 443 | Termina TLS con certificados de Certbot y reenvía `promedicionbackend.com` a `localhost:3000` |
| `api` | Contenedor Docker | Express con `node src/server.js`. El código se monta desde `~/WellProject/API` como volumen. Healthcheck en `/health` |
| `wellproject-db-1` | Contenedor Docker | PostgreSQL 14, base `db-well`, volumen persistente |

El `docker-compose.yml` publica los puertos 3000 y 5432 en todas las interfaces del host, y Docker se salta las reglas de firewall del sistema operativo (ufw). Por eso el security group de AWS es la única barrera de red que los separa de internet: debe aceptar solo 22, 80 y 443, y nunca abrir 3000 ni 5432.

El frontend no vive en esta instancia. Se sirve desde S3 y CloudFront, y su despliegue está documentado en el repositorio `WellProjectFront`, en `documentations/deployment.md`.

### Variables de entorno

Hay dos archivos de entorno en la instancia, ninguno versionado:

1. `~/WellProject/.env`, que docker-compose inyecta en el contenedor `api` al crearlo. Contiene la conexión a la base.
2. `~/WellProject/API/.env`, que la API lee con `dotenv` al arrancar. Contiene, entre otras, `JWT_SECRET`, las credenciales de correo, y la programación de la alerta y del reintento a la DGA (`ALERT_CRON_SCHEDULE`, `DGA_RETRY_CRON_SCHEDULE`, `CRON_TIMEZONE`).

Algunas variables están repetidas en los dos archivos (las `DB_*`, `API_PORT` y `NODE_ENV`). Como `dotenv` no sobrescribe variables que ya existen, en esos casos gana el valor de `~/WellProject/.env`, y cambiarlas en `API/.env` no tiene efecto. La forma de aplicar un cambio también depende del archivo, como se explica en "Aplicar cambios de entorno".

Para revisar qué variables existen sin mostrar sus valores, ni los comentarios del archivo, se puede usar:

```sh
grep -oE '^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*[[:space:]]*=' ~/WellProject/API/.env | tr -d ' ='
```

## Acceso

```sh
ssh -i <ruta-a-la-llave.pem> ubuntu@<IP_PUBLICA>
```

La llave debe tener permisos `600`; de lo contrario SSH la rechaza. El acceso por contraseña está deshabilitado.

## Revisiones de solo lectura

Antes de desplegar, o cuando algo parece fallar, conviene partir por revisiones que no cambian nada. La primera confirma qué versión del código está en disco y si hay cambios locales:

```sh
cd ~/WellProject
git log -1 --format='%h %cd %s' --date=short
git status -sb
```

`git status` no debe mostrar cambios en archivos versionados. Los archivos sin seguimiento conocidos, como los respaldos antiguos de `API/.env`, pueden quedarse. Cualquier cambio en un archivo versionado hay que entenderlo antes de desplegar.

La segunda revisión muestra el estado de los contenedores y desde cuándo corren:

```sh
sudo docker ps --format '{{.Names}}  {{.Status}}  {{.Ports}}'
```

Que el commit en disco sea el correcto no garantiza que el proceso lo haya cargado. Para comprobarlo, se compara la hora de inicio del proceso de Node con la del último despliegue:

```sh
sudo docker exec api sh -c 'ps -o pid,etime,args | grep "node src/server.js" | grep -v grep'
```

Los logs de la API incluyen el cuerpo de cada reporte recibido, así que conviene filtrarlos. Este comando muestra las respuestas de la DGA y los errores de la última hora:

```sh
sudo docker logs api --since 1h 2>&1 | grep -aE '\[dga\]|"level":"(error|fatal)"|\[scheduler\]'
```

Por último, para revisar la memoria y el disco:

```sh
free -m; df -h /; sudo du -sh /var/lib/docker/containers
```

### Consultas a la base

La base guarda datos reales de clientes. Para revisarla sin riesgo de modificarla, la sesión se abre en modo solo lectura y con un límite de tiempo por consulta. Así, un `UPDATE` o `DELETE` escrito por error es rechazado por Postgres, y una consulta pesada se corta antes de afectar la instancia:

```sh
sudo docker exec -it -e PGOPTIONS="-c default_transaction_read_only=on -c statement_timeout=30000" \
  wellproject-db-1 psql -U <DB_USERNAME> -d db-well
```

La tabla `"wellData"` crece con cada reporte y no tiene índices por `code` ni por `createdAt`, de modo que las consultas sobre ella recorren la tabla completa. Filtrar por fecha no evita ese recorrido, pero sí reduce lo que la consulta agrupa y devuelve, que es lo que consume memoria. Por eso deben ir siempre filtradas por fecha y nunca hacer `SELECT *` sin límite. Algunas consultas útiles son las siguientes:

```sql
-- Migraciones aplicadas
SELECT count(*), max(name) FROM "SequelizeMeta";

-- Último reporte y último envío aceptado por pozo, en los últimos 7 días
SELECT w.code, w.name, w."isActived",
  max(d."createdAt") AS ultimo_reporte,
  max(d."createdAt") FILTER (WHERE d.sent) AS ultimo_envio
FROM wells w
LEFT JOIN "wellData" d ON d.code = w.code AND d."createdAt" > now() - interval '7 days'
GROUP BY 1, 2, 3 ORDER BY 1;

-- Recibidos y enviados por día
SELECT "createdAt"::date AS dia, count(*) AS recibidos, count(*) FILTER (WHERE sent) AS enviados
FROM "wellData" WHERE "createdAt" > now() - interval '10 days' GROUP BY 1 ORDER BY 1;
```

Al leer el último resultado hay que considerar que los pozos pueden enviar más de un reporte por hora y la DGA rechaza los siguientes con el mensaje "Ya existe un registro en esa fecha, hora para la obra". Como la hora sí quedó registrada, la API marca ese reporte como enviado y lo deja en el log como `se marca como enviado`. Los reportes rechazados así antes del PR #97 (noviembre de 2026) siguen con `sent = false`, de modo que en los datos históricos una proporción alta de reportes no enviados no indica por sí sola una pérdida.

## Desplegar la API

El código de la API se monta como volumen, pero la API corre con `node` y no recarga sola: después de actualizar los archivos sigue corriendo la versión anterior hasta que se reinicia el contenedor (paso 9). Al reiniciar, `server.js` deja de aceptar conexiones y espera hasta 13 segundos a que terminen las peticiones en curso, y Docker le da 15 antes de forzar el cierre, siempre que se use `restart -t 15`: en docker-compose 2.17, `restart` usa 10 segundos si no se indica. Aun así, durante unos segundos la API no responde, y un reporte que llegue en ese momento puede perderse si el dispositivo no reintenta. Antes de desplegar conviene revisar en los logs en qué minutos reportan los pozos y elegir un momento lejano a ellos, y también evitar las 08:00, la hora del chequeo diario de alertas.

La instancia no tiene una llave registrada en GitHub, por lo que `git pull origin master` falla con un error de permisos. Como el repositorio es público, los cambios se bajan por HTTPS sin credenciales y sin modificar el remoto configurado. El procedimiento es el siguiente:

1. Anotar el commit actual, que es el punto de retorno si algo falla:

   ```sh
   cd ~/WellProject
   echo "$(date -u +%FT%TZ) antes=$(git rev-parse HEAD)" >> ~/deploys.log
   ```

2. Bajar `master` sin aplicarlo todavía y revisar qué va a cambiar:

   ```sh
   git fetch https://github.com/Emiliax16/WellProject.git master
   git log --oneline HEAD..FETCH_HEAD
   git diff --stat HEAD FETCH_HEAD
   ```

3. Comprobar que ningún archivo nuevo del despliegue exista ya sin versionar en la instancia. Este comando los lista; si imprime algo, ese archivo se mueve a un respaldo fuera del repositorio antes de seguir. No se usa con `set -e`, porque el último `[ -e ]` falso cortaría el script:

   ```sh
   git diff --name-only --diff-filter=A HEAD FETCH_HEAD | while read f; do if [ -e "$f" ]; then echo "choca: $f"; fi; done
   ```

   Si el despliegue es el que elimina el SENDER, antes del merge hay que seguir la sección "Retirar el SENDER (una sola vez)": la instancia tiene un cambio local en un archivo que ese despliegue borra, y sin ese paso el merge aborta.

4. Revisar si el cambio trae migraciones nuevas o cambios de dependencias:

   ```sh
   git diff --stat HEAD FETCH_HEAD -- API/migrations API/package.json API/package-lock.json docker-compose.yml API/development.Dockerfile
   ```

5. **Solo si hay migraciones:** respaldar la base ahora, antes de aplicar el código. Si el respaldo falla, no se sigue:

   ```sh
   ( umask 077
     sudo docker exec wellproject-db-1 pg_dump -U <DB_USERNAME> -d db-well -Fc > ~/respaldo-$(date +%F).dump \
       && sudo docker exec -i wellproject-db-1 pg_restore -l < ~/respaldo-$(date +%F).dump > /dev/null \
       && echo "respaldo OK" )
   ```

   El respaldo contiene las credenciales DGA de los pozos en texto plano. Por eso se crea con permisos solo para el dueño y se borra cuando ya no sea necesario. El `umask` va entre paréntesis para que no afecte a los archivos que Git escribe en el paso siguiente.

6. Aplicar el cambio. `--ff-only` evita que Git cree un merge si la instancia divergió de `master`:

   ```sh
   git merge --ff-only FETCH_HEAD
   ```

7. **Solo si hay migraciones:** aplicarlas inmediatamente después del merge. Se fija la versión de `sequelize-cli` porque no está en `package.json`, y sin versión `npx` descargaría y ejecutaría la última que exista en npm:

   ```sh
   sudo docker exec api npx sequelize-cli@6.6.5 db:migrate:status
   sudo docker exec api npx sequelize-cli@6.6.5 db:migrate
   ```

8. **Solo si cambiaron `package.json`, `package-lock.json`, `docker-compose.yml` o `development.Dockerfile`:** reconstruir la imagen y recrear el contenedor con un volumen de `node_modules` nuevo (`-V`). De lo contrario, el contenedor sigue usando las dependencias antiguas. El build corre mientras la versión anterior sigue atendiendo, y la recreación ya arranca el código nuevo, así que en este caso se salta el paso 9:

   ```sh
   sudo docker-compose up -d --build -V --no-deps api
   ```

9. Reiniciar la API para que cargue el código nuevo. `-t 15` le da a las peticiones en curso el margen completo:

   ```sh
   sudo docker-compose restart -t 15 api
   ```

10. Verificar que la API arrancó, que está sana y que vuelve a recibir reportes:

    ```sh
    sudo docker logs api --since 2m 2>&1 | grep -aE 'Escuchando|scheduler|internal-key|Error|fatal'
    sudo docker ps --filter name=api --format '{{.Names}} {{.Status}}'   # debe decir (healthy)
    ```

    Luego, esperar al siguiente reporte de un pozo y confirmar que aparece una línea `[dga]`.

11. Registrar el commit nuevo con `echo "despues=$(git rev-parse HEAD)" >> ~/deploys.log`.

### Volver atrás

Para volver atrás se mueve el repositorio al commit anotado en `~/deploys.log`. Antes hay que deshacer lo que el despliegue haya hecho fuera del código, en este orden:

1. Si se aplicaron migraciones, revertirlas mientras los archivos de migración todavía existen, con `sudo docker exec api npx sequelize-cli@6.6.5 db:migrate:undo` (una vez por migración aplicada). Si eso falla, la base se restaura desde el respaldo del paso 5. Restaurar sobre la base en uso exige detener antes la API (`sudo docker-compose stop api`) y reemplaza todos los datos, incluidos los reportes recibidos después del respaldo:

   ```sh
   sudo docker exec -i wellproject-db-1 pg_restore -U <DB_USERNAME> -d db-well --clean --if-exists < ~/respaldo-<fecha>.dump
   sudo docker-compose start api
   ```
2. Mover el código. `--keep` conserva los cambios locales que no forman parte del despliegue y aborta si alguno chocaría:

   ```sh
   git reset --keep <commit-anterior>
   ```

3. Si el despliegue había cambiado dependencias, volver a ejecutar `sudo docker-compose up -d --build -V --no-deps api`.

### Aplicar cambios de entorno

La forma de aplicar un cambio de variables depende del archivo. Para `API/.env` basta con reiniciar el proceso, porque `dotenv` lo vuelve a leer al arrancar:

```sh
sudo docker-compose restart -t 15 api
```

Para `~/WellProject/.env`, en cambio, `restart` no sirve: docker-compose lee ese archivo al crear el contenedor, así que hay que recrearlo:

```sh
sudo docker-compose up -d --no-deps api
```

En ningún caso se debe usar `docker-compose down` para esto, porque detiene también Postgres.

Tampoco se debe usar `docker-compose up -d` sin nombrar el servicio y sin `--no-deps`. Si la configuración de `db` en `docker-compose.yml` difiere de la de su contenedor, la recrea, y la base se detiene en medio del tráfico. Siempre `up -d --no-deps <servicio>`.

### Salud de la API

`GET /health` responde `200 {"status":"ok"}` si la API está viva y la base responde, y `503` si no. Es pública y no devuelve detalles. Docker la consulta cada minuto, y `docker ps` muestra el resultado como `(healthy)` o `(unhealthy)`.

Un contenedor `unhealthy` no se reinicia solo: docker-compose solo informa el estado. Lo que sí se reinicia solo es un proceso que termina, porque la API corre con `node` y el contenedor tiene `restart: unless-stopped`. Para enterarse de una caída sin estar mirando la instancia, conviene configurar un monitor externo gratuito, por ejemplo UptimeRobot, que consulte `https://promedicionbackend.com/health` cada pocos minutos y avise por correo.

### Cambio a `node`, healthcheck y rotación de logs (una sola vez)

Hasta noviembre de 2026 la API corría con nodemon, el contenedor no tenía healthcheck y los logs no rotaban. Esos cambios están en `docker-compose.yml` y solo se aplican al recrear cada contenedor:

1. **`api`:** se recrea con el paso 8 del despliegue, porque el mismo cambio movió dependencias en `package.json`. Al recrearlo se elimina el log anterior, que llegó a pesar 3 GB.
2. **`db`:** su nuevo margen de apagado (60 s) y la rotación de logs se aplican al recrearla. El contenedor actual todavía tiene el margen de 3 s, así que antes hay que detenerla a mano con un margen amplio, en un momento sin tráfico: `sudo docker stop -t 60 wellproject-db-1 && sudo docker-compose up -d --no-deps db`. Mientras tanto la API responde error.

## Reintento diario a la DGA

La API reenvía una vez al día, a las 03:00 de `CRON_TIMEZONE`, los reportes de días anteriores que la DGA no aceptó, hasta 35 días hacia atrás. Envía una medición por pozo y hora, con 5 minutos entre cada envío, como pide el documento de transmisión de la DGA, y como máximo 250 por corrida. Primero van las mediciones de ayer y después las más antiguas. El detalle de qué reportes toma está en `src/jobs/dga-retry.js`. Reemplaza al SENDER.

Cada corrida deja estas líneas en el log de la API:

```sh
sudo docker logs api --since 24h 2>&1 | grep -aE '\[reintento-dga\]|reintento a la DGA'
```

La primera dice cuántas mediciones quedaron pendientes y la última resume cuántas aceptó la DGA, cuántas fallaron y cuántas se omitieron porque se enviaron o el pozo se desactivó mientras esperaban su turno. Cada falla aparece como `falló el reintento del reporte` con la obra, la fecha, la hora y el motivo, sin credenciales.

Como el job vive dentro del proceso de la API, un reinicio a mitad de una corrida la corta. No queda nada a medias: lo que falte se toma al día siguiente. Por eso conviene no desplegar entre las 03:00 y el fin de la corrida si hay muchos pendientes. La hora se cambia con `DGA_RETRY_CRON_SCHEDULE` en `API/.env`, seguida de un `restart -t 15 api`.

## Retirar el SENDER (una sola vez)

El SENDER era un servicio en Rails que reintentaba los envíos fallidos a la DGA llamando a `/fetchUnsentReports` y `/repostToDGA` con una clave interna. Su cron no corría desde marzo de 2025 y quedó reemplazado por el reintento diario de la API. El despliegue que lo elimina del repositorio requiere estos pasos en la instancia, **antes del merge** del paso 6 de "Desplegar la API":

1. Respaldar su carpeta completa, incluidos los archivos sin seguimiento y su `.env`, con permisos solo para el dueño, y comprobar que el respaldo se puede leer:

   ```sh
   cd ~/WellProject
   ( umask 077 && tar czf ~/sender-respaldo-$(date +%F).tgz SENDER ) && tar tzf ~/sender-respaldo-$(date +%F).tgz | wc -l
   ```

2. Detener y eliminar el contenedor. Tiene `restart: unless-stopped`, así que sin el `rm` volvería a levantarse con el siguiente reinicio del sistema:

   ```sh
   sudo docker stop sender && sudo docker rm sender
   ```

3. Descartar el cambio local de `SENDER/wellproject/config/schedule.rb`, que ya quedó en el respaldo. El despliegue borra ese archivo, y con el cambio local el merge aborta:

   ```sh
   git checkout -- SENDER/wellproject/config/schedule.rb
   ```

4. Seguir con el merge y el resto del despliegue. Después del merge, la carpeta `SENDER` queda solo con archivos sin seguimiento (`bundle/`, `log/`, `.env` y otros). Comprobado el respaldo del paso 1, se borra:

   ```sh
   git status --short SENDER | grep -v '^??' && echo "hay archivos versionados: revisar antes de borrar" || rm -rf ~/WellProject/SENDER
   ```

5. Quitar `INTERNAL_API_KEY` de `~/WellProject/API/.env`, que ya no la usa nadie. El archivo es de `root`, así que se edita con `sudo`, dejando un respaldo:

   ```sh
   sudo sed -i.bak-sender '/^[[:space:]]*INTERNAL_API_KEY[[:space:]]*=/d' ~/WellProject/API/.env
   ls -la ~/WellProject/API/.env    # debe seguir siendo de root
   ```

   El cambio se aplica con el `restart -t 15 api` del despliegue.

6. Opcionalmente, liberar los cerca de 840 MB de la imagen: `sudo docker rmi wellproject-sender`.

7. Verificar que el contenedor ya no existe y que las rutas del SENDER responden 404:

   ```sh
   sudo docker ps -a --format '{{.Names}}' | grep -c sender    # debe imprimir 0
   curl -s -o /dev/null -w "%{http_code}\n" https://promedicionbackend.com/fetchUnsentReports    # 404
   ```

Si hiciera falta volver atrás, el código está en el historial de git y la configuración local en el respaldo del paso 1.

## Alertas de monitoreo

La API ejecuta un job interno una vez al día, a las 08:00 de `CRON_TIMEZONE`, que revisa qué pozos activos llevan más de 6 horas sin reportar y qué mediciones no llegaron a la DGA. Envía el correo si algún pozo pasó a ese estado desde el chequeo anterior o si alguna medición de ayer sigue sin aceptarse (ver más abajo). Los pozos que ya estaban caídos, por ejemplo por una falla de hardware conocida, aparecen al final del correo como recordatorio, pero no lo disparan por sí solos.

La hora se configura con `ALERT_CRON_SCHEDULE` en `API/.env` (por defecto, `0 8 * * *`). La lógica de "pasó a rojo en las últimas 24 horas" asume un chequeo diario: con una programación más frecuente, cada pozo se repetiría en 3 o 4 correos, y la API lo advierte en el log al arrancar. Hasta noviembre de 2026, producción tenía `0 0,8,16 * * *` en `API/.env`; ese valor manda sobre el del código, así que hay que cambiarlo a `0 8 * * *`, o quitar la línea, y reiniciar la API.

La alerta tiene que correr después del reintento de las 03:00 (`DGA_RETRY_CRON_SCHEDULE`). Si se programa antes, informa como pendientes mediciones que el reintento todavía no tomó; y si corre antes de las 02:00, las fallas de las últimas 2 horas del día anterior quedan fuera de la cuenta de "ayer".

Hay dos limitaciones propias de un chequeo diario sin estado. Una caída que empieza y termina entre dos chequeos no se avisa, porque el chequeo solo ve el estado del momento. Y si la API está detenida o reiniciándose justo a las 08:00, ese día no hay chequeo: los pozos que cayeron en esas 24 horas no se avisan, y las mediciones de ayer que no llegaron a la DGA tampoco disparan el correo, aunque siguen apareciendo como recordatorio en los correos siguientes. Conviene evitar desplegar cerca de esa hora. Para ver todos los pozos caídos en cualquier momento, un admin puede llamar a `POST /monitoring/send-alert-email`, que envía la lista completa.

El mismo correo avisa de las mediciones que no llegaron a la DGA (#70). Si alguna medición de ayer sigue sin aceptarse a las 08:00, el correo sale aunque ningún pozo esté en rojo, con una tabla por pozo: horas de ayer sin aceptar, total pendiente dentro de la ventana de 35 días y la medición pendiente más antigua. Las pendientes de días anteriores aparecen como recordatorio, pero no disparan el correo por sí solas. Una falla persistente, como las credenciales vencidas de un pozo, sí genera un correo cada día, porque cada día suma mediciones nuevas sin aceptar.

La sección también dice qué pasó con el reintento de ese día: si terminó (con cuántas aceptadas, fallidas y omitidas, y si llegó al máximo de 250 envíos), si sigue en curso o si no hay registro, porque no corrió o la API se reinició después. El reintento envía primero las mediciones de ayer y después las más antiguas, así que con hasta unas 60 mediciones de ayer alcanza a probarlas todas antes de las 08:00. Si la consulta de entrega falla, el correo de pozos en rojo sale igual, con un aviso de que no se pudo revisar la entrega. El envío manual de `POST /monitoring/send-alert-email` no revisa la entrega. Para ver el motivo de cada rechazo, hay que buscar las líneas `[reintento-dga]` del log, como se explica en la sección del reintento.

Como el job vive dentro del proceso de la API, si la API se cae las alertas también dejan de llegar.

## Problemas conocidos

Los siguientes puntos están registrados como issues o pendientes y explican comportamientos que se pueden observar en la instancia:

- La rotación de logs (5 archivos de 20 MB por contenedor) solo aplica a los contenedores recreados después de noviembre de 2026. Conviene revisar el tamaño con `sudo du -sh /var/lib/docker/containers`.
- Sequelize ya no imprime cada consulta SQL. Para diagnosticar se puede activar con `DB_LOGGING=true` en `API/.env` y reiniciar la API.
- Producción corre con `NODE_ENV=development`, y `config/config.js` solo define `development` y `test`. Cambiar `NODE_ENV` a `production` sin agregar antes esa configuración deja a la API sin conexión a la base.
- `docker-compose up -d --build -V` deja un volumen anónimo huérfano en cada ejecución. Se pueden listar con `sudo docker volume ls -f dangling=true`. No se debe usar `docker volume prune` si el contenedor de la base no existe, por ejemplo después de un `down`, porque en ese momento ningún contenedor referencia su volumen y según la versión de Docker podría borrarse junto con los datos.
