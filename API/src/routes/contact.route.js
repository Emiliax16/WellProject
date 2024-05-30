require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer'); // librería pa enviar el correo info@promedicion.cl (desde la landingpage por el momento)
const router = express.Router();

// Las credenciales es el correo y contraseña info@promedicion.cl
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

router.post('/send-email', (req, res) => {
    const { name, email, message } = req.body;
    // Por el momento, el correo se enviará desde y hacia info@promedicion
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: `Formulario de contacto enviado por ${name}`,
        text: `Has recibido un nuevo mensaje de ${name}, correo: (${email}):\n\n${message}`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return res.status(500).send({ success: false, error: error.message });
        }
        res.send({ success: true, message: 'Correo enviado exitosamente' });
    });
});

module.exports = router;
