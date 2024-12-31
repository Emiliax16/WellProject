# Documentación para la instancia de Amazon

## Cómo ingresar a la instancia de Amazon

1. Ubica tu archivo .pem: Asegúrate de tener el archivo .pem necesario para acceder a la instancia.
2. Conéctate a la instancia con SSH:
```ssh -i tu_archivo.pem usuario@IP_PUBLICA```
Ejemplo: `ssh -i wellproject.pem ubuntu@52.12.34.56`
3. Navega por la instancia:
Usa comandos básicos como:
```sh
ls        # Lista archivos y carpetas
cd <ruta> # Cambia de directorio
pwd       # Muestra el directorio actual
```
4. Ir al proyecto con ``cd WellProject`

## Cómo ingresar a la base de datos del proyecto

1. Conéctate a PostgreSQL: Si PostgreSQL está instalado y corriendo como contenedor, utiliza Docker:
```sudo docker exec -it wellproject-db-1 sh```
2. Entrar a la base de datos:
```psql -U postgres -d db-well```
3. Comandos básicos en PostgreSQL:
```sql
\dt -- Ver tablas en la base de datos
SELECT * FROM "wellData"; -- Seleccionar datos de una tabla
DELETE FROM "wellData" WHERE id = 29; -- Eliminar datos de una tabla
\q -- Salir de PostgreSQL
```

# Documentación sobre Docker

## Monitorear contenedores

1. Ver contenedores en ejecución:
``` sudo docker ps ```
2. Ver todos los contenedores (incluidos detenidos):
``` sudo docker ps -a ```
3. Ver logs de un contenedor:
``` sudo docker logs <nombre_del_contenedor> ```

## Comandos básicos para manejar contenedores

1. Apagar un servicio específico:
``` sudo docker-compose stop <nombre_del_servicio> ```
2. Apagar todos los servicios:
``` sudo docker-compose down ```
3. Encender todos los servicios:
``` sudo docker-compose up -d ```
4. Reiniciar un servicio específico:
``` sudo docker-compose restart <nombre_del_servicio> ```
5. Reconstruir imágenes sin detener servicios:
``` sudo docker-compose build <nombre_del_servicio> ```
6. Reconstruir con no-cache:
``` sudo docker-compose build --no-cache <nombre_del_servicio> ```

## Flujos típicos de actualización y mantenimiento

### Actualizar el proyecto (Git):

1. Navega al directorio del proyecto:
``` cd WellProject ```
2. Realiza un pull de los cambios más recientes:
``` git pull origin main ```
3. Reiniciar todos los servicios:
```sh
sudo docker-compose down
sudo docker-compose up -d
```

### Reconstruir imágenes cuando hay cambios significativos:

1. Sin usar caché:
``` sudo docker-compose build --no-cache ```
2. Con caché (más rápido):
``` sudo docker-compose build ```

### Monitorear servicios y resolver problemas:

1. Verifica si algún servicio está caído:
``` sudo docker ps ```
2. Revisa los logs del servicio problemático:
``` sudo docker logs <nombre_del_contenedor> ```

## Contenedores en el proyecto
1. API
Nombre del contenedor: api
Función: Contiene la lógica de la API del repositorio (Express.js).
Puertos expuestos: 3000
2. Base de datos (PostgreSQL)
Nombre del contenedor: wellproject-db-1
Función: Base de datos del proyecto.
Puertos expuestos: 5432
3. EMQX (Broker MQTT)
Nombre del contenedor: emqx
Función: Parte de la implementación externa para manejar mensajes MQTT.
Puertos expuestos:
1883 (MQTT)
18083 (Panel de administración)
4. Node-RED
Nombre del contenedor: mynodered
Función: Proporciona flujos personalizados para interactuar con MQTT y otros servicios externos.
Puertos expuestos: 1880

