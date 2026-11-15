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

  it('el contenedor api corre node directo, no nodemon ni npm', () => {
    const compose = require('fs').readFileSync(require.resolve('../../../docker-compose.yml'), 'utf8');

    expect(compose).toContain('command: ["node", "src/server.js"]');
    expect(compose).toContain('init: true');
    expect(compose).not.toMatch(/command:.*nodemon|command:.*"dev"/);
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
  // Se fija la variable (vacía por defecto) en vez de borrarla: `config.js`
  // carga `dotenv`, que no pisa una variable existente, así que un
  // `DB_LOGGING=true` en el `.env` local no altera el resultado.
  const cargar = (valor) => {
    jest.resetModules();
    process.env.DB_LOGGING = valor ?? '';
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
