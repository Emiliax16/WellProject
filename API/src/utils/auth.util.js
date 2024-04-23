const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const BCRYPT_SALT_ROUNDS = process.env.BCRYPT_SALT_ROUNDS || 10;

function generateToken(user) {
  const payload = {
    id: user.id,
    type: user.getRole().type,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

function decodeToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('Error decoding token:', error);
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
