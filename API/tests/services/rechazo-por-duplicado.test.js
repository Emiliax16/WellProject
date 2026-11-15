// rechazo-por-duplicado.test.js
//
// La DGA guarda una sola medición por obra, fecha y hora, y rechaza las
// siguientes con un 400 "Ya existe un registro en esa fecha, hora para la obra".
// Los pozos envían más de un reporte por hora, así que el segundo siempre recibe
// ese rechazo aunque la hora quedó registrada. Esos reportes quedaban como no
// enviados para siempre; ahora cuentan como enviados.
//
// El resto de los rechazos (credenciales, formato, timeouts, errores del
// servidor de la DGA) tiene que seguir fallando igual que antes.
//
// Sin red: el cliente HTTP de la DGA va mockeado.

const mockPost = jest.fn();

jest.mock('axios', () => ({
  create: () => ({ post: (...a) => mockPost(...a) }),
  post: jest.fn(),
}));

const processAndPostData = require('../../src/services/wellData/handleSendData.service');

const hacerReporte = () => ({
  id: 99650,
  code: 'OB-1304-1749',
  date: '14/11/2026',
  hour: '22:31:00',
  toJSON() {
    return {
      id: 99650,
      code: 'OB-1304-1749',
      date: '14/11/2026',
      hour: '22:31:00',
      totalizador: 1200,
      caudal: 3.5,
      nivel_freatico: 12.4,
    };
  },
  update: jest.fn().mockResolvedValue(undefined),
});

const POZO = {
  toJSON: () => ({
    code: 'OB-1304-1749',
    rutEmpresa: '76123456-7',
    rutUsuario: '12345678-9',
    password: 'clave-del-mop',
  }),
};

// Lo que axios lanza cuando la DGA responde con un status de error.
const rechazoHttp = (status, data) => Object.assign(new Error(`Request failed with status code ${status}`), {
  response: { status, data },
});

const RECHAZO_DUPLICADO = {
  status: '400',
  message: 'Ya existe un registro en esa fecha, hora para la obra. Comprobante: FftIxl9AfqEO7erAEqOcFz2fi75sMaRQ',
  data: null,
};

let logs;

beforeEach(() => {
  jest.clearAllMocks();
  logs = [];
  jest.spyOn(console, 'log').mockImplementation((...a) => logs.push(a.join(' ')));
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('processAndPostData frente a las respuestas de la DGA', () => {
  it('marca como enviado un reporte aceptado por la DGA', async () => {
    mockPost.mockResolvedValue({ data: { status: '00', message: 'Medición subterranea ingresada correctamente' } });
    const reporte = hacerReporte();

    await expect(processAndPostData(reporte, POZO)).resolves.toBe(true);

    expect(reporte.update).toHaveBeenCalledWith(expect.objectContaining({ sent: true }));
  });

  it('marca como enviado un reporte que la DGA rechaza porque ya tiene esa hora', async () => {
    mockPost.mockRejectedValue(rechazoHttp(400, RECHAZO_DUPLICADO));
    const reporte = hacerReporte();

    await expect(processAndPostData(reporte, POZO)).resolves.toBe(true);

    expect(reporte.update).toHaveBeenCalledWith(
      expect.objectContaining({ sent: true, sentDate: expect.any(String) })
    );
  });

  it('registra en el log el mensaje de la DGA en vez de "sin mensaje"', async () => {
    mockPost.mockRejectedValue(rechazoHttp(400, RECHAZO_DUPLICADO));

    await processAndPostData(hacerReporte(), POZO);

    expect(logs.join('\n')).toContain('Ya existe un registro en esa fecha, hora para la obra');
    expect(logs.join('\n')).toContain('se marca como enviado');
  });

  it('tolera espacios alrededor del mensaje de duplicado', async () => {
    mockPost.mockRejectedValue(rechazoHttp(400, { ...RECHAZO_DUPLICADO, message: `  ${RECHAZO_DUPLICADO.message}\n` }));
    const reporte = hacerReporte();

    await expect(processAndPostData(reporte, POZO)).resolves.toBe(true);
  });

  it('rechaza un 400 por otro motivo, como credenciales inválidas', async () => {
    mockPost.mockRejectedValue(rechazoHttp(400, { status: '400', message: 'Credenciales inválidas', data: null }));
    const reporte = hacerReporte();

    await expect(processAndPostData(reporte, POZO)).rejects.toThrow(
      'No se pudo enviar los datos a la DGA. Por favor revisa bien los parámetros que estás enviando'
    );
    expect(reporte.update).not.toHaveBeenCalled();
  });

  it('rechaza un 400 cuyo mensaje solo menciona que algo ya existe', async () => {
    mockPost.mockRejectedValue(rechazoHttp(400, { status: '400', message: 'Ya existe un usuario con ese RUT', data: null }));
    const reporte = hacerReporte();

    await expect(processAndPostData(reporte, POZO)).rejects.toThrow();
    expect(reporte.update).not.toHaveBeenCalled();
  });

  it('rechaza el mensaje de duplicado si llega con un status distinto de 400', async () => {
    mockPost.mockRejectedValue(rechazoHttp(500, RECHAZO_DUPLICADO));
    const reporte = hacerReporte();

    await expect(processAndPostData(reporte, POZO)).rejects.toThrow();
    expect(reporte.update).not.toHaveBeenCalled();
  });

  it('rechaza un 400 sin cuerpo', async () => {
    mockPost.mockRejectedValue(rechazoHttp(400, undefined));
    const reporte = hacerReporte();

    await expect(processAndPostData(reporte, POZO)).rejects.toThrow();
    expect(reporte.update).not.toHaveBeenCalled();
  });

  it('rechaza un timeout de la DGA', async () => {
    mockPost.mockRejectedValue(Object.assign(new Error('timeout of 12000ms exceeded'), { code: 'ECONNABORTED' }));
    const reporte = hacerReporte();

    await expect(processAndPostData(reporte, POZO)).rejects.toThrow();
    expect(reporte.update).not.toHaveBeenCalled();
  });

  it('rechaza una respuesta 200 sin el status de éxito de la DGA', async () => {
    mockPost.mockResolvedValue({ data: { status: '99', message: 'Error desconocido' } });
    const reporte = hacerReporte();

    await expect(processAndPostData(reporte, POZO)).rejects.toThrow();
    expect(reporte.update).not.toHaveBeenCalled();
  });
});
