// rutas-del-sender.test.js
//
// `/fetchUnsentReports` y `/repostToDGA` existían solo para el SENDER, el
// servicio en Rails que reintentaba los envíos a la DGA. El reintento ahora
// corre dentro de la API (`src/jobs/dga-retry.js`), así que esas rutas se
// eliminaron junto con la clave interna que las protegía. Si alguien las
// restaurara por error, quedarían expuestas sin ninguna protección: una permite
// leer todos los reportes pendientes y la otra, forzar reenvíos a la DGA.
//
// Sin base ni red: los modelos van mockeados y la app escucha en un puerto
// efímero.

jest.mock('../../models', () => ({
  client: {}, well: {}, wellData: {}, company: {}, distributor: {}, user: {}, person: {}, role: {},
  sequelize: { authenticate: jest.fn() },
}));
jest.mock('../../src/services/activityLog.service', () => ({ createActivityLog: jest.fn() }));

const pedir = async (metodo, ruta, cuerpo) => {
  const app = require('../../src/app');
  const servidor = app.listen(0);
  try {
    const { port } = servidor.address();
    const respuesta = await fetch(`http://127.0.0.1:${port}${ruta}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', 'X-Internal-Api-Key': 'a'.repeat(64) },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    return { status: respuesta.status, cuerpo: await respuesta.json() };
  } finally {
    await new Promise((cerrar) => servidor.close(cerrar));
  }
};

describe('rutas del SENDER eliminadas', () => {
  test('responder 404 en GET /fetchUnsentReports, aunque se envíe una clave interna', async () => {
    expect(await pedir('GET', '/fetchUnsentReports?size=1')).toEqual({
      status: 404,
      cuerpo: { error: 'Ruta no encontrada.' },
    });
  });

  test('responder 404 en POST /repostToDGA, aunque se envíe una clave interna', async () => {
    expect(await pedir('POST', '/repostToDGA', { id: 1 })).toEqual({
      status: 404,
      cuerpo: { error: 'Ruta no encontrada.' },
    });
  });
});
