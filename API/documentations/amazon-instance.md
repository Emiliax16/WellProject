# Operación de la instancia de producción

Esta guía describe cómo está montada la instancia EC2 que corre la API, la base de datos y el SENDER, y cómo revisarla y actualizarla sin interrumpir la recepción de reportes. La instancia no se actualiza sola: cada cambio mergeado en `master` llega a producción solo cuando alguien lo despliega a mano siguiendo estos pasos.

Los valores sensibles (IP, ruta de la llave, contraseñas, correos) no se escriben en este repositorio, que es público. Donde aparecen `<IP_PUBLICA>` o `<ruta-a-la-llave.pem>`, se deben reemplazar por los valores que tiene la persona responsable del proyecto.

## Cómo está montada

La instancia tiene menos de 1 GB de RAM y un swap de 2 GB, así que cualquier consulta o proceso que cargue muchos datos en memoria puede dejarla sin responder, como ocurrió el 10 de agosto de 2026. Sobre ella corren los siguientes componentes:

| Componente | Dónde | Notas |
|---|---|---|
| Nginx | Host, puertos 80 y 443 | Termina TLS con certificados de Certbot y reenvía `promedicionbackend.com` a `localhost:3000` |
| `api` | Contenedor Docker | Express con nodemon. El código se monta desde `~/WellProject/API` como volumen |
| `wellproject-db-1` | Contenedor Docker | PostgreSQL 14, base `db-well`, volumen persistente |
| `sender` | Contenedor Docker | Rails. Su cron no arranca solo (ver más abajo) |

El `docker-compose.yml` publica los puertos 3000 y 5432 en todas las interfaces del host, y Docker se salta el firewall del sistema operativo. Por eso el security group de AWS es la única barrera que los separa de internet: debe aceptar solo 22, 80 y 443, y nunca abrir 3000 ni 5432.

El frontend no vive en esta instancia. Se sirve desde S3 y CloudFront, y su despliegue está documentado en el repositorio `WellProjectFront`, en `documentations/deployment.md`.

### Variables de entorno

Hay dos archivos de entorno en la instancia, ninguno versionado:

1. `~/WellProject/.env`, que docker-compose inyecta en el contenedor `api`. Contiene la conexión a la base.
2. `~/WellProject/API/.env`, que la API lee con `dotenv` al arrancar. Contiene, entre otras, `JWT_SECRET`, las credenciales de correo y la programación de las alertas (`ALERT_CRON_SCHEDULE`, `CRON_TIMEZONE`).

Un cambio en cualquiera de los dos solo se aplica cuando la API se reinicia, porque nodemon no observa esos archivos. Para revisar qué variables existen sin mostrar sus valores, se puede usar:

```sh
sed -E 's/[[:space:]]*=.*//' ~/WellProject/API/.env
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

La segunda muestra el estado de los contenedores y desde cuándo corren:

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
  wellproject-db-1 psql -U postgres -d db-well
```

La tabla `"wellData"` crece con cada reporte. Las consultas sobre ella deben ir filtradas por fecha (`WHERE "createdAt" > now() - interval '7 days'`) y nunca hacer `SELECT *` sin límite. Algunas consultas útiles son las siguientes:

```sql
-- Migraciones aplicadas
SELECT count(*), max(name) FROM "SequelizeMeta";

-- Último reporte y último envío aceptado por pozo
SELECT w.code, w.name, w."isActived",
  (SELECT max("createdAt") FROM "wellData" d WHERE d.code = w.code) AS ultimo_reporte,
  (SELECT max("createdAt") FROM "wellData" d WHERE d.code = w.code AND sent) AS ultimo_envio
FROM wells w ORDER BY 1;

-- Recibidos y enviados por día
SELECT "createdAt"::date AS dia, count(*) AS recibidos, count(*) FILTER (WHERE sent) AS enviados
FROM "wellData" WHERE "createdAt" > now() - interval '10 days' GROUP BY 1 ORDER BY 1;
```

Al leer el último resultado hay que considerar que los pozos envían dos reportes por hora y la DGA rechaza el segundo con el mensaje "Ya existe un registro en esa fecha, hora para la obra". Ese reporte queda con `sent = false`, aunque la hora sí quedó registrada en la DGA. Por lo tanto, que cerca de la mitad de los reportes figure como no enviada es esperable y no indica una pérdida.

## Desplegar la API

Como el código de la API se monta como volumen y corre con nodemon, actualizar los archivos en disco ya es un despliegue: nodemon detecta el cambio y reinicia el proceso en pocos segundos. Durante ese reinicio la API no responde, así que conviene hacerlo lejos de los minutos en que los pozos reportan (hoy, cerca de :28 y :58 de cada hora).

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

3. Comprobar que ningún archivo nuevo choque con uno no versionado que ya exista en la instancia. Si el comando imprime algo, ese archivo se mueve a un respaldo fuera del repositorio antes de seguir:

   ```sh
   git diff --name-only --diff-filter=A HEAD FETCH_HEAD | while read f; do [ -e "$f" ] && echo "choca: $f"; done
   ```

4. Revisar si el cambio trae migraciones nuevas (`git diff --stat HEAD FETCH_HEAD -- API/migrations`) o cambios en `API/package.json`. Si los trae, seguir también las secciones correspondientes más abajo.

5. Aplicar el cambio. `--ff-only` evita que Git cree un merge si la instancia divergió de `master`:

   ```sh
   git merge --ff-only FETCH_HEAD
   ```

6. Verificar que la API reinició y que vuelve a recibir reportes:

   ```sh
   sudo docker logs api --since 2m 2>&1 | grep -aE 'Escuchando|scheduler|Error|crashed'
   ```

   Luego, esperar al siguiente reporte de un pozo y confirmar que aparece una línea `[dga] respuesta`.

7. Registrar el commit nuevo con `echo "despues=$(git rev-parse HEAD)" >> ~/deploys.log`.

Para volver atrás, basta con mover el repositorio al commit anotado en `~/deploys.log`. `--keep` conserva los cambios locales que no forman parte del despliegue:

```sh
git reset --keep <commit-anterior>
```

### Cuando cambian las dependencias

Los `node_modules` viven en un volumen del contenedor, separado del código. Si un despliegue cambia `API/package.json`, hay que reconstruir la imagen y recrear ese volumen con `-V`; de lo contrario el contenedor sigue usando las dependencias antiguas:

```sh
sudo docker-compose up -d --build -V --no-deps api
```

### Cuando hay migraciones

Antes de cualquier migración se respalda la base, porque es el único paso de un despliegue que modifica datos:

```sh
sudo docker exec wellproject-db-1 pg_dump -U postgres -d db-well -Fc > ~/respaldo-$(date +%F).dump
sudo docker exec api npx sequelize-cli db:migrate:status
sudo docker exec api npx sequelize-cli db:migrate
```

### Reiniciar sin bajar la base

Para aplicar un cambio en `API/.env` o reiniciar la API por otro motivo, se reinicia solo ese servicio:

```sh
sudo docker-compose restart api
```

No se debe usar `docker-compose down` para esto. Ese comando detiene también Postgres, y el `stop_grace_period` de 3 segundos definido en el compose puede forzar su cierre antes de que termine de escribir.

## SENDER y su cron

El SENDER reintenta cada día, a las 6:00, los reportes que quedaron sin enviar. Su crontab se instala dentro del contenedor, pero el servicio `cron` no forma parte del proceso principal de la imagen: se inicia a mano y se pierde cada vez que el contenedor se reinicia o se recrea. Para comprobar si está corriendo:

```sh
sudo docker exec sender sh -c 'crontab -l; ls /proc | grep -E "^[0-9]+$" | while read p; do cat /proc/$p/comm 2>/dev/null; done | grep -c cron'
```

Si el segundo valor es `0`, el cron no está activo. Los pasos para iniciarlo están en `SENDER/README.md`. En noviembre de 2026 el cron llevaba detenido desde el reinicio del 11 de agosto, y su último registro en `log/cron_rake.log` era de marzo de 2025. Antes de reactivarlo hay que revisar cómo trata los rechazos "Ya existe un registro", porque hoy aborta el lote ante el primer error.

## Alertas de monitoreo

La API ejecuta un job interno que revisa qué pozos activos llevan más de 6 horas sin reportar y envía un correo con la lista. La frecuencia se configura con `ALERT_CRON_SCHEDULE` y `CRON_TIMEZONE` en `API/.env`. Como el job vive dentro del proceso de la API, si la API se cae las alertas también dejan de llegar.

## Problemas conocidos

Los siguientes puntos están registrados como issues o pendientes y explican comportamientos que se pueden observar en la instancia:

- nodemon no reinicia el proceso si este muere por un error, y el contenedor sigue figurando como `Up` (issue #71).
- Los logs de Docker no tienen rotación. El log del contenedor `api` superaba los 3 GB en noviembre de 2026.
- Hay bots que recorren rutas como `/.env` o `/credentials` miles de veces por semana. La API no sirve archivos estáticos, así que responden 404, pero esas líneas aparecen en los logs.
