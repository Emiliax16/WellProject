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

const lanza = (fn) => expect(fn).toThrow();
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
      noLanza(() => assertCanChangeRole(CLIENTE, cuentaNormal, { roleId: '' }));
    });

    it('un admin sí puede cambiar el rol', () => {
      noLanza(() => assertCanChangeRole(ADMIN, cuentaNormal, { roleId: 3 }));
      noLanza(() => assertCanChangeRole(ADMIN, cuentaNormal, { roleId: 1 }));
    });
  });
});
