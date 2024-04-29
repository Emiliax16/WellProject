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
  createWell,
  addDataToWell,
}
