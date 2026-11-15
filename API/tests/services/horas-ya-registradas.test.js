// horas-ya-registradas.test.js
//
// La DGA guarda una sola medición por obra, fecha y hora. Los pozos reportan
// más de una vez por hora, así que el segundo reporte de cada hora se enviaba
// solo para recibir el rechazo "Ya existe un registro". El documento de
// transmisión de la DGA (§6.3) advierte que retransmitir mediciones ya
// recibidas puede bloquear al centro de control.
//
// Ahora, antes de enviar, se busca otro reporte de la misma obra, fecha y hora
// que ya esté enviado. Si existe, no se envía y se marca como enviado. Si no
// existe, incluido el caso en que el primero de la hora falló, se envía igual
// que antes.
//
// Sin red ni base: el cliente de la DGA va mockeado y la consulta se espía
// sobre el modelo real.

const mockPost = jest.fn();

jest.mock('axios', () => ({
  create: () => ({ post: (...a) => mockPost(...a) }),
  post: jest.fn(),
}));

const { Sequelize, DataTypes, Op } = require('sequelize');
const processAndPostData = require('../../src/services/wellData/handleSendData.service');
const WellData = require('../../models/welldata')(new Sequelize({ dialect: 'postgres' }), DataTypes);

const POZO = {
  toJSON: () => ({
    code: 'OB-1304-1749',
    rutEmpresa: '76123456-7',
    rutUsuario: '12345678-9',
    password: 'clave-del-mop',
  }),
};

const hacerReporte = (campos = {}) => {
  const reporte = WellData.build({
    id: 200,
    code: 'OB-1304-1749',
    date: '15/11/2026',
    hour: '15:42',
    totalizador: 1200,
    caudal: 3.5,
    nivel_freatico: 12.4,
    sent: false,
    ...campos,
  });
  jest.spyOn(reporte, 'update').mockResolvedValue(reporte);
  return reporte;
};

let findOne;

beforeEach(() => {
  jest.clearAllMocks();
  findOne = jest.spyOn(WellData, 'findOne').mockResolvedValue(null);
  mockPost.mockResolvedValue({ data: { status: '00', message: 'Medición subterranea ingresada correctamente' } });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('processAndPostData cuando la hora ya está enviada', () => {
  it('omite el envío y marca como enviado el segundo reporte de una hora ya registrada', async () => {
    findOne.mockResolvedValue({ id: 199 });
    const reporte = hacerReporte();

    await expect(processAndPostData(reporte, POZO)).resolves.toBe(true);

    expect(mockPost).not.toHaveBeenCalled();
    expect(reporte.update).toHaveBeenCalledWith(
      expect.objectContaining({ sent: true, sentDate: expect.any(String) })
    );
  });

  it('busca un reporte enviado de la misma obra y fecha, en la misma hora, distinto del actual', async () => {
    await processAndPostData(hacerReporte(), POZO);

    const { where } = findOne.mock.calls[0][0];
    expect(where).toMatchObject({ code: 'OB-1304-1749', date: '15/11/2026', sent: true });
    expect(where.id).toEqual({ [Op.ne]: 200 });
    expect(where[Op.or]).toEqual([{ hour: { [Op.like]: '15:%' } }]);
  });

  it('considera las dos formas de escribir una hora menor a 10', async () => {
    await processAndPostData(hacerReporte({ hour: '09:58' }), POZO);

    expect(findOne.mock.calls[0][0].where[Op.or]).toEqual([
      { hour: { [Op.like]: '09:%' } },
      { hour: { [Op.like]: '9:%' } },
    ]);
  });

  it('reconoce la hora con segundos', async () => {
    await processAndPostData(hacerReporte({ hour: '15:42:10' }), POZO);

    expect(findOne.mock.calls[0][0].where[Op.or]).toEqual([{ hour: { [Op.like]: '15:%' } }]);
  });
});

describe('processAndPostData cuando la hora no está enviada', () => {
  it('envía el primer reporte de una hora', async () => {
    const reporte = hacerReporte({ hour: '16:13' });

    await expect(processAndPostData(reporte, POZO)).resolves.toBe(true);

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(reporte.update).toHaveBeenCalledWith(expect.objectContaining({ sent: true }));
  });

  it('busca solo reportes enviados, para que un primer reporte fallido no tape la hora', async () => {
    // Si la búsqueda no exigiera `sent: true`, el primer reporte de la hora,
    // aunque hubiera fallado, impediría enviar el segundo y la hora quedaría
    // sin medición en la DGA.
    findOne.mockResolvedValue(null);
    const reporte = hacerReporte();

    await processAndPostData(reporte, POZO);

    expect(findOne.mock.calls[0][0].where.sent).toBe(true);
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('envía el reporte si su hora no tiene un formato reconocible, sin consultar la base', async () => {
    const reporte = hacerReporte({ hour: 'mediodía' });
    mockPost.mockRejectedValue(Object.assign(new Error('Request failed with status code 400'), {
      response: { status: 400, data: { status: '400', message: 'Formato de hora inválido', data: null } },
    }));

    await expect(processAndPostData(reporte, POZO)).rejects.toThrow();

    expect(findOne).not.toHaveBeenCalled();
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('sigue fallando igual si la DGA rechaza el envío por otro motivo', async () => {
    mockPost.mockRejectedValue(Object.assign(new Error('Request failed with status code 400'), {
      response: { status: 400, data: { status: '400', message: 'Credenciales inválidas', data: null } },
    }));
    const reporte = hacerReporte();

    await expect(processAndPostData(reporte, POZO)).rejects.toThrow();

    expect(reporte.update).not.toHaveBeenCalled();
  });
});

describe('processAndPostData con un reporte que ya está enviado', () => {
  it('no lo vuelve a transmitir si alguien lo reenvía', async () => {
    const reporte = hacerReporte({ sent: true });

    await expect(processAndPostData(reporte, POZO)).resolves.toBe(true);

    expect(mockPost).not.toHaveBeenCalled();
    expect(findOne).not.toHaveBeenCalled();
    expect(reporte.update).not.toHaveBeenCalled();
  });
});

describe('processAndPostData si falla la consulta de la hora', () => {
  it('no envía el reporte y propaga el error, para reintentarlo después', async () => {
    // Falla cerrado: ante la duda, no se retransmite.
    findOne.mockRejectedValue(new Error('connection terminated'));
    const reporte = hacerReporte();

    await expect(processAndPostData(reporte, POZO)).rejects.toThrow('connection terminated');

    expect(mockPost).not.toHaveBeenCalled();
    expect(reporte.update).not.toHaveBeenCalled();
  });
});
