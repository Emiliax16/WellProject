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
Descripción: Servicio encargado de enviar los reportes no enviados a la DGA. Este servicio se ejecuta de manera programada (cron job) para asegurarse de que los reportes se envíen automáticamente en el formato correcto y en los intervalos de tiempo definidos.
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