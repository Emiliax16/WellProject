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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

function decodeToken(token) {
  try {
    console.log("checking")
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
