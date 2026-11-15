// contacto.test.js
//
// `POST /send-email` es público y despacha desde la cuenta de Gmail que también
// envía las alertas de pozos. No tenía límite ni validación, y respondía el
// mensaje de error de nodemailer (issue #66). Sin red: nodemailer va mockeado.

const mockSendMail = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: () => ({ sendMail: (...a) => mockSendMail(...a) }),
}));

const router = require('../../src/routes/contact.route');

const capa = router.stack.find((l) => l.route && l.route.path === '/send-email' && l.route.methods.post);
const handler = capa.route.stack[0].handle;

const VALIDO = { name: 'Ana Pérez', email: 'ana@ejemplo.cl', message: 'Quiero cotizar telemetría para dos pozos.' };

const enviar = (body) => new Promise((resolve) => {
  const res = {
    statusCode: 200,
    status(c) { this.statusCode = c; return this; },
    send(b) { this.cuerpo = b; resolve(this); return this; },
  };
  handler({ body }, res);
});

let silenciarError;

beforeEach(() => {
  jest.clearAllMocks();
  router._enviosDeContacto?.reiniciar('contacto');
  mockSendMail.mockImplementation((opciones, callback) => callback(null, {}));
  silenciarError = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  silenciarError.mockRestore();
});

describe('POST /send-email', () => {
  it('envía un mensaje válido', async () => {
    const res = await enviar(VALIDO);

    expect(res.statusCode).toBe(200);
    expect(res.cuerpo).toEqual({ success: true, message: 'Correo enviado exitosamente' });
    expect(mockSendMail.mock.calls[0][0].text).toContain('Quiero cotizar telemetría para dos pozos.');
  });

  it.each([
    ['sin nombre', { ...VALIDO, name: '' }],
    ['sin mensaje', { ...VALIDO, message: '   ' }],
    ['con un correo inválido', { ...VALIDO, email: 'no-es-correo' }],
    ['con un mensaje demasiado largo', { ...VALIDO, message: 'a'.repeat(5001) }],
    ['con un campo que no es texto', { ...VALIDO, name: { $ne: null } }],
    ['sin cuerpo', undefined],
  ])('rechaza un envío %s sin despachar correo', async (_caso, body) => {
    const res = await enviar(body);

    expect(res.statusCode).toBe(400);
    expect(res.cuerpo).toEqual({ success: false, error: 'Revisa el nombre, el correo y el mensaje.' });
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('quita los saltos de línea del nombre, que va en el asunto', async () => {
    await enviar({ ...VALIDO, name: 'Ana\r\nBcc: otro@ejemplo.cl' });

    expect(mockSendMail.mock.calls[0][0].subject).toBe('Formulario de contacto enviado por Ana Bcc: otro@ejemplo.cl');
  });

  it('rechaza el envío número 11 dentro de una hora', async () => {
    for (let i = 0; i < 10; i += 1) await enviar(VALIDO);

    const res = await enviar(VALIDO);

    expect(res.statusCode).toBe(429);
    expect(res.cuerpo.error).toBe('Se recibieron demasiados mensajes. Intenta de nuevo más tarde.');
    expect(mockSendMail).toHaveBeenCalledTimes(10);
  });

  it('no cuenta los envíos inválidos para el límite', async () => {
    for (let i = 0; i < 20; i += 1) await enviar({ ...VALIDO, email: 'malo' });

    const res = await enviar(VALIDO);

    expect(res.statusCode).toBe(200);
  });

  it('no devuelve el mensaje de error de nodemailer', async () => {
    mockSendMail.mockImplementation((opciones, callback) => callback(new Error('Invalid login: 535-5.7.8 Username and Password not accepted')));

    const res = await enviar(VALIDO);

    expect(res.statusCode).toBe(500);
    expect(res.cuerpo).toEqual({ success: false, error: 'No se pudo enviar el mensaje.' });
  });
});
