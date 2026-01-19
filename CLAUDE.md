# CLAUDE.md - WellProject (Backend)

Esta documentación proporciona una guía completa para trabajar con el backend del sistema de gestión de pozos de agua chileno.

## Resumen del Proyecto

**WellProject** es un sistema backend que consta de dos servicios principales para la administración de pozos de agua en Chile y el envío automático de reportes a la DGA (Dirección General de Aguas):

1. **API** (Node.js/Express) - Servicio principal de lógica de negocio, CRUD y autenticación
2. **SENDER** (Ruby on Rails) - Servicio de envío programado (cron jobs) de reportes a la DGA

Este documento se enfoca principalmente en el **API** (el servicio SENDER tiene su propia documentación).

## Stack Tecnológico - API

### Core
- **Node.js** 21 (Alpine en Docker)
- **Express.js** 4.19.2 - Framework web
- **PostgreSQL** 14.11 - Base de datos
- **Sequelize** 6.37.3 - ORM

### Autenticación & Seguridad
- **jsonwebtoken** 9.0.2 - JWT para autenticación
- **bcryptjs** 2.4.3 - Hashing de contraseñas

### Utilidades
- **axios** 1.7.2 - Cliente HTTP (comunicación con DGA)
- **cors** 2.8.5 - CORS middleware
- **dotenv** 16.4.5 - Gestión de variables de entorno
- **xml2js** 0.6.2 - Parsing de XML (respuestas DGA)
- **nodemailer** 6.9.13 - Envío de emails

### DevDependencies
- **nodemon** 3.1.0 - Hot reload en desarrollo
- **jest** 29.7.0 - Testing framework
- **@faker-js/faker** 8.4.1 - Datos de prueba
- **pg** 8.11.5 - Cliente PostgreSQL
- **pg-hstore** 2.3.4 - Serialización de datos

## Estructura del Proyecto

```
WellProject/
├── API/                         # Servicio principal del API
│   ├── config/                  # Configuración
│   │   ├── config.js           # Configuración de base de datos Sequelize
│   │   └── index.js            # Exports de configuración
│   ├── documentations/         # Documentación técnica del proyecto
│   │   ├── amazon-instance.md  # Navegación y comandos AWS
│   │   ├── dev-process.md      # Proceso de desarrollo
│   │   ├── files-order.md      # Estructura de archivos
│   │   ├── git-conventions.md  # Convenciones de Git
│   │   ├── model.md            # Modelos de datos
│   │   ├── review-pr-process.md # Revisión de PRs
│   │   ├── sequelize-commands.md # Comandos de Sequelize
│   │   ├── setup.md            # Instrucciones de instalación
│   │   └── technologies.md     # Tecnologías utilizadas
│   ├── migrations/             # Migraciones de base de datos (30 archivos)
│   │   ├── 20240422175827-create-user.js
│   │   ├── 20240422180040-create-person.js
│   │   ├── 20240422180259-create-role.js
│   │   ├── 20240425032531-create-client.js
│   │   ├── 20240426034150-create-well.js
│   │   ├── 20240426140041-create-well-data.js
│   │   ├── 20240721190555-create-company.js
│   │   ├── 20250513012834-create-distributor.js
│   │   └── ... (otras migraciones)
│   ├── models/                 # Modelos Sequelize
│   │   ├── index.js           # Inicialización de modelos y asociaciones
│   │   ├── user.js            # Usuario (autenticación base)
│   │   ├── role.js            # Roles (admin, company, distributor, normal)
│   │   ├── person.js          # Información personal del usuario
│   │   ├── client.js          # Cliente (usuario normal con pozos)
│   │   ├── company.js         # Empresa (gestiona clientes)
│   │   ├── distributor.js     # Distribuidora (gestiona empresas)
│   │   ├── well.js            # Pozo de agua
│   │   ├── welldata.js        # Datos de telemetría del pozo
│   │   └── convention.md      # Convenciones de modelos
│   ├── seeders/               # Seeds de base de datos
│   ├── src/                   # Código fuente
│   │   ├── controllers/       # Controladores (lógica de request/response)
│   │   │   ├── user.controller.js       # Auth, registro, roles
│   │   │   ├── client.controller.js     # CRUD de clientes
│   │   │   ├── company.controller.js    # CRUD de empresas
│   │   │   ├── distributor.controller.js # CRUD de distribuidoras
│   │   │   ├── well.controller.js       # CRUD y activación de pozos
│   │   │   ├── wellData.controller.js   # Reportes y envío a DGA
│   │   │   └── placeholder.controller.js # Controller de ejemplo
│   │   ├── middlewares/       # Middleware de Express
│   │   │   ├── auth.middleware.js       # Verificación JWT y roles
│   │   │   ├── error.middleware.js      # Manejo de errores global
│   │   │   ├── validate-params.middleware.js # Validación de parámetros
│   │   │   ├── check-troll.middleware.js # Prevención de spam
│   │   │   └── placeholder.middleware.js # Request logger
│   │   ├── routes/            # Definición de rutas
│   │   │   ├── user.route.js            # Rutas de usuario/auth
│   │   │   ├── client.route.js          # Rutas de clientes
│   │   │   ├── company.route.js         # Rutas de empresas
│   │   │   ├── distributor.route.js     # Rutas de distribuidoras
│   │   │   ├── well.route.js            # Rutas de pozos
│   │   │   ├── wellData.route.js        # Rutas de reportes
│   │   │   ├── contact.route.js         # Formulario de contacto
│   │   │   └── placeholder.route.js     # Ruta de ejemplo
│   │   ├── services/          # Lógica de negocio
│   │   │   └── wellData/
│   │   │       └── handleSendData.service.js # Envío de datos a DGA
│   │   ├── utils/             # Funciones de utilidad
│   │   │   ├── auth.util.js            # JWT y hashing
│   │   │   ├── error.util.js           # Manejo de errores
│   │   │   ├── errorcodes.util.js      # Códigos de error
│   │   │   ├── allowed-roles.util.js   # Definiciones de roles permitidos
│   │   │   ├── check-permissions.js    # Verificación de permisos
│   │   │   ├── convention.util.js      # Convenciones
│   │   │   ├── query-params.util.js    # Procesamiento de query params
│   │   │   ├── month-year-params.util.js # Validación fecha
│   │   │   └── params/                 # Validaciones de parámetros
│   │   │       ├── user/user.params.js
│   │   │       └── client/client.params.js
│   │   ├── app.js             # Configuración de Express
│   │   └── server.js          # Punto de entrada del servidor
│   ├── tests/                 # Tests (Jest)
│   ├── .dockerignore
│   ├── .env                   # Variables de entorno (NO commitear)
│   ├── .env.example           # Plantilla de variables de entorno
│   ├── .gitignore
│   ├── .sequelizerc           # Configuración de Sequelize CLI
│   ├── development.Dockerfile # Dockerfile para desarrollo
│   ├── package.json           # Dependencias y scripts
│   └── README.md              # Documentación del API
├── SENDER/                    # Servicio de envío a DGA (Ruby on Rails)
│   └── wellproject/           # (Ver documentación de SENDER)
├── docker-compose.yml         # Orquestación de servicios
├── .env.sample               # Variables de entorno globales
├── .gitignore
└── README.md                  # Documentación general del proyecto
```

## Arquitectura

### Patrón MVC (Model-View-Controller)

**Models** (`models/`):
- Definición de esquemas de base de datos
- Asociaciones entre modelos
- Métodos de instancia personalizados
- Validaciones a nivel de modelo

**Controllers** (`src/controllers/`):
- Manejo de requests HTTP
- Orquestación de servicios
- Formateo de responses
- Manejo de errores (delegado a middleware)

**Routes** (`src/routes/`):
- Definición de endpoints
- Aplicación de middlewares (auth, validación)
- Mapeo de URLs a controladores

**Middlewares** (`src/middlewares/`):
- Interceptan requests antes de llegar a controladores
- Autenticación, validación, logging, error handling

**Services** (`src/services/`):
- Lógica de negocio compleja
- Interacción con servicios externos (DGA)
- Procesamiento de datos

**Utils** (`src/utils/`):
- Funciones auxiliares reutilizables
- Helpers de autenticación, validación, etc.

### Flujo de Request

```
Cliente HTTP
    ↓
Express App (app.js)
    ↓
Middleware Global (CORS, JSON parser, logger)
    ↓
Route Handler (user.route.js, client.route.js, etc.)
    ↓
Auth Middleware (validación JWT y roles)
    ↓
Validation Middleware (validación de parámetros)
    ↓
Controller (user.controller.js, etc.)
    ↓
Sequelize Model (consultas a base de datos)
    ↓
Service (lógica de negocio compleja) [opcional]
    ↓
Response al Cliente
    ↓
Error Middleware (si hay error en cualquier paso)
```

## Modelos de Base de Datos

### Diagrama de Relaciones

```
role (1) ──────< user (N)
                  │
                  ├──────> person (1:1)
                  │
                  ├──────> client (1:1)
                  │           │
                  │           └──────< well (N)
                  │                      │
                  │                      └──────< wellData (N)
                  │
                  ├──────> company (1:1)
                  │           │
                  │           ├──────< client (N)
                  │           └──────< distributor (N:1)
                  │
                  └──────> distributor (1:1)
                              │
                              └──────< company (N)
```

### Modelos Detallados

#### **user** (Usuario base)
```javascript
{
  id: INTEGER (PK, auto-increment),
  name: STRING (NOT NULL),
  email: STRING (NOT NULL, UNIQUE, email validation),
  encrypted_password: STRING (NOT NULL, bcrypt hashed),
  roleId: INTEGER (FK → role.id, default: 2),
  isActived: BOOLEAN (default: true),
  createdBy: INTEGER (FK → user.id, nullable)
}
```
**Asociaciones**:
- `hasOne` person
- `hasOne` client
- `hasOne` company
- `hasOne` distributor
- `belongsTo` role

**Métodos de instancia**:
- `generateToken()` - Genera JWT
- `handlePasswordChange(oldPassword, newPassword)` - Cambiar contraseña
- `checkPassword(password)` - Verificar contraseña
- `checkPasswordValidation(password)` - Validar formato (min 8 chars)
- `updatePassword(newPassword)` - Actualizar contraseña hasheada
- `createPerson(personParams, Person)` - Crear registro person
- `createCompany(companyParams, Company)` - Crear registro company
- `createDistributor(distributorParams, Distributor)` - Crear registro distributor

**Hooks**:
- `beforeCreate`: Hashea la contraseña antes de crear

#### **role** (Roles del sistema)
```javascript
{
  id: INTEGER (PK, auto-increment),
  type: STRING (NOT NULL, UNIQUE, enum: ['admin', 'normal', 'company', 'distributor']),
  description: STRING (NOT NULL),
  isAdmin: BOOLEAN (default: false),
  isCompany: BOOLEAN (default: false),
  isDistributor: BOOLEAN (default: false)
}
```
**Asociaciones**:
- `hasMany` user

**Roles predefinidos**:
1. **admin** (id: 1): isAdmin: true - Acceso total
2. **normal** (id: 2): Todos false - Usuario estándar
3. **company** (id: 3): isCompany: true - Empresa
4. **distributor** (id: 4): isDistributor: true - Distribuidora

#### **person** (Información personal)
```javascript
{
  id: INTEGER (PK, auto-increment),
  userId: INTEGER (FK → user.id, NOT NULL),
  fullName: STRING (NOT NULL),
  personalEmail: STRING (UNIQUE, nullable, email validation),
  phoneNumber: STRING (NOT NULL),
  location: STRING (NOT NULL)
}
```
**Asociaciones**:
- `belongsTo` user (onDelete: CASCADE)

**Uso**: Información adicional para usuarios **admin** y **normal**

#### **client** (Cliente con pozos)
```javascript
{
  id: INTEGER (PK, auto-increment),
  userId: INTEGER (FK → user.id, NOT NULL, UNIQUE),
  companyId: INTEGER (FK → company.id, nullable)
}
```
**Asociaciones**:
- `belongsTo` user (onDelete: CASCADE)
- `belongsTo` company (onDelete: CASCADE)
- `hasMany` well (onDelete: CASCADE)

**Métodos de instancia**:
- `updateDetails(user, person, data)` - Actualizar detalles del cliente
- `checkUserPasswordValidation(password)` - Validar contraseña

**Jerarquía**: Cliente pertenece a una Company (opcional)

#### **company** (Empresa gestora)
```javascript
{
  id: INTEGER (PK, auto-increment),
  userId: INTEGER (FK → user.id, NOT NULL, UNIQUE),
  companyLogo: STRING (nullable),
  companyRut: STRING (UNIQUE, nullable),
  phoneNumber: STRING (nullable),
  recoveryEmail: STRING (nullable),
  location: STRING (nullable),
  distributorId: INTEGER (FK → distributor.id, nullable)
}
```
**Asociaciones**:
- `belongsTo` user (onDelete: CASCADE)
- `belongsTo` distributor (onDelete: CASCADE)
- `hasMany` client (onDelete: CASCADE)

**Métodos de instancia**:
- `updateDetails(user, data)` - Actualizar detalles de la empresa

**Jerarquía**: Empresa pertenece a una Distributor (opcional)

#### **distributor** (Distribuidora top-level)
```javascript
{
  id: INTEGER (PK, auto-increment),
  userId: INTEGER (FK → user.id, NOT NULL, UNIQUE),
  distributorLogo: STRING (nullable),
  distributorRut: STRING (UNIQUE, nullable),
  phoneNumber: STRING (nullable),
  recoveryEmail: STRING (UNIQUE, nullable, email validation),
  location: STRING (nullable)
}
```
**Asociaciones**:
- `belongsTo` user (onDelete: CASCADE)
- `hasMany` company (onDelete: CASCADE)

**Métodos de instancia**:
- `updateDetails(user, data)` - Actualizar detalles de la distribuidora

**Jerarquía**: Nivel más alto, gestiona múltiples empresas

#### **well** (Pozo de agua)
```javascript
{
  id: INTEGER (PK, auto-increment),
  clientId: INTEGER (FK → client.id, NOT NULL),
  name: STRING,
  location: STRING (NOT NULL),
  code: STRING (NOT NULL, UNIQUE),
  isActived: BOOLEAN (default: false),
  editStatusDate: DATE (nullable),
  rutEmpresa: STRING (nullable),
  rutUsuario: STRING (nullable),
  password: STRING (nullable)
}
```
**Asociaciones**:
- `belongsTo` client (onDelete: CASCADE)
- `hasMany` wellData (foreignKey: 'code', sourceKey: 'code', onDelete: CASCADE)

**Jerarquía**: Pertenece a un Cliente
**Nota**: `code` es la clave única de identificación (ej: "ABC1638234")

#### **wellData** (Reporte de telemetría)
```javascript
{
  id: INTEGER (PK, auto-increment),
  code: STRING (FK → well.code, NOT NULL, length: 1-20),
  date: STRING (NOT NULL, formato: "DD/MM/YYYY"),
  realDate: DATEONLY (nullable, para filtros),
  hour: STRING (NOT NULL, formato: "HH:MM:SS"),
  totalizador: INTEGER (NOT NULL, m³),
  caudal: FLOAT (NOT NULL, L/s),
  nivel_freatico: FLOAT (NOT NULL, metros),
  sent: BOOLEAN (default: false),
  sentDate: STRING (nullable)
}
```
**Asociaciones**:
- `belongsTo` well (foreignKey: 'code', targetKey: 'code', onDelete: CASCADE)

**Índices**:
- Índice único: `[date, hour, code]` - Previene reportes duplicados

**Hooks**:
- `afterCreate`: Si el pozo está activo (`well.isActived = true`), envía automáticamente el reporte a DGA vía `processAndPostData()`

**Jerarquía**: Pertenece a un Pozo (múltiples reportes por pozo)

## API Endpoints

### Autenticación y Usuarios

**POST** `/users/login`
- **Descripción**: Autenticación de usuario
- **Body**: `{ email, password }`
- **Response**: `{ user, token }` (JWT con expiración 24h)
- **Roles**: Público

**POST** `/users/register`
- **Descripción**: Registrar nuevo usuario (cliente, empresa, distribuidora)
- **Auth**: Requerido (Admin, Company, Distributor)
- **Body**:
  ```javascript
  {
    name, email, encrypted_password, roleId, isActived,
    // Si roleId = 2 (normal):
    fullName, location, phoneNumber, personalEmail, companyId?,
    // Si roleId = 3 (company):
    companyLogo?, companyRut?, phoneNumber?, recoveryEmail?, location?, distributorId?,
    // Si roleId = 4 (distributor):
    distributorLogo?, distributorRut?, phoneNumber?, recoveryEmail?, location?
  }
  ```
- **Response**: `{ user, token }`
- **Nota**: Crea automáticamente registros asociados (person, client, company, o distributor) según el rol

**GET** `/users`
- **Descripción**: Obtener todos los usuarios (sin contraseñas)
- **Response**: Array de users
- **Roles**: Público (pendiente protección)

**GET** `/users/data`
- **Descripción**: Obtener datos del usuario autenticado
- **Auth**: Requerido (All roles)
- **Response**: User con client/company/distributor según rol
- **Nota**: Retorna diferentes asociaciones según `user.role.type`

**GET** `/users/data/:id`
- **Descripción**: Obtener datos de usuario por ID de cliente
- **Auth**: Requerido (All roles)
- **Response**: User con person y role
- **Permisos**: Verifica permisos según rol del solicitante

**GET** `/users/role/:id`
- **Descripción**: Obtener rol de un usuario
- **Auth**: Requerido (All roles)
- **Response**: Role object

**GET** `/users/roles`
- **Descripción**: Obtener todos los roles disponibles
- **Auth**: Requerido (Admin, Company, Distributor)
- **Response**: Array de roles

### Clientes

**GET** `/clients`
- **Descripción**: Obtener todos los clientes
- **Auth**: Requerido (Admin, Company)
- **Response**: Array de clientes con usuario y persona

**GET** `/clients/:id`
- **Descripción**: Obtener detalles de un cliente
- **Auth**: Requerido (Admin, Company, Distributor, Normal - propio)
- **Response**: Cliente con wells, user, person, company

**GET** `/clients/:id/wells`
- **Descripción**: Obtener pozos de un cliente (paginado)
- **Auth**: Requerido (Admin, Company, Normal)
- **Query Params**: `page`, `size`
- **Response**: `{ wells: [], pagination: { totalItems, totalPages, currentPage } }`

**GET** `/clients/:id/wells/:code`
- **Descripción**: Obtener detalles de un pozo específico
- **Auth**: Requerido (Admin, Company, Normal)
- **Response**: Well object

**GET** `/clients/:clientId/wells/:code/reports`
- **Descripción**: Obtener reportes de un pozo (paginado, filtrable por mes/año)
- **Auth**: Requerido (Admin, Company, Distributor, Normal)
- **Query Params**: `page`, `size`, `month` (1-12), `year` (YYYY)
- **Response**:
  ```javascript
  {
    wellData: [],
    pagination: { totalItems, totalPages, currentPage },
    well: { code, name, location }
  }
  ```

**POST** `/clients/:id/wells/create`
- **Descripción**: Crear o actualizar un pozo
- **Auth**: Requerido (Admin, Company, Normal)
- **Body**: `{ name, location, code, rutEmpresa?, rutUsuario?, password? }`
- **Response**: Well object
- **Nota**: Si `code` existe, actualiza; si no, crea

**PUT** `/clients/:clientId`
- **Descripción**: Actualizar o crear cliente
- **Auth**: Requerido (Admin, Company)
- **Body**: Datos de user, person, client
- **Response**: `{ client, user, person, role }`

**DELETE** `/clients/:clientId`
- **Descripción**: Eliminar cliente (y sus pozos en cascada)
- **Auth**: Requerido (Admin, Company)
- **Response**: Mensaje de confirmación

**DELETE** `/clients/:clientId/wells/:code`
- **Descripción**: Eliminar un pozo
- **Auth**: Requerido (Admin, Company, Normal)
- **Response**: Mensaje de confirmación

### Empresas

**GET** `/companies`
- **Descripción**: Obtener todas las empresas
- **Auth**: Requerido (Admin, Distributor)
- **Response**: Array de empresas con user

**GET** `/companies/:id`
- **Descripción**: Obtener detalles de una empresa
- **Auth**: Requerido (Admin, Distributor, Company - propia)
- **Response**: Company con user y clients

**GET** `/companies/:id/clients`
- **Descripción**: Obtener clientes de una empresa
- **Auth**: Requerido (Admin, Distributor, Company)
- **Response**: Array de clients con user y person

**POST** `/companies/:companyId?`
- **Descripción**: Crear o actualizar empresa
- **Auth**: Requerido (Admin, Distributor)
- **Body**: Datos de user y company
- **Response**: `{ company, user, role }`

**DELETE** `/companies/:companyId`
- **Descripción**: Eliminar empresa (y sus clientes en cascada)
- **Auth**: Requerido (Admin)
- **Response**: Mensaje de confirmación

### Distribuidoras

**GET** `/distributors`
- **Descripción**: Obtener todas las distribuidoras
- **Auth**: Requerido (Admin)
- **Response**: Array de distributors con user

**GET** `/distributors/:id`
- **Descripción**: Obtener detalles de una distribuidora
- **Auth**: Requerido (Admin, Distributor - propia)
- **Response**: Distributor con user y companies

**GET** `/distributors/:id/companies`
- **Descripción**: Obtener empresas de una distribuidora
- **Auth**: Requerido (Admin, Distributor)
- **Response**: Array de companies con user

**POST** `/distributors/:distributorId?`
- **Descripción**: Crear o actualizar distribuidora
- **Auth**: Requerido (Admin)
- **Body**: Datos de user y distributor
- **Response**: `{ distributor, user, role }`

**DELETE** `/distributors/:distributorId`
- **Descripción**: Eliminar distribuidora (y sus empresas en cascada)
- **Auth**: Requerido (Admin)
- **Response**: Mensaje de confirmación

### Pozos

**GET** `/well`
- **Descripción**: Obtener todos los pozos
- **Response**: Array de wells
- **Roles**: Público (pendiente protección)

**GET** `/well/:id`
- **Descripción**: Obtener wellData de un pozo específico
- **Response**: Array de wellData
- **Roles**: Público (pendiente protección)

**POST** `/well`
- **Descripción**: Crear un pozo (alias de `/clients/:id/wells/create`)
- **Auth**: Requerido (Admin, Company, Normal)
- **Body**: `{ clientId, name, location, code, rutEmpresa?, rutUsuario?, password? }`
- **Response**: Well object

**PUT** `/wells/:id/active`
- **Descripción**: Activar o desactivar un pozo
- **Auth**: Requerido (Admin, Company, Normal)
- **Body**: `{ isActived: boolean }`
- **Response**: Well object actualizado
- **Nota**: Actualiza `editStatusDate` automáticamente

### Datos de Pozos (WellData)

**POST** `/wellData`
- **Descripción**: Crear un reporte de telemetría
- **Body**: `{ code, date, hour, totalizador, caudal, nivel_freatico }`
- **Response**: WellData object
- **Roles**: Público (usado por dispositivos IoT)
- **Nota**: Si el pozo está activo, envía automáticamente a DGA (hook `afterCreate`)

**POST** `/massImportWellData`
- **Descripción**: Importar múltiples reportes en bulk
- **Body**: Array de wellData objects
- **Response**: Reportes creados
- **Roles**: Público

**GET** `/fetchUnsentReports`
- **Descripción**: Obtener reportes no enviados a DGA
- **Response**: Array de wellData con `sent: false`
- **Roles**: Público (usado por SENDER service)

**POST** `/repostToDGA`
- **Descripción**: Reenviar reportes específicos a DGA
- **Body**: `{ reports: [wellData objects] }`
- **Response**: Resultado del envío
- **Roles**: Público (usado por SENDER service)

**POST** `/repostAllReportsToDGA`
- **Descripción**: Reenviar todos los reportes seleccionados a DGA
- **Body**: `{ reports: [{ reportId }] }`
- **Response**: Resultado del envío
- **Roles**: Público (usado por frontend)
- **Nota**: Extrae IDs de reportes, los busca en DB y llama a `repostToDGA`

### Contacto

**POST** `/contactUs`
- **Descripción**: Enviar formulario de contacto de landing page
- **Body**: `{ name, email, message }`
- **Response**: Email enviado (vía nodemailer)
- **Roles**: Público

## Autenticación y Autorización

### JWT (JSON Web Tokens)

**Generación** (`src/utils/auth.util.js`):
```javascript
function generateToken(user) {
  const role = await user.getRole();
  const payload = { id: user.id, type: role.type };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}
```

**Payload del Token**:
```javascript
{
  id: 123,           // user.id
  type: "company",   // role.type ('admin', 'company', 'distributor', 'normal')
  iat: 1234567890,   // Issued at
  exp: 1234654290    // Expiration (24 horas después)
}
```

**Verificación** (Middleware `auth.middleware.js`):
1. Extrae token de header `Authorization: Bearer <token>`
2. Decodifica y verifica con `jwt.verify(token, JWT_SECRET)`
3. Verifica que el rol del usuario esté en los roles permitidos
4. Adjunta `req.user = decoded` para uso en controladores

### Roles Permitidos (`src/utils/allowed-roles.util.js`)

```javascript
const Admin = ['admin'];
const AllRoles = ['admin', 'company', 'distributor', 'normal'];
const AdminAndCompany = ['admin', 'company'];
const AdminAndCompanyAndNormal = ['admin', 'company', 'normal'];
const AdminAndCompanyAndDistributor = ['admin', 'company', 'distributor'];
```

**Uso en rutas**:
```javascript
router.post('/users/register',
  authMiddleware(...AdminAndCompanyAndDistributor),
  registerUser
);
```

### Verificación de Permisos (`src/utils/check-permissions.js`)

Lógica adicional para verificar que:
- Admin puede acceder a todo
- Company solo puede gestionar sus propios clientes
- Normal solo puede acceder a sus propios recursos
- Distributor puede ver empresas y clientes asociados

## Seguridad

### Hashing de Contraseñas

**Bcrypt** (`src/utils/auth.util.js`):
```javascript
async function hashPassword(password) {
  return await bcrypt.hash(password, 10); // 10 salt rounds
}

async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}
```

**Hook de Modelo**:
```javascript
user.init({
  // ...campos
}, {
  hooks: {
    beforeCreate: async (user) => {
      user.encrypted_password = await hashPassword(user.encrypted_password);
    }
  }
});
```

### Validaciones

**A nivel de modelo** (Sequelize):
- Email válido: `validate: { isEmail: true }`
- Unicidad: `unique: { args: true, msg: "Email ya existe" }`
- Enums: `validate: { isIn: [['admin', 'normal', 'company', 'distributor']] }`
- Longitud: `validate: { len: [1, 20] }`

**A nivel de middleware** (`validate-params.middleware.js`):
- Validación de parámetros de request
- Esquemas en `src/utils/params/`

**Validaciones de contraseña** (Modelo user):
- Mínimo 8 caracteres
- Verificación de contraseña antigua antes de cambiar
- Nueva contraseña no puede ser igual a la antigua

### CORS

**Configuración** (`src/app.js`):
```javascript
const cors = require('cors');
app.use(cors()); // Permitir todas las origins (configurar en producción)
```

### Manejo de Errores

**ErrorHandler** (`src/utils/error.util.js`):
```javascript
class ErrorHandler extends Error {
  constructor(error) {
    super(error.message);
    this.statusCode = error.statusCode;
    this.message = error.message;
  }
}
```

**Códigos de error** (`src/utils/errorcodes.util.js`):
- `userNotFound`: 404, "Usuario no encontrado"
- `unauthorized`: 401, "No autorizado"
- `passwordsDontMatch`: 400, "Contraseñas no coinciden"
- `badPasswordValidation`: 400, "Contraseña debe tener al menos 8 caracteres"
- Y muchos más...

**Middleware global** (`src/middlewares/error.middleware.js`):
```javascript
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
}
```

## Integración con DGA

### Servicio de Envío (`src/services/wellData/handleSendData.service.js`)

**Función**: `processAndPostData(wellData, well)`

**Flujo**:
1. Recibe un `wellData` recién creado
2. Verifica que el pozo esté activo (`well.isActived`)
3. Formatea los datos según el formato requerido por DGA
4. Realiza POST a la API de DGA (vía axios)
5. Parsea respuesta XML de DGA (vía xml2js)
6. Actualiza `wellData.sent = true` si éxito
7. Guarda `sentDate` con fecha/hora del envío

**Trigger**: Hook `afterCreate` en modelo `wellData`

**Credenciales DGA** (desde `.env`):
```bash
DGA_RUT_COMPANY=    # RUT de la empresa registrada en DGA
DGA_RUT=            # RUT del usuario DGA
DGA_PASSWORD=       # Contraseña DGA
```

### Servicio SENDER (Ruby on Rails)

**Ubicación**: `SENDER/wellproject/`

**Función**: Cron job que ejecuta periódicamente para:
1. Consultar reportes no enviados (`/fetchUnsentReports`)
2. Procesar y formatear datos
3. Enviar a DGA
4. Actualizar estado de reportes

**Programación**: Configurado con `whenever` gem

**Documentación**: Ver `SENDER/README.md`

## Configuración

### Variables de Entorno

**Archivo**: `.env` (ver `.env.example` como plantilla)

```bash
# Base de datos PostgreSQL
DB_USERNAME=postgres
DB_PASSWORD=password123
DB_NAME=wellproject_dev
DB_PORT=5432
DB_HOST=db              # 'db' para Docker, 'localhost' para local
DB_HOST_LOCAL=localhost

# Entorno
NODE_ENV=development    # 'development', 'test', 'production'

# Autenticación
JWT_SECRET=your_jwt_secret_key_here
BCRYPT_SALT_ROUNDS=10

# Email (Nodemailer)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# DGA (Dirección General de Aguas)
DGA_RUT_COMPANY=12345678-9
DGA_RUT=98765432-1
DGA_PASSWORD=dga_password
```

### Configuración de Sequelize

**Archivo**: `config/config.js`

```javascript
module.exports = {
  development: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    host: process.env.DB_HOST,
    dialect: 'postgres',
  },
  test: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: `${process.env.DB_NAME}_test`,
    port: process.env.DB_PORT,
    host: process.env.DB_HOST,
    dialect: 'postgres',
  }
}
```

**Sequelize CLI**: `.sequelizerc`
```javascript
const path = require('path');

module.exports = {
  'config': path.resolve('config', 'config.js'),
  'models-path': path.resolve('models'),
  'seeders-path': path.resolve('seeders'),
  'migrations-path': path.resolve('migrations')
};
```

## Docker

### docker-compose.yml

**Servicios**:

1. **api** (Node.js/Express)
   - Build: `API/development.Dockerfile`
   - Puerto: 3000
   - Depends on: `db`
   - Hot reload: Volume mount de `./API:/usr/src/app`

2. **db** (PostgreSQL)
   - Imagen: `postgres:14.11-alpine3.19`
   - Puerto: 5432
   - Volumen persistente: `postgres_data`
   - Env vars: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`

3. **sender** (Ruby on Rails)
   - Build: `SENDER/wellproject/Dockerfile`
   - Depends on: `api`, `db`
   - Cron jobs para envío a DGA

**Comandos**:
```bash
# Iniciar todos los servicios
docker-compose up -d

# Ver logs
docker-compose logs -f api

# Detener servicios
docker-compose down

# Reconstruir contenedores
docker-compose up -d --build
```

## Comandos de Desarrollo

### Instalación y Setup

```bash
cd API

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Crear base de datos (si no existe)
npx sequelize-cli db:create

# Ejecutar migraciones
npx sequelize-cli db:migrate

# (Opcional) Ejecutar seeds
npx sequelize-cli db:seed:all
```

### Desarrollo

```bash
# Desarrollo con hot reload (nodemon)
npm run dev

# Producción
npm start

# Tests
npm test
```

### Sequelize CLI

```bash
# Crear nueva migración
npx sequelize-cli migration:generate --name add-new-field

# Ejecutar migraciones pendientes
npx sequelize-cli db:migrate

# Revertir última migración
npx sequelize-cli db:migrate:undo

# Revertir todas las migraciones
npx sequelize-cli db:migrate:undo:all

# Crear seed
npx sequelize-cli seed:generate --name demo-users

# Ejecutar seeds
npx sequelize-cli db:seed:all

# Revertir último seed
npx sequelize-cli db:seed:undo

# Crear modelo (genera modelo + migración)
npx sequelize-cli model:generate --name User --attributes name:string,email:string
```

## Testing

**Framework**: Jest 29.7.0

**Ubicación**: `tests/`

**Configuración**: `package.json`
```json
{
  "scripts": {
    "test": "jest"
  }
}
```

**Faker**: `@faker-js/faker` para generar datos de prueba

**Estado actual**: Setup básico, cobertura mínima (oportunidad de mejora)

## Deployment

### Entorno de Producción

**Plataforma**: AWS EC2 (ver `documentations/amazon-instance.md`)

**Base de datos**: PostgreSQL (posiblemente RDS)

**Proceso**:
1. SSH a instancia EC2
2. Pull de cambios desde Git
3. `npm install` (si hay nuevas dependencias)
4. `npx sequelize-cli db:migrate` (aplicar migraciones)
5. Reiniciar servicio (PM2, systemd, o Docker)

**Variables de entorno**: Configurar `.env` en servidor con credenciales de producción

**Logs**: Monitorear logs de errores y accesos

## Convenciones de Desarrollo

### Git

**Convenciones detalladas**: Ver `documentations/git-conventions.md`

**Branches**:
- `master` - Rama principal (producción)
- `feature/nombre-descriptivo` - Nuevas funcionalidades
- `bugfix/nombre-descriptivo` - Corrección de bugs

**Commits**:
- Mensajes en español
- Conciso y descriptivo
- Enfocar en el "por qué", no solo el "qué"

**Pull Requests**:
1. Crear branch desde `master`
2. Commits pequeños y descriptivos
3. Crear PR con descripción clara
4. Requiere revisión y aprobación
5. Merge a `master`

**Proceso detallado**: Ver `documentations/dev-process.md` y `documentations/review-pr-process.md`

### Código

**Nombres de archivos**:
- Modelos: camelCase (`user.js`, `wellData.js`)
- Controladores: camelCase con sufijo `.controller.js` (`user.controller.js`)
- Rutas: camelCase con sufijo `.route.js` (`user.route.js`)
- Middlewares: camelCase con sufijo `.middleware.js` (`auth.middleware.js`)
- Utilidades: camelCase con sufijo `.util.js` (`auth.util.js`)

**Estructura de controladores**:
```javascript
const controllerFunction = async (req, res, next) => {
  try {
    // Lógica
    res.status(200).json(data);
  } catch (error) {
    next(error); // Delegar a error middleware
  }
};
```

**Manejo de errores**:
- Usar `throw new ErrorHandler(errorCode)` para errores esperados
- `try/catch` en todos los controladores async
- Delegar a `next(error)` para manejo global

## Documentación Adicional

Ver carpeta `documentations/`:

- **amazon-instance.md**: Navegación y comandos de AWS EC2
- **dev-process.md**: Proceso de desarrollo completo
- **files-order.md**: Estructura de archivos detallada
- **git-conventions.md**: Convenciones de Git y commits
- **model.md**: Diagramas y explicación de modelos
- **review-pr-process.md**: Proceso de revisión de PRs
- **sequelize-commands.md**: Comandos de Sequelize CLI
- **setup.md**: Instrucciones de instalación paso a paso
- **technologies.md**: Explicación de tecnologías utilizadas

## Recursos Adicionales

### Documentación Externa
- [Express.js](https://expressjs.com/)
- [Sequelize ORM](https://sequelize.org/)
- [PostgreSQL](https://www.postgresql.org/docs/)
- [JWT](https://jwt.io/)
- [bcrypt.js](https://www.npmjs.com/package/bcryptjs)

### Repositorio
- GitHub: https://github.com/Emiliax16/WellProject
- Rama principal: `master`

### Endpoints de Producción
- API Backend: `https://promedicionbackend.com/`
- Frontend: `https://promedicionbackend.com/` (servido desde S3/CloudFront)

---

**Última actualización**: 2025-11-22
**Versión**: 1.0.0
**Autor**: Equipo WellProject
**Estado**: ✅ Producción (estable)
