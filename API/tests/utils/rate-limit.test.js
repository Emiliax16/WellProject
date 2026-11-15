// rate-limit.test.js
//
// Limitador en memoria por clave, con ventana fija. Lo usan el login (por
// cuenta) y el formulario de contacto (global).

const crearLimitador = require('../../src/utils/rate-limit.util');

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-11-15T12:00:00Z') });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('crearLimitador', () => {
  it('bloquea la clave al llegar al máximo dentro de la ventana', () => {
    const limitador = crearLimitador({ maximo: 3, ventanaMs: 60_000 });

    limitador.registrar('a');
    limitador.registrar('a');
    expect(limitador.bloqueado('a')).toBe(false);

    limitador.registrar('a');
    expect(limitador.bloqueado('a')).toBe(true);
  });

  it('desbloquea la clave cuando termina la ventana', () => {
    const limitador = crearLimitador({ maximo: 1, ventanaMs: 60_000 });
    limitador.registrar('a');

    jest.advanceTimersByTime(59_999);
    expect(limitador.bloqueado('a')).toBe(true);

    jest.advanceTimersByTime(1);
    expect(limitador.bloqueado('a')).toBe(false);
  });

  it('cuenta cada clave por separado', () => {
    const limitador = crearLimitador({ maximo: 1, ventanaMs: 60_000 });
    limitador.registrar('a');

    expect(limitador.bloqueado('a')).toBe(true);
    expect(limitador.bloqueado('b')).toBe(false);
  });

  it('olvida la clave al reiniciarla', () => {
    const limitador = crearLimitador({ maximo: 1, ventanaMs: 60_000 });
    limitador.registrar('a');

    limitador.reiniciar('a');

    expect(limitador.bloqueado('a')).toBe(false);
  });

  it('no guarda más claves que el máximo, aunque lleguen muchas distintas', () => {
    const limitador = crearLimitador({ maximo: 5, ventanaMs: 60_000, maxClaves: 100 });

    for (let i = 0; i < 1000; i += 1) limitador.registrar(`clave-${i}`);

    expect(limitador.cantidadDeClaves()).toBeLessThanOrEqual(100);
  });

  it('libera primero las claves vencidas al hacer espacio', () => {
    const limitador = crearLimitador({ maximo: 1, ventanaMs: 60_000, maxClaves: 2 });
    limitador.registrar('vieja');
    jest.advanceTimersByTime(60_000);
    limitador.registrar('reciente');

    limitador.registrar('nueva');

    expect(limitador.bloqueado('reciente')).toBe(true);
    expect(limitador.bloqueado('nueva')).toBe(true);
  });
});
