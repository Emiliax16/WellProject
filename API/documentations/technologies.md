# Tecnologías Utilizadas en el Proyecto

## Backend

### Express.js
- **Descripción**: Express.js es un framework web minimalista y flexible para Node.js, diseñado para construir aplicaciones web y APIs. Es conocido por su rendimiento y su enfoque en la eficiencia y la simplicidad.
- **Uso en el proyecto**: Utilizamos Express.js para manejar todas las solicitudes HTTP entrantes, enrutarlas a los controladores apropiados, y generar respuestas HTTP que se envían de vuelta al cliente.

### Sequelize
- **Descripción**: Sequelize es un ORM (Object-Relational Mapper) para Node.js. Permite representar las tablas de bases de datos como objetos dentro del código, facilitando la interacción con la base de datos a través de métodos de alto nivel.
- **Uso en el proyecto**: Implementamos Sequelize para gestionar todas las operaciones de base de datos dentro de nuestra aplicación Express, facilitando la manipulación de datos y asegurando la integridad de la información en nuestra base de datos PostgreSQL.

### PostgreSQL
- **Descripción**: PostgreSQL es un sistema de gestión de bases de datos relacional orientado a objetos y open source, conocido por su robustez y su cumplimiento con los estándares SQL.
- **Uso en el proyecto**: Elegimos PostgreSQL como nuestra base de datos debido a su escalabilidad, su fiabilidad y su amplio soporte para funciones complejas de consultas, que son esenciales para manejar los datos de los pozos y su análisis.

## Frontend

### React
- **Descripción**: React es una biblioteca de JavaScript desarrollada por Facebook para construir interfaces de usuario. Es conocida por su eficiencia y flexibilidad, utilizando un enfoque basado en componentes.
- **Uso en el proyecto**: Aunque aún no está implementado, planeamos utilizar React para desarrollar la interfaz de usuario del frontend. React nos permitirá manejar eficientemente el estado de la aplicación y reaccionar a los cambios de datos en tiempo real.

## Docker y Docker Compose
- **Descripción**: Docker es una plataforma de contenedores que permite empaquetar una aplicación y sus dependencias en un contenedor virtual que puede correr en cualquier sistema Linux. Docker Compose es una herramienta para definir y gestionar aplicaciones multi-contenedor.
- **Uso en el proyecto**: Utilizamos Docker para encapsular nuestro entorno de desarrollo y producción, asegurando que nuestra aplicación funcione de manera uniforme en cualquier entorno. Docker Compose nos permite configurar y vincular varios contenedores (como nuestra aplicación y la base de datos) de manera sencilla.

## Nginx
- **Descripción**: Nginx es un servidor web y un proxy inverso de alto rendimiento, además de un servidor de correo electrónico IMAP/POP3. Es conocido por su estabilidad, rico conjunto de características, configuración simple y bajo consumo de recursos.
- **Uso en el proyecto**: En nuestro proyecto, Nginx actúa como un proxy inverso que dirige las solicitudes web a nuestro servidor Express, mejorando el rendimiento y la seguridad de la aplicación.
