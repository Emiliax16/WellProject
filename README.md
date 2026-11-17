# Proyecto de Administración de Pozos y Reportes para la DGA
Este proyecto está diseñado para administrar la información de pozos de agua, permitiendo la generación y envío de reportes a la Dirección General de Aguas (DGA) de Chile en el formato requerido. El proyecto es una API en Node.js que también reintenta cada día los envíos fallidos a la DGA.

## Servicios del Proyecto
1. API (Backend en `Express.js`)
Descripción: Servicio principal que maneja la lógica de negocio de la aplicación. Administra los pozos, usuarios y los reportes generados para cada pozo.
Tecnologías utilizadas:
* Node.js
* Express.js
* PostgreSQL (Base de datos)
* Docker (Para la configuración del entorno)

Hasta noviembre de 2026 existía además el SENDER, un servicio en Ruby on Rails que reintentaba los envíos a la DGA. Se eliminó al pasar ese reintento a la API (`API/src/jobs/dga-retry.js`); su código queda en el historial de git.

## Requisitos
1. Docker y Docker Compose (para levantar la API y la base de datos)
2. Javascript y Express (para el desarrollo de la API)

La documentación completa de la API está en [API](API/README.md).

## Producción

La API y la base de datos corren en una instancia EC2 que se actualiza a mano. Cómo revisarla, desplegar, volver atrás y consultar la base sin riesgo está documentado en [Operación de la instancia de producción](API/documentations/amazon-instance.md).