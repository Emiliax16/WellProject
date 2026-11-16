const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const BCRYPT_SALT_ROUNDS = process.env.BCRYPT_SALT_ROUNDS || 10;

async function generateToken(user) {
  const { type } = await user.getRole();
  const payload = {
    id: user.id,
    type: type,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

function decodeToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    // Un token vencido o inválido es algo normal, no un error del servidor: se
    // registra en una sola línea, sin el stack. El mensaje distingue causas que
    // conviene separar (token vencido, firma inválida, secreto ausente) y no
    // incluye el token.
    console.warn(`[auth] token rechazado: ${error.name}: ${error.message}`);
    return null;
  }
}

async function hashPassword(password) {
  try {
    return await bcrypt.hash(password, 10);
  } catch (error) {
    throw new Error('Hubo un error hasheando la contraseña.', error);
  }
}

async function comparePassword(password, hash) {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error('Hubo un error comprobando la contraseña.', error);
    return false;
  }
}

module.exports = {
  generateToken,
  decodeToken,
  hashPassword,
  comparePassword
};
