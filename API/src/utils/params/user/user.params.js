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
  fullName: {
    type: 'string',
    required: true,
  },
  location: {
    type: 'string',
    required: true,
  },
  phoneNumber: {
    type: 'string',
    required: true,
  },
  name: {
    type: 'string',
    required: true,
  },
  email: {
    type: 'string',
    required: true,
  },
  personalEmail: {
    type: 'string',
    required: false,
  },
  encrypted_password: {
    type: 'string',
    required: true,
  },
  roleId: {
    type: 'integer',
    required: true,
  },
  isActived: {
    type: 'boolean',
    required: true,
  },
  companyLogo: {
    type: 'string',
    required: false,
  },
  companyRut: {
    type: 'string',
    required: true,
  },
  recoveryEmail: {
    type: 'string',
    required: false,
  }
}

module.exports = {
  loginParams,
  registerParams,
}