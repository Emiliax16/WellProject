// server.test.js
//
// Levanta el servidor real en subprocesos: los handlers de proceso no se pueden
// probar en el proceso de jest sin matarlo. No consulta la base —cargar los
// modelos no abre conexión hasta la primera consulta— y bloquea axios antes de
// cargar nada, para que ningún camino pueda transmitir a la DGA.

const { spawn } = require('child_process');
const path = require('path');

const API = path.join(__dirname, '..');

// Cada subproceso usa un puerto propio para poder correr en paralelo.
let siguientePuerto = 3960;

const levantar = (inyectar = 'void 0;', senal = null) =>
  new Promise((resolve) => {
    const puerto = siguientePuerto++;
    const guion = `
      process.env.PORT = '${puerto}';
      const axios = require(${JSON.stringify(path.join(API, 'node_modules/axios'))});
      const bloquear = async () => { throw new Error('BLOQUEADO'); };
      axios.post = bloquear; axios.get = bloquear;
      const crear = axios.create.bind(axios);
      axios.create = (c) => { const x = crear(c); x.post = bloquear; return x; };
      require(${JSON.stringify(path.join(API, 'src/server.js'))});
      setTimeout(() => { ${inyectar} }, 300);
      setTimeout(() => process.exit(42), 5000);
    `;
    const hijo = spawn(process.execPath, ['-e', guion], { cwd: API });

    let salida = '';
    hijo.stdout.on('data', (d) => { salida += d; });
    hijo.stderr.on('data', (d) => { salida += d; });
    if (senal) setTimeout(() => hijo.kill(senal), 500);
    hijo.on('exit', (code) => resolve({ code, salida }));
  });

// Extrae la línea de log estructurado del tipo pedido.
const registroDe = (salida, tipo) => {
  const linea = salida.split('\n').find((l) => l.includes(`"${tipo}"`));
  try { return JSON.parse(linea); } catch { return null; }
};

jest.setTimeout(30_000);

describe('server', () => {
  it('arranca conservando la señal que usa el runbook y los schedulers', async () => {
    // El runbook de despliegue usa "Escuchando en el puerto N" para confirmar
    // que la aplicación recargó tras el git pull. Cambiar ese texto rompe la
    // verificación documentada.
    const { salida } = await levantar();

    expect(salida).toMatch(/Escuchando en el puerto \d+/);
    expect(salida).toMatch(/\[scheduler\]/);
  });

  describe('excepción no capturada', () => {
    it('registra el detalle y sale con código 1', async () => {
      // Antes el proceso moría sin más rastro que el stack de Node, y con
      // nodemon quedaba caído sin que nadie se enterara.
      const { code, salida } = await levantar("setTimeout(() => { throw new Error('boom'); }, 0);");

      expect(code).toBe(1);
      const registro = registroDe(salida, 'uncaughtException');
      expect(registro).toMatchObject({ level: 'fatal', message: 'boom' });
      expect(registro.stack).toBeTruthy();
      expect(registro.at).toBeTruthy();
    });
  });

  describe('rejection no capturada', () => {
    it('registra el motivo y sale con código 1', async () => {
      const { code, salida } = await levantar("Promise.reject(new Error('promesa rota'));");

      expect(code).toBe(1);
      expect(registroDe(salida, 'unhandledRejection')).toMatchObject({
        level: 'fatal',
        message: 'promesa rota',
      });
    });

    it('también registra un rechazo que no es un Error', async () => {
      const { code, salida } = await levantar("Promise.reject('texto suelto');");

      expect(code).toBe(1);
      expect(registroDe(salida, 'unhandledRejection').message).toBe('texto suelto');
    });
  });

  describe('apagado ordenado', () => {
    // Importa porque un POST /wellData en vuelo puede estar transmitiendo al
    // regulador: se deja de aceptar conexiones y se espera a las que están.
    it.each(['SIGTERM', 'SIGINT'])('%s cierra con código 0 y lo deja registrado', async (senal) => {
      const { code, salida } = await levantar('void 0;', senal);

      expect(code).toBe(0);
      expect(salida).toMatch(new RegExp(`${senal} recibido`));
    });
  });
});
