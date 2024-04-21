# Estructura del Repositorio

El proyecto está estructurado para facilitar el desarrollo, la configuración y las pruebas de la API que gestiona datos de pozos.

## Directorios Principales

### `/API`
Contiene todos los archivos necesarios para configurar y ejecutar la API, incluyendo Dockerfiles y documentación específica del proyecto.

- **`Dockerfile`** y **`docker-compose.yml`**: Configuración para Docker.
- **`config/`**: Contiene configuraciones para la base de datos y otras configuraciones necesarias.
- **`documentations/`**: Guías y convenciones para el desarrollo del proyecto.
- **`img/`**: Almacena imágenes usadas en la documentación.
- **`migrations/`**: Scripts de migraciones para la base de datos.
- **`models/`**: Define los modelos de Sequelize utilizados en la API.
- **`seeders/`**: Scripts para poblar la base de datos con datos de demostración.
- **`src/`**: Código fuente de la API.
  - **`app.js`**: Archivo principal de la aplicación Express.
  - **`controllers/`**: Controladores para manejar las solicitudes entrantes.
  - **`middlewares/`**: Middleware de Express para manejar peticiones.
  - **`routes/`**: Rutas de la API que mapean los endpoints a los controladores.
  - **`server.js`**: Configuración del servidor.
  - **`tests/`**: Pruebas unitarias y de integración.
  - **`utils/`**: Utilidades y funciones de ayuda.

### `/README.md`
Documento principal que define la razón del proyecto y proporciona un índice con toda la documentación necesaria.

## Documentación Adicional

Dentro del directorio `/API/documentations/`, encontrarás documentos detallados sobre procesos de desarrollo, convenciones de código, y más:

- **`technologies.md`**: Explicación de las tecnologías utilizadas en el proyecto.
- **`dev-process.md`**: Proceso de desarrollo.
- **`files-order.md`**: Organización de archivos dentro del proyecto.
- **`git-conventions.md`**: Convenciones para el uso de Git.
- **`model.md`**: Descripción de los modelos de datos.
- **`review-pr-process.md`**: Proceso para revisar y aprobar pull requests.
- **`setup.md`**: Guía de configuración inicial del proyecto.

## Imágenes

Las imágenes, como diagramas de la base de datos, se almacenan en `/API/img/` para referencia visual dentro de la documentación.
