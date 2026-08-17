// well-response.test.js
//
// El filtro de campos publicables de un pozo. Lo que se prueba acá es sobre todo
// que no se pueda romper en silencio: las dos formas de fallar son devolver de
// más (una credencial) y devolver de menos (`{}` porque se filtró la instancia
// sin serializarla), y la segunda no lanza ningún error.

const { Sequelize, DataTypes } = require('sequelize');
const { respuestaDePozo, CAMPOS_PUBLICOS_WELL } = require('../../src/utils/well-response.util');

// No abre conexión: define el modelo y nada más.
const Well = require('../../models/well')(new Sequelize({ dialect: 'postgres' }), DataTypes);

const COLUMNAS = {
  id: 7,
  code: 'ABC123',
  name: 'Pozo de prueba',
  location: 'Región de Coquimbo',
  clientId: 3,
  isActived: true,
  password: 'secreto-dga',
  rutEmpresa: '76123456-7',
  rutUsuario: '12345678-9',
};

describe('respuestaDePozo', () => {
  describe('sobre una instancia de Sequelize', () => {
    const filtrado = () => respuestaDePozo(Well.build(COLUMNAS));

    it('conserva los campos publicables', () => {
      expect(filtrado()).toMatchObject({ id: 7, code: 'ABC123', isActived: true });
    });

    it.each(['password', 'rutEmpresa', 'rutUsuario'])('quita %s', (campo) => {
      expect(filtrado()).not.toHaveProperty(campo);
    });

    // La instancia guarda las columnas en `dataValues`, no como propiedades
    // propias. Si alguien quita el paso por `toJSON`, esto devuelve `{}` y los
    // dos endpoints responden vacío sin error.
    it('no se vacía: devuelve campos de verdad', () => {
      expect(Object.keys(filtrado()).length).toBeGreaterThan(3);
    });
  });

  describe('sobre lo que no es una instancia', () => {
    it('acepta un objeto plano', () => {
      expect(respuestaDePozo({ ...COLUMNAS })).toMatchObject({ id: 7, code: 'ABC123' });
      expect(respuestaDePozo({ ...COLUMNAS })).not.toHaveProperty('password');
    });

    it.each([null, undefined, {}])('no lanza con %p', (entrada) => {
      expect(() => respuestaDePozo(entrada)).not.toThrow();
      expect(respuestaDePozo(entrada)).toEqual({});
    });

    // Un array pasaría por el camino del objeto plano y saldría como `{}`: un
    // listado vacío, sin error y sin rastro. Es la equivocación natural el día
    // que alguien quiera aplicar esto a `getAllWells`.
    it('lanza con un listado, en vez de vaciarlo en silencio', () => {
      expect(() => respuestaDePozo([Well.build(COLUMNAS)])).toThrow(TypeError);
    });
  });

  describe('el allowlist', () => {
    it('no incluye ninguna credencial DGA', () => {
      expect(CAMPOS_PUBLICOS_WELL).toEqual(
        expect.not.arrayContaining(['password', 'rutEmpresa', 'rutUsuario'])
      );
    });

    // Si mañana se agrega una columna al modelo, queda fuera de las respuestas
    // hasta que alguien la agregue acá a propósito. Este test existe para que
    // ese día se note.
    it('deja fuera las columnas del modelo que no estén declaradas', () => {
      const columnasDelModelo = Object.keys(Well.getAttributes());
      const noPublicadas = columnasDelModelo.filter((c) => !CAMPOS_PUBLICOS_WELL.includes(c));

      expect(noPublicadas.sort()).toEqual(['password', 'rutEmpresa', 'rutUsuario']);
    });
  });
});
