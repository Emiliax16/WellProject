# Operación de la instancia de producción

Esta guía describe cómo está montada la instancia EC2 que corre la API, la base de datos y el SENDER, y cómo revisarla y actualizarla sin interrumpir la recepción de reportes. La instancia no se actualiza sola: cada cambio mergeado en `master` llega a producción solo cuando alguien lo despliega a mano siguiendo estos pasos.

Los valores sensibles (IP, ruta de la llave, contraseñas, correos) no se escriben en este repositorio, que es público. Donde aparecen `<IP_PUBLICA>`, `<ruta-a-la-llave.pem>` o `<DB_USERNAME>`, se deben reemplazar por los valores que tiene la persona responsable del proyecto.

## Cómo está montada

La instancia tiene menos de 1 GB de RAM y un swap de 2 GB, así que cualquier consulta o proceso que cargue muchos datos en memoria puede dejarla sin responder. Sobre ella corren los siguientes componentes:

| Componente | Dónde | Notas |
|---|---|---|
| Nginx | Host, puertos 80 y 443 | Termina TLS con certificados de Certbot y reenvía `promedicionbackend.com` a `localhost:3000` |
| `api` | Contenedor Docker | Express con nodemon. El código se monta desde `~/WellProject/API` como volumen |
| `wellproject-db-1` | Contenedor Docker | PostgreSQL 14, base `db-well`, volumen persistente |
| `sender` | Contenedor Docker | Rails. Su cron depende de pasos manuales (ver más abajo) |

El `docker-compose.yml` publica los puertos 3000 y 5432 en todas las interfaces del host, y Docker se salta las reglas de firewall del sistema operativo (ufw). Por eso el security group de AWS es la única barrera de red que los separa de internet: debe aceptar solo 22, 80 y 443, y nunca abrir 3000 ni 5432.

El frontend no vive en esta instancia. Se sirve desde S3 y CloudFront, y su despliegue está documentado en el repositorio `WellProjectFront`, en `documentations/deployment.md`.

### Variables de entorno

Hay dos archivos de entorno en la instancia, ninguno versionado:

1. `~/WellProject/.env`, que docker-compose inyecta en el contenedor `api` al crearlo. Contiene la conexión a la base.
2. `~/WellProject/API/.env`, que la API lee con `dotenv` al arrancar. Contiene, entre otras, `JWT_SECRET`, las credenciales de correo y la programación de las alertas (`ALERT_CRON_SCHEDULE`, `CRON_TIMEZONE`).

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

`git status` debe mostrar un único cambio local esperado, en `SENDER/wellproject/config/schedule.rb`, que se explica en la sección del SENDER. Cualquier otro cambio en un archivo versionado hay que entenderlo antes de desplegar.

La segunda revisión muestra el estado de los contenedores y desde cuándo corren:

```sh
sudo docker ps --format '{{.Names}}  {{.Status}}  {{.Ports}}'
```

Que el commit en disco sea el correcto no garantiza que el proceso lo haya cargado. Para comprobarlo, se compara la hora de inicio del proceso de Node con la del último despliegue:

```sh
sudo docker exec api sh -c 'ps -o pid,etime,args | grep "node src/server.js" | grep -v grep'
```

Los logs de la API incluyen cada consulta SQL y el cuerpo de cada reporte recibido, así que conviene filtrarlos. Este comando muestra las respuestas de la DGA y los errores de la última hora:

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

Al leer el último resultado hay que considerar que los pozos pueden enviar más de un reporte por hora y la DGA rechaza los siguientes con el mensaje "Ya existe un registro en esa fecha, hora para la obra". Ese reporte queda con `sent = false`, aunque la hora sí quedó registrada en la DGA. Por lo tanto, una proporción alta de reportes no enviados no indica por sí sola una pérdida; hay que revisar los rechazos en los logs.

## Desplegar la API

Como el código de la API se monta como volumen y corre con nodemon, actualizar los archivos en disco ya es un despliegue: nodemon detecta el cambio y reinicia el proceso en pocos segundos. Durante ese reinicio la API no responde, y un reporte que llegue en ese momento puede perderse, si el dispositivo no reintenta, o quedar a medio enviar. Antes de desplegar, conviene revisar en los logs en qué minutos reportan los pozos y elegir un momento lejano a ellos. Lo mismo vale para cualquier `restart` o `up` del contenedor `api`.

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

3. Comprobar que nada vaya a chocar con el estado local de la instancia. Hay dos casos posibles:

   - **Un archivo nuevo que ya existe sin versionar.** Este comando los lista; si imprime algo, ese archivo se mueve a un respaldo fuera del repositorio antes de seguir:

     ```sh
     git diff --name-only --diff-filter=A HEAD FETCH_HEAD | while read f; do [ -e "$f" ] && echo "choca: $f"; done
     ```

   - **Un cambio que toca `SENDER/wellproject/config/schedule.rb`.** Si `git diff --stat HEAD FETCH_HEAD` lo incluye, el merge del paso 6 va a abortar por el cambio local de ese archivo. No se debe resolver con `git checkout` ni descartando el cambio, porque es lo único que mantiene programado el cron del SENDER. Lo correcto es guardarlo antes del paso 6:

     ```sh
     cp SENDER/wellproject/config/schedule.rb ~/schedule.rb.local-$(date +%F)
     git stash push -- SENDER/wellproject/config/schedule.rb
     ```

     Y reponerlo después del paso 6, comprobando que el job siga descomentado:

     ```sh
     git stash pop
     git diff SENDER/wellproject/config/schedule.rb
     ```

     Si `git stash pop` informa un conflicto, el archivo queda con marcadores y el stash se conserva. En ese caso hay que copiar de vuelta el respaldo de `~/schedule.rb.local-<fecha>`, revisar que conviva con lo que trajo el despliegue y, cuando el archivo esté correcto, descartar el stash con `git stash drop`.

4. Revisar si el cambio trae migraciones nuevas o cambios de dependencias:

   ```sh
   git diff --stat HEAD FETCH_HEAD -- API/migrations API/package.json API/package-lock.json
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

8. **Solo si cambiaron `package.json` o `package-lock.json`:** reconstruir la imagen y recrear el volumen de `node_modules` con `-V`. De lo contrario, el contenedor sigue usando las dependencias antiguas. Hay que tener en cuenta que el merge del paso 6 ya reinició la API con el código nuevo, así que si este requiere un paquete nuevo, la API queda caída hasta que termina este comando:

   ```sh
   sudo docker-compose up -d --build -V --no-deps api
   ```

9. Verificar que la API reinició y que vuelve a recibir reportes:

   ```sh
   sudo docker logs api --since 2m 2>&1 | grep -aE 'Escuchando|scheduler|Error|crashed'
   ```

   Luego, esperar al siguiente reporte de un pozo y confirmar que aparece una línea `[dga] respuesta`.

10. Registrar el commit nuevo con `echo "despues=$(git rev-parse HEAD)" >> ~/deploys.log`.

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
sudo docker-compose restart api
```

Para `~/WellProject/.env`, en cambio, `restart` no sirve: docker-compose lee ese archivo al crear el contenedor, así que hay que recrearlo:

```sh
sudo docker-compose up -d --no-deps api
```

En ningún caso se debe usar `docker-compose down` para esto. Ese comando detiene también Postgres, y el `stop_grace_period` de 3 segundos del compose puede forzar su cierre, lo que obliga a una recuperación al arrancar. Además elimina el contenedor `sender`, que el `up` siguiente crea de nuevo sin crontab ni demonio `cron`.

## SENDER y su cron

El SENDER reenvía una vez al día los reportes que quedaron sin enviar. Pide a la API una página de hasta 100 pendientes (`/fetchUnsentReports`) y los reenvía uno por uno (`/repostToDGA`), con 5 minutos de espera entre cada envío. Su funcionamiento depende de tres piezas, y ninguna se recupera sola:

1. **El job.** En el `schedule.rb` versionado, todos los bloques `every` están comentados. El job diario existe solo porque la instancia tiene un cambio local que descomenta el bloque de `rake sender:fetch_unsent_and_send`. Por eso ese cambio no se debe descartar.
2. **El crontab.** `whenever --update-crontab` lo instala dentro del contenedor a partir de ese archivo, y se pierde si el contenedor se recrea.
3. **El demonio `cron`.** No forma parte del proceso principal de la imagen, que solo levanta Puma. Se inicia a mano y se pierde cada vez que el contenedor se reinicia o se recrea.

La hora del job es la del contenedor, que no define zona horaria y usa UTC. Las "6:00" del `schedule.rb` corresponden a las 03:00 o 02:00 de Chile, según el horario vigente.

Para comprobar las tres piezas sin cambiar nada:

```sh
git -C ~/WellProject diff SENDER/wellproject/config/schedule.rb    # el job debe aparecer descomentado
sudo docker exec sender crontab -l                                  # debe listar sender:fetch_unsent_and_send
sudo docker exec sender sh -c 'ls /proc | grep -E "^[0-9]+$" | while read p; do cat /proc/$p/comm 2>/dev/null; done | grep -c cron'
ls -la ~/WellProject/SENDER/wellproject/log/ | grep cron            # fecha del último registro
```

El tercer comando imprime `0` si el demonio no está corriendo. Para iniciarlo en producción no hay que seguir los pasos de instalación de `SENDER/README.md`, que reconstruyen imágenes y levantan todo el stack. Basta con lo siguiente:

```sh
# Solo si el crontab no aparece (el contenedor se recreó):
sudo docker exec sender sh -c 'cd /rails && bundle exec whenever --update-crontab'
# Iniciar el demonio:
sudo docker exec -u root sender service cron start
```

Antes de reactivarlo hay que tener presente que la tarea se detiene ante el primer error de `/repostToDGA`, y que la API responde error cuando la DGA rechaza un reporte por duplicado. Con el estado actual de los datos, la primera ejecución probablemente aborte en el primer reporte. Está planificado reemplazar este servicio por un cron en la API.

## Alertas de monitoreo

La API ejecuta un job interno que revisa qué pozos activos llevan más de 6 horas sin reportar y envía un correo con la lista. La frecuencia se configura con `ALERT_CRON_SCHEDULE` y `CRON_TIMEZONE` en `API/.env`. Como el job vive dentro del proceso de la API, si la API se cae las alertas también dejan de llegar.

## Problemas conocidos

Los siguientes puntos están registrados como issues o pendientes y explican comportamientos que se pueden observar en la instancia:

- Si el proceso de Node muere por un error, nodemon no lo vuelve a levantar, y el contenedor sigue figurando como `Up` (issue #71).
- Los logs de Docker no tienen rotación y crecen sin límite. Conviene revisar su tamaño con `sudo du -sh /var/lib/docker/containers`.
- `docker-compose up -d --build -V` deja un volumen anónimo huérfano en cada ejecución. Se pueden listar con `sudo docker volume ls -f dangling=true`. No se debe usar `docker volume prune` si el contenedor de la base no existe, por ejemplo después de un `down`, porque en ese momento ningún contenedor referencia su volumen y según la versión de Docker podría borrarse junto con los datos.
