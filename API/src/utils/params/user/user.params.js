const loginParams = {
  email: {
    type: 'string',
    required: true,
  },
  password: {
    type: 'string',
    required: true,
  },
}

const registerParams = {
  name: {
    type: 'string',
    required: true,
  },
  email: {
    type: 'string',
    required: true,
  },
  encrypted_password: {
    type: 'string',
    required: true,
  },
  roleId: {
    type: 'integer',
    required: true,
  },
  status: {
    type: 'boolean',
    required: true,
  }, 
}

module.exports = {
  loginParams,
  registerParams,
}