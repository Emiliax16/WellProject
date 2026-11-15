# Proyecto de Administración de Pozos y Reportes para la DGA
Este proyecto está diseñado para administrar la información de pozos de agua, permitiendo la generación y envío de reportes a la Dirección General de Aguas (DGA) de Chile en el formato requerido. El proyecto consta de dos servicios principales que se comunican y trabajan en conjunto.

## Servicios del Proyecto
1. API (Backend en `Express.js`)
Descripción: Servicio principal que maneja la lógica de negocio de la aplicación. Administra los pozos, usuarios y los reportes generados para cada pozo.
Tecnologías utilizadas:
* Node.js
* Express.js
* PostgreSQL (Base de datos)
* Docker (Para la configuración del entorno)
2. SENDER (Servicio de Envío en Ruby on Rails)
Descripción: Servicio encargado de reenviar a la DGA los reportes que no se enviaron al momento de recibirse. Se ejecuta mediante un cron job cuya programación, crontab y demonio dependen de pasos manuales en la instancia, como se explica en [SENDER](SENDER/README.md).
Tecnologías utilizadas:
* Ruby on Rails
* Whenever (para la programación de cron jobs)
* Docker (Para la configuración del entorno)
## Requisitos
1. Docker y Docker Compose (para levantar los servicios de manera simultánea)
2. Javascript y Express (para el desarrollo del servicio API)
3. Ruby y Rails (para el desarrollo del servicio SENDER)

Cada servicio consta de una documentación completa:
* [API](API/README.md)
* [SENDER](SENDER/README.md)

## Producción

La API, la base de datos y el SENDER corren en una instancia EC2 que se actualiza a mano. Cómo revisarla, desplegar, volver atrás y consultar la base sin riesgo está documentado en [Operación de la instancia de producción](API/documentations/amazon-instance.md).