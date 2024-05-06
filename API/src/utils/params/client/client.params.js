const editDataOfClient = {
  //      PERSON DATA
  id: {
    type: 'integer',
    forbidden: true,
  },
  createdAt:{
    type: 'string',
    forbidden: true,
  },
  updatedAt:{
    type: 'string',
    forbidden: true,
  },
  fullName: {
    type: 'string',
    required: false,
  },
  personalEmail: {
    type: 'string',
    required: false,
  },
  phoneNumber: {
    type: 'string',
    required: false,
  },
  location: {
    type: 'string',
    required: false,
  },
  userId: {
    type: 'integer',
    forbidden: true,
  },
  //      USER DATA
  name: {
    type: 'string',
    required: false,
  },
  email: {
    type: 'string',
    required: false,
  },
  encrypted_password: {
    type: 'string',
    required: false,
  },
  roleId: {
    type: 'integer',
    required: false,
  },
  isActived: {
    type: 'boolean',
    required: false,
  },
  //     CLIENT PARAMS (to change their password)
  newPassword: {
    type: 'string',
    required: false,
  },
  oldPassword: {
    type: 'string',
    required: false,
  },
}

const createWell = {
  name: {
    type: 'string',
    required: true,
  },
  isActived: {
    type: 'boolean',
    required: false,
  },
  code: {
    type: 'string',
    required: true,
  }, 
  location: {
    type: 'string',
    required: true,
  },
}

const addDataToWell = {
  code: {
    type: 'string',
    required: true,
  },
  date: {
    type: 'string',
    required: true,
  },
  hour: {
    type: 'string',
    required: true,
  },
  totalizador: {
    type: 'integer',
    required: true,
  },
  caudal: {
    type: 'integer',
    required: true,
  },
  nivel_freatico: {
    type: 'integer',
    required: true,
  },
}

module.exports = {
  editDataOfClient,
  createWell,
  addDataToWell,
}
