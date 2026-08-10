// only-fields.test.js

const soloCampos = require('../../src/utils/only-fields.util');

describe('soloCampos', () => {
  it('deja pasar lo permitido y descarta el resto', () => {
    const body = { name: 'Pozo', location: 'Renca', clientId: 1, id: 99 };

    expect(soloCampos(body, ['name', 'location'])).toEqual({ name: 'Pozo', location: 'Renca' });
  });

  it('no inventa campos que el body no trae', () => {
    // Importa: si devolviera las claves ausentes como `undefined`, un `update`
    // las escribiría como NULL y borraría datos existentes.
    expect(soloCampos({ name: 'Pozo' }, ['name', 'location', 'code'])).toEqual({ name: 'Pozo' });
  });

  it('conserva los valores falsy, que son legítimos', () => {
    // `isActived: false` y una ubicación vacía tienen que poder guardarse.
    expect(soloCampos({ isActived: false, location: '' }, ['isActived', 'location']))
      .toEqual({ isActived: false, location: '' });
  });

  it('descarta claves de prototipo', () => {
    const body = JSON.parse('{"name":"Pozo","__proto__":{"clientId":1},"constructor":"x"}');

    const resultado = soloCampos(body, ['name']);

    expect(resultado).toEqual({ name: 'Pozo' });
    expect({}.clientId).toBeUndefined();
  });

  it('tolera un body ausente', () => {
    expect(soloCampos(undefined, ['name'])).toEqual({});
    expect(soloCampos(null, ['name'])).toEqual({});
  });

  it('con la lista vacía no deja pasar nada', () => {
    expect(soloCampos({ name: 'Pozo' }, [])).toEqual({});
  });
});
