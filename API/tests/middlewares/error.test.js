// error.test.js
//
// Sin base de datos: se construyen los errores de Sequelize a mano.

const { ValidationError, ValidationErrorItem, ConnectionError, DatabaseError } = require('sequelize');
const errorHandler = require('../../src/middlewares/error.middleware');
const ErrorHandler = require('../../src/utils/error.util');

// Doble de `res` que registra lo que se responde.
const hacerRes = (headersSent = false) => {
  const res = {
    headersSent,
    statusCode: undefined,
    cuerpo: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.cuerpo = body; return this; },
  };
  return res;
};

const req = { method: 'POST', originalUrl: '/users/login' };

let errorSpy;
beforeEach(() => { errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { errorSpy.mockRestore(); });

describe('errorHandler', () => {
  describe('respuesta ya enviada', () => {
    it('delega en Express en vez de intentar un segundo envío', () => {
      // Responder dos veces lanza ERR_HTTP_HEADERS_SENT, que sin handler de
      // proceso mata la aplicación. Es lo que tumbó producción en agosto.
      const res = hacerRes(true);
      const next = jest.fn();

      errorHandler(new Error('lo que sea'), req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBeUndefined();
      expect(res.cuerpo).toBeUndefined();
    });
  });

  describe('errores propios: el mensaje se conserva', () => {
    // El portal los muestra al usuario tal cual (`userForm.js` lee
    // `error.response.data.error`), así que no se pueden genericar.
    it('respeta el status y el mensaje de ErrorHandler', () => {
      const res = hacerRes();
      errorHandler(new ErrorHandler({ message: 'Contraseña incorrecta.', code: 400 }), req, res, jest.fn());

      expect(res.statusCode).toBe(400);
      expect(res.cuerpo).toEqual({ error: 'Contraseña incorrecta.' });
    });

    it('usa 500 si el ErrorHandler viene sin código', () => {
      // `new ErrorHandler({ message })` deja `statusCode` indefinido, y
      // `res.status(undefined)` lanza. Con el respaldo, responde 500.
      const res = hacerRes();
      errorHandler(new ErrorHandler({ message: 'sin código' }), req, res, jest.fn());

      expect(res.statusCode).toBe(500);
    });

    it('devuelve la lista de mensajes de un ValidationError', () => {
      const res = hacerRes();
      const err = new ValidationError('falló', [
        new ValidationErrorItem('El email ya existe'),
      ]);

      errorHandler(err, req, res, jest.fn());

      expect(res.statusCode).toBe(400);
      expect(res.cuerpo.errors).toContain('El email ya existe');
    });
  });

  describe('errores internos: el mensaje NO se filtra', () => {
    it('un DatabaseError responde genérico, sin SQL', () => {
      const res = hacerRes();
      const err = new DatabaseError(
        Object.assign(new Error('invalid input syntax for type integer: "2abc"'), {
          sql: 'SELECT * FROM "roles" WHERE "id" = \'2abc\';',
        })
      );

      errorHandler(err, req, res, jest.fn());

      expect(res.statusCode).toBe(400);
      expect(JSON.stringify(res.cuerpo)).not.toMatch(/SELECT|roles|syntax/);
    });

    it('un ConnectionError responde 503 sin exponer el host', () => {
      const res = hacerRes();
      errorHandler(new ConnectionError(new Error('connect ECONNREFUSED 127.0.0.1:5432')), req, res, jest.fn());

      expect(res.statusCode).toBe(503);
      expect(JSON.stringify(res.cuerpo)).not.toMatch(/ECONNREFUSED|5432|127\.0\.0\.1/);
    });

    it('un error cualquiera responde 500 sin su mensaje', () => {
      const res = hacerRes();
      errorHandler(new Error('/usr/src/app/src/controllers/user.controller.js:409'), req, res, jest.fn());

      expect(res.statusCode).toBe(500);
      expect(JSON.stringify(res.cuerpo)).not.toMatch(/usr\/src\/app/);
    });
  });

  describe('lo que se registra', () => {
    it('loguea el error con la ruta, y nunca el body', () => {
      const res = hacerRes();
      const conBody = { ...req, body: { password: 'secreto-del-usuario' } };

      errorHandler(new Error('falló algo'), conBody, res, jest.fn());

      const registrado = errorSpy.mock.calls[0][0];
      expect(registrado).toMatch(/falló algo/);
      expect(registrado).toMatch(/\/users\/login/);
      expect(registrado).not.toMatch(/secreto-del-usuario/);
    });
  });
});
