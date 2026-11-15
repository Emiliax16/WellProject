// configuracion-de-produccion.test.js
//
// Producción corría con nodemon, que deja el contenedor `Up` aunque la API se
// haya caído, y varias dependencias de runtime estaban declaradas como de
// desarrollo. Estos tests fijan la configuración que lo evita (issue #71).

const paquete = require('../../package.json');

describe('package.json', () => {
  it('arranca con node, no con nodemon', () => {
    expect(paquete.scripts.start).toBe('node src/server.js');
  });

  it.each(['sequelize', 'pg', 'pg-hstore', 'moment-timezone'])(
    'declara %s como dependencia de runtime',
    (nombre) => {
      expect(paquete.dependencies).toHaveProperty(nombre);
      expect(paquete.devDependencies ?? {}).not.toHaveProperty(nombre);
    }
  );
});

describe('config/config.js', () => {
  const cargar = (valor) => {
    jest.resetModules();
    if (valor === undefined) delete process.env.DB_LOGGING;
    else process.env.DB_LOGGING = valor;
    return require('../../config/config');
  };

  afterEach(() => {
    delete process.env.DB_LOGGING;
  });

  it('no imprime las consultas SQL por defecto', () => {
    const config = cargar(undefined);

    expect(config.development.logging).toBe(false);
    expect(config.test.logging).toBe(false);
  });

  it('las imprime con DB_LOGGING=true', () => {
    const config = cargar('true');

    expect(config.development.logging).toBe(console.log);
  });
});
