const dotenv = require('dotenv');
const moment = require('moment-timezone');
const xml2js = require('xml2js');
const axios = require('axios');
const ErrorHandler = require('../../utils/error.util');
const { wellDataHasInvalidData } = require('../../utils/errorcodes.util');

dotenv.config();

const URL_ENDPOINT = "https://snia.mop.gob.cl/controlextraccion/datosExtraccion/SendDataExtraccionService";
const SOAP_ACTION = "http://www.mop.cl/controlextraccion/wsdl/datosExtraccion/authSendDataExtraccionOp";

const fixNumberFormat = (number) => {
  if (typeof number !== 'number') {
    return number;
  }
  const fixedNumber = number.toFixed(2);
  return fixedNumber;
}

const formatRequest = async (data) => {
  try {
    const builder = new xml2js.Builder({ headless: true, rootName: 'soapenv:Envelope', renderOpts: { pretty: false } });
    const xml = builder.buildObject({
        $: {
            'xmlns:soapenv': 'http://schemas.xmlsoap.org/soap/envelope/',
            'xmlns:aut1': 'http://www.mop.cl/controlextraccion/xsd/datosExtraccion/AuthSendDataExtraccionRequest',
        },
        'soapenv:Header': {
            'aut1:authSendDataExtraccionTraza': {
                'aut1:codigoDeLaObra': data.code,
                'aut1:timeStampOrigen': moment().utc().format("YYYY-MM-DDTHH:mm:ss[Z]"),
            },
        },
        'soapenv:Body': {
            'aut1:authSendDataExtraccionRequest': {
                'aut1:authDataUsuario': {
                    'aut1:idUsuario': {
                        'aut1:rut': data.rut,
                    },
                    'aut1:password': data.password,
                },
                'aut1:authDataExtraccionSubterranea': {
                    'aut1:fechaMedicion': data.date,
                    'aut1:horaMedicion': data.hour,
                    'aut1:totalizador': data.totalizador,
                    'aut1:caudal': fixNumberFormat(data.caudal),
                    'aut1:nivelFreaticoDelPozo': fixNumberFormat(data.nivel_freatico),
                },
            },
        },
    });
    console.log("---- XML ----\n", xml);
    return xml;
  } catch (error) {
    throw error;
  }
}

const postToDga = async (data) => {
  try {
    const response = await axios.post(URL_ENDPOINT, data, {
        headers: {
            'Content-Type': 'text/xml',
            'SOAPAction': SOAP_ACTION,
        },
    });

    const parsedResponse = await xml2js.parseStringPromise(response.data);
    return parsedResponse;
  } catch (error) {
    if (error.response) {
      console.log('Error Response Status:', error.response.status);
      console.log('Datos de respuesta ERRONEA:', error.response.data);
    }
  }
}

const checkValidResponse = (response) => {
  let breakIteration = false;

  if (!response || !response['soapenv:Envelope'] || !response['soapenv:Envelope']['soapenv:Body']) {
    return false;
  }

  response['soapenv:Envelope']['soapenv:Body']?.forEach((body) => {
    body["authSendDataExtraccionResponse"]?.forEach((body2) => {
      body2["status"]?.forEach((state) => {
        state["Code"]?.forEach((code) => {
          if (code !== "0") {
            console.log('Tenemos un code no válido');
            breakIteration = true;
            return false;
          }
        })
      })
    })
  })
  if (breakIteration) return false;
  return true;
}

const processAndPostData = async (wellData) => {
  const data = {
    ...wellData,
    rut: process.env.DGA_RUT,
    password: process.env.DGA_PASSWORD,
    timeStampOrigen: moment().tz('America/Santiago').format(),
  }

  try {
    const formattedData = await formatRequest(data);
    const response = await postToDga(formattedData);
    const responseString = JSON.stringify(response, null, 2);
    console.log('---- DGA RESPUESTA ----\n', responseString);

    // no recibir respuesta es sinonimo de timeout
    if (!response) return false;

    if (!checkValidResponse(response)) throw new ErrorHandler(wellDataHasInvalidData);

    await wellData.update({ sent: true, sentDate: new moment().tz('America/Santiago').format() })
  } catch (error) {
    throw error;
  }
}

/* Data DUMMY -- no borrar todavía
const exampleData = {
  code: "OB-0902-639",
  date: "12-09-2024",
  hour: "11:00:00",
  totalizador: 354,
  caudal: 0,
  nivel_freatico: 36.42
}
processAndPostData(exampleData); */

module.exports = processAndPostData;
