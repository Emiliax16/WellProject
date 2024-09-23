# Comandos para uso de tecnologías

## Sequelize

### Pasos previos:
Primero es necesario tener un usuario de `postgres` con los permisos suficientes. En caso de no tenerlo se puede crear facilmente con lo siguiente:
  
```sh
# Iniciar Postgres
sudo service postgresql start
# Ingresar a la consola de postgres
sudo -u postgres psql
```

```sql
CREATE USER user_name WITH PASSWORD 'password';
ALTER USER user_name WITH SUPERUSER;
```
Luego, pueden crear la base de datos manualmente en `psql` o directamente con `sequelize`. Este ultimo seria asi:
```sh
npx sequelize-cli db:create
```
Ahora estan listos para crear sus modelos y migraciones.


### Generar modelos
Hacer cd a /services/api (NO CREAR DUPLICADO DE MODELS AFUERA DE ESTA RUTA). Para crear un modelo en `sequelize` se utiliza el siguiente comando:
```sh
npx sequelize-cli model:generate --name modelname --attributes
```
Por ejemplo, para crear un modelo de usuario con los atributos `name`, `email` y `password` se ejecutaria asi:
```sh
npx sequelize-cli model:generate --name user --attributes name:string,email:string,password:string
```
---
### Migraciones
Las migraciones son archivos que se encargan de crear o modificar tablas en la base de datos. Para crear una migracion se utiliza el siguiente comando:
```sh
npx sequelize-cli migration:generate --name migration-name
```
Al correr este comando se crea un archivo en la carpeta `migrations` con el nombre `timestamp-migration-name.js`. Este archivo por defecto viene vacio y tiene dos metodos: `up` y `down`. El metodo `up` se encarga de ejecutar el codigo y el metodo `down` de deshacerlo.

Las migraciones son super versatiles y con ellas se puede hacer practicamente cualquier cosa. Por ejemplo, se puede crear una tabla, agregar, quitar o modificar columnas, o bien agregar validaciones, entre otros. 


#### Ejecutar y deshacer migraciones
Para ejecutar las migraciones se utiliza el siguiente comando:

```sh
npx sequelize-cli db:migrate
```
Por otro lado, para deshacer una migracion se utiliza el siguiente comando:
```sh
npx sequelize-cli db:migrate:undo
```
Por defecto, al correr `npx sequelize-cli db:migrate` se ejecutan todas las migraciones pendientes, pero si se quisiese de todos modos ejecutarlas todas se puede agreger `:all`. O bien si se quiere correr una en especifico se puede agregar `--name migration-name`.

Habran ejemplos sobre como crear migraciones en la carpeta `migrations/`.

### Seeders
Los seeders son archivos que se encargan de poblar la base de datos con datos de prueba. Para crear un seeder se utiliza el siguiente comando:

```sh
npx sequelize-cli seed:generate --name seed-name
```
Esto crea un archivo en la carpeta `seeders` con el nombre `timestamp-seed-name.js`. Funciona de la misma manera que las migraciones, con los metodos `up` y `down`.

#### Ejecutar y deshacer seeders
Del mismo modo que con las migraciones, para hacer y deshacer los seeders se utiliza el siguiente comando:

```sh
npx sequelize-cli db:seed:all
npx sequelize-cli db:seed:undo:all
```
Al igual que con las migraciones, se puede ejecutar un seeder en especifico con `--name seed-name` o bien todos.


## Middlewares
Los `middlewares` son funciones que pueden intervenir en el ciclo de vida de una `request`. Pueden ser utilizados para validar datos, verificar permisos, etc. Los `middlewares` tienen acceso a cuatro parametros: `req`, `res`, `next` y `err`. Basicamente tienen acceso a la `request`, a la `response`, y tienen control sobre la funcion `next` que al final es la que decide si una `request` sigue avanzando en su ciclo de vida o si llega hasta alli. En caso de que haya un error, se puede pasar como parametro `err` y el `middleware` se encargara de manejarlo.

### Middleware de manejo de errores
Para "modularizar" los errores, se puede hacer un `middleware` que se encargue de manejarlos. En nuestro caso y por ahora, tenemos dos posibles errores: de `Sequelize` al violar alguna restriccion de datos o un error de servidor. Entonces, en vez de estar chequeando estos dos errores en cada controlador:
```js
try {
  // Codigo
} catch (err) {
  if (err instanceof Sequelize.ValidationError) {
    // Error de validacion
  } else {
    // Error de servidor
  }
}
```
Podemos hacer un middleware que maneje estos dos errores:
```js
const errorHandler = (err, req, res, next) => {
  if (err instanceof ValidationError) {
    const messages = err.errors.map((error) => error.message);
    return res.status(400).json({ errors: messages });
  }
  return res.status(500).json({ error: 'Internal Server Error' });
};
```
Y luego simplemente chequeamos por errores asi:
```js
try {
  // Codigo
} catch (err) {
  next(err);
}
```

### Manejo de errores custom
Para manejar errores personalizados se agregaron dos utilidades:
1. Encapsular los errores en objetos. Actualmente se definieron los siguientes:
```js
const INVALID_ID = {
  message: "User ID must be an integer",
  statusCode: 400
};

const USER_NOT_FOUND = {
  message: "User not found",
  statusCode: 404
};

const INCORRECT_PASSWORD = {
  message: "Incorrect password",
  statusCode: 401
};

module.exports = {
  INVALID_ID,
  USER_NOT_FOUND,
  INCORRECT_PASSWORD
};
```

2. Usando estos errores, se definio una clase que extiende de `Error` y que recibe un objeto de error. Esta clase se encuentra en `src/utils/errorhandler.util.js`. Esta se ve asi:
```js
class ErrorHandler extends Error {
  constructor(errorType) {
    super(errorType.message);
    this.statusCode = errorType.statusCode;
  }
}
```
Luego se agrego el chequeo de este tipo de errores al `middleware`:

```js
// src/middlewares/error.middleware.js
  if (err instanceof ErrorHandler) {
    return res.status(err.statusCode).json({ error: err.message });
  }
```
Con esto los errores se pueden manejar mas estandarizados y de una manera mas limpia. Por ejemplo:

```js
const getUser = async (req, res, next) => {
  try {
    const { id } = req.params
    if (isNaN(parseInt(id))) {
      throw new ErrorHandler(INVALID_ID)
    }
    const user = await User.findByPk(id)
    if (!user) {
      throw new ErrorHandler(USER_NOT_FOUND)
    }
    res.status(200).json(user)
  } catch (error) {
    next(error)
  }
}
```
En contraste tendriamos que estar siempre prendientes de un error descriptivo y del codigo de error adecuado. Con esta aproximacion el manejo de errores es mas simple.

---

## Testing
Al hacer cambios es vital que se hagan pruebas para asegurarse de que todo funciona correctamente. Para esto se crearon `tests` para los endpoints que tenemos definidos por ahora. La idea es que siempre que hagan un cambio corran los `tests`.

Para correrlos deben pararse en la carpeta `services/api` y correr el siguiente comando:
```sh
npm run test
```
Pero antes, es necesario que cambien la variable de entorno `NODE_ENV` a `test`. Luego, deben crear la base de datos de `testing` y correr sus migraciones. Para eso se definio un script que hace todo de una. Para correrlo deben pararse en la carpeta `services/api` y correr el siguiente comando:
```sh
npm run db:start:test
```




