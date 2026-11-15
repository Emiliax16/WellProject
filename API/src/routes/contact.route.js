require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer'); // librería pa enviar el correo info@promedicion.cl (desde la landingpage por el momento)
const crearLimitador = require('../utils/rate-limit.util');
const router = express.Router();

// Las credenciales es el correo y contraseña info@promedicion.cl
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// La ruta es pública y despacha desde la cuenta de Gmail que también envía las
// alertas de pozos. Sin límite, cualquiera podía agotar su cuota diaria o hacer
// que Google la bloquee, y con eso dejarían de llegar las alertas (issue #66).
//
// El límite es global y no por IP, porque Nginx no reenvía la IP del cliente.
// Para el tráfico de un formulario de contacto, 10 correos por hora sobra.
const enviosDeContacto = crearLimitador({ maximo: 10, ventanaMs: 60 * 60 * 1000 });
const CLAVE_GLOBAL = 'contacto';

const LARGO_MAXIMO = { name: 100, email: 254, message: 5000 };
const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Devuelve los campos limpios o `null` si alguno no es válido. Los saltos de
// línea del nombre se quitan porque va en el asunto del correo.
const camposValidos = ({ name, email, message } = {}) => {
    if ([name, email, message].some((campo) => typeof campo !== 'string')) return null;
    const limpio = {
        name: name.replace(/[\r\n]+/g, ' ').trim(),
        email: email.trim(),
        message: message.trim(),
    };
    if (!limpio.name || !limpio.message || !FORMATO_CORREO.test(limpio.email)) return null;
    if (Object.entries(LARGO_MAXIMO).some(([campo, maximo]) => limpio[campo].length > maximo)) return null;
    return limpio;
};

router.post('/send-email', (req, res) => {
    const campos = camposValidos(req.body);
    if (!campos) {
        return res.status(400).send({ success: false, error: 'Revisa el nombre, el correo y el mensaje.' });
    }
    if (enviosDeContacto.bloqueado(CLAVE_GLOBAL)) {
        return res.status(429).send({ success: false, error: 'Se recibieron demasiados mensajes. Intenta de nuevo más tarde.' });
    }
    enviosDeContacto.registrar(CLAVE_GLOBAL);

    const { name, email, message } = campos;
    // Por el momento, el correo se enviará desde y hacia info@promedicion
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: `Formulario de contacto enviado por ${name}`,
        text: `Has recibido un nuevo mensaje de ${name}, correo: (${email}):\n\n${message}`
    };

    transporter.sendMail(mailOptions, (error) => {
        if (error) {
            // El detalle va al log y no a la respuesta: el mensaje de nodemailer
            // puede incluir datos de la cuenta o del servidor de correo.
            console.error(`[contacto] no se pudo enviar el correo: ${error.message}`);
            return res.status(500).send({ success: false, error: 'No se pudo enviar el mensaje.' });
        }
        res.send({ success: true, message: 'Correo enviado exitosamente' });
    });
});

// Solo para tests: permite reiniciar el límite entre casos.
router._enviosDeContacto = enviosDeContacto;

module.exports = router;
