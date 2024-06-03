const dotenv = require('dotenv');
const moment = require('moment-timezone');
const xml2js = require('xml2js');
const axios = require('axios');
dotenv.config();

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
              'aut1:timeStampOrigen': data.timeStampOrigen,
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
        return xml;
    } catch (error) {
        console.log(error);
    }
}



const postToDga = async (data) => {
    const realEndpoint = 'https://snia.mop.gob.cl/controlextraccion/wsdl/datosExtraccion/SendDataExtraccionService'
    try {
        const response = await axios.post(realEndpoint, data, {
            headers: {
                'Content-Type': 'text/xml',
                'soapAction': 'http://www.mop.cl/controlextraccion/wsdl/datosExtraccion/authSendDataExtraccionOp',
            },
        });
        const parsedResponse = await xml2js.parseStringPromise(response)
        return parsedResponse;
    } catch (error) {
        console.log(error);
    }
}

const handleData = async (wellData) => {
    const data = {
        ...wellData,
        rut: process.env.DGA_RUT,
        password: process.env.DGA_PASSWORD,
        timeStampOrigen: moment().tz('America/Santiago').format(),
    }

    try {

        const formattedData = await formatRequest(data);
        const response = await postToDga(formattedData);
        console.log(response);
    } catch (error) {
        console.log(error);
    }
}

const exampleData = {
    code: "TEST12345",
    date: "12-09-2027", 
    hour: "12:31:00",
    totalizador: 5,
    caudal: 1,
    nivel_freatico: 5.8
}
handleData(exampleData)
