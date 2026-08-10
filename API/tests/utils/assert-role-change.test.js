// assert-role-change.test.js
//
// Sin base de datos: la función es pura. Ver la nota en
// `tests/utils/check-permissions.test.js` sobre por qué se evita la base.

const assertCanChangeRole = require('../../src/utils/assert-role-change');

const ADMIN = { id: 1, type: 'admin' };
const EMPRESA = { id: 4, type: 'company' };
const CLIENTE = { id: 5, type: 'normal' };

// Sólo se mira `roleId`; es el usuario dueño de la cuenta que se edita.
const cuentaNormal = { id: 5, roleId: 2 };

const ErrorHandler = require('../../src/utils/error.util');

// Se comprueba el tipo y el status, no sólo que lance: un TypeError accidental
// también satisfaría un `toThrow()` a secas, y eso sería un 500, no un 401.
const lanza = (fn) => {
  expect(fn).toThrow(ErrorHandler);
  try {
    fn();
  } catch (e) {
    expect(e.statusCode).toBe(401);
  }
};
const noLanza = (fn) => expect(fn).not.toThrow();

describe('assertCanChangeRole', () => {
  describe('bloquea el escalamiento', () => {
    it('un cliente no puede convertirse en admin', () => {
      lanza(() => assertCanChangeRole(CLIENTE, cuentaNormal, { roleId: 1 }));
    });

    it('tampoco mandando el rol como string, que es lo que envía el selector', () => {
      lanza(() => assertCanChangeRole(CLIENTE, cuentaNormal, { roleId: '1' }));
    });

    it('una empresa no puede ascender a su cliente', () => {
      lanza(() => assertCanChangeRole(EMPRESA, cuentaNormal, { roleId: 1 }));
    });

    it('una empresa no puede ascenderse a sí misma', () => {
      lanza(() => assertCanChangeRole(EMPRESA, { id: 4, roleId: 3 }, { roleId: 1 }));
    });

    it('rechaza un roleId que no es un número', () => {
      lanza(() => assertCanChangeRole(CLIENTE, cuentaNormal, { roleId: 'admin' }));
    });

    it('rechaza cadenas que parseInt truncaría y Postgres leería distinto', () => {
      // `parseInt('2_0')` da 2, así que una comprobación con parseInt creería
      // que el rol no cambia. Postgres castea `'2_0'::integer` a 20 desde la
      // versión 16, y `users.roleId` no tiene FK, así que el valor entra.
      // No escala a admin, pero deja la cuenta con un rol inexistente y
      // `generateToken` revienta al buscarlo: el login queda en 500 para
      // siempre. Una empresa podría dejar así a cualquiera de sus clientes.
      lanza(() => assertCanChangeRole(CLIENTE, cuentaNormal, { roleId: '2_0' }));
      lanza(() => assertCanChangeRole(CLIENTE, cuentaNormal, { roleId: '2_00' }));
      lanza(() => assertCanChangeRole(CLIENTE, cuentaNormal, { roleId: '20_1' }));
      lanza(() => assertCanChangeRole(CLIENTE, cuentaNormal, { roleId: '2abc' }));
    });

    it('rechaza decimales, que además filtraban el mensaje de error de Postgres', () => {
      lanza(() => assertCanChangeRole(CLIENTE, cuentaNormal, { roleId: 2.9 }));
      lanza(() => assertCanChangeRole(CLIENTE, cuentaNormal, { roleId: '2.9' }));
    });

    it('rechaza tipos que Number coacciona a un entero', () => {
      // Number([1]) es 1 y Number(true) es 1: sin comprobar el tipo original,
      // ambos pasarían por un roleId válido.
      lanza(() => assertCanChangeRole(CLIENTE, cuentaNormal, { roleId: [1] }));
      lanza(() => assertCanChangeRole(CLIENTE, cuentaNormal, { roleId: true }));
      lanza(() => assertCanChangeRole(CLIENTE, cuentaNormal, { roleId: {} }));
    });

    it('normaliza el body para que se persista el valor validado', () => {
      // Si se dejara la cadena cruda, Postgres la reinterpretaría al escribir.
      const body = { roleId: '3' };
      assertCanChangeRole(ADMIN, cuentaNormal, body);
      expect(body.roleId).toBe(3);
    });
  });

  describe('no estorba a los flujos legítimos', () => {
    it('deja pasar el roleId sin cambios que manda el formulario del portal', () => {
      // El selector viene precargado con el rol actual, así que el campo viaja
      // siempre. Prohibirlo a secas rompería la edición de clientes.
      noLanza(() => assertCanChangeRole(CLIENTE, cuentaNormal, { roleId: 2 }));
      noLanza(() => assertCanChangeRole(EMPRESA, cuentaNormal, { roleId: '2' }));
    });

    it('deja pasar cuando el body no trae roleId', () => {
      noLanza(() => assertCanChangeRole(CLIENTE, cuentaNormal, { name: 'Nuevo' }));
      noLanza(() => assertCanChangeRole(CLIENTE, cuentaNormal, { roleId: null }));
      // Ojo: este guard ignora `roleId: ''` porque equivale a no mandarlo, pero
      // esa petición hoy tumba el proceso antes de llegar acá. `validate-params`
      // hace `Role.findByPk('')` y el rechazo de Postgres queda sin capturar.
      // No es asunto de esta función, pero no hay que leer este caso como que
      // el endpoint lo tolera: no lo tolera. Está en el issue #80.
      noLanza(() => assertCanChangeRole(CLIENTE, cuentaNormal, { roleId: '' }));
    });

    it('un admin sí puede cambiar el rol', () => {
      noLanza(() => assertCanChangeRole(ADMIN, cuentaNormal, { roleId: 3 }));
      noLanza(() => assertCanChangeRole(ADMIN, cuentaNormal, { roleId: 1 }));
    });
  });
});
