const dotenv = require("dotenv");
const moment = require("moment-timezone");
const xml2js = require("xml2js");
const axios = require("axios");
const ErrorHandler = require("../../utils/error.util");
const { couldntPostToDga } = require("../../utils/errorcodes.util");

dotenv.config();

const URL_ENDPOINT_V2 =
  "https://apimee.mop.gob.cl/api/v1/mediciones/subterraneas";

const fixNumberFormat = (number) => {
  if (typeof number !== "number") {
    return number;
  }
  const fixedNumber = number.toFixed(2);
  return fixedNumber;
};

/**
 * @description Procesa los datos de un pozo y los envía a la DGA
 */
const processAndPostData = async (wellData, well) => {
  try {
    const data = {...wellData, ...well}
    const formatedData = await formaDataV2(data);
    const response = await postToDgaV2(formatedData, wellData.code);
    console.log("Response from DGA:", response.data);
    if (!checkValidResponseV2(response))
      throw new ErrorHandler(couldntPostToDga);
    await wellData.update({
      sent: true,
      sentDate: new moment().tz("America/Santiago").format(),
    });
  } catch (error) {
    throw error;
  }
};

/**
 * @description Formatea los datos del pozo (`data`) al formato requerido por la DGA.
 * @param {Object} data - Datos originales del pozo junto con credenciales de autenticación.
 * @param {string} data.code - Código identificador del pozo.
 * @param {string} data.date - Fecha de medición en formato "DD/MM/YYYY".
 * @param {string} data.hour - Hora de medición en formato "HH:mm:ss".
 * @param {number} data.totalizador - Valor del totalizador del pozo.
 * @param {number} data.caudal - Caudal medido en la fecha y hora indicadas.
 * @param {number} data.nivel_freatico - Nivel freático del pozo en la medición.
 * @returns {Object} - Retorna un objeto JSON formateado listo para ser enviado a la DGA.
 */
const formaDataV2 = async (data) => {
  return {
    autenticacion: {
      rutEmpresa: data.rutEmpresa,
      password: data.password,
      rutUsuario: data.rutUsuario,
    },
    medicionSubterranea: {
      caudal: data.caudal.toString(),
      fechaMedicion: moment(data.date, "DD/MM/YYYY").format("YYYY-MM-DD"),
      horaMedicion: data.hour,
      nivelFreaticoDelPozo: fixNumberFormat(data.nivel_freatico.toString()),
      totalizador: fixNumberFormat(data.totalizador.toString()),
    },
  };
};

/**
 * @description Envía los datos formateados de medición subterránea a la DGA utilizando el nuevo endpoint.
 * @param {Object} formattedData - Datos formateados listos para ser enviados a la DGA.
 * @param {string} codigoObra - Código identificador de la obra.
 * @returns {Object} - Respuesta del servidor de la DGA.
 */
const postToDgaV2 = async (formattedData, codigoObra) => {
  try {
    if (!formattedData || typeof formattedData !== "object" || !codigoObra) {
      throw new ErrorHandler(couldntPostToDga);
    }
    const response = await axios.post(URL_ENDPOINT_V2, formattedData, {
      headers: {
        "Content-Type": "application/json",
        codigoObra: codigoObra,
        timeStampOrigen: moment()
          .tz("America/Santiago")
          .format("YYYY-MM-DDTHH:mm:ssZ"),
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error al enviar datos a la DGA:", error.message);

    if (error.response) {
      console.error("Status de respuesta:", error.response.status);
      console.error("Datos de respuesta ERRONEA:", error.response.data);
      return {
        error: true,
        status: error.response.status,
        data: error.response.data,
      };
    }

    return { error: true, message: error.message };
  }
};

/**
 * @description Verifica si la respuesta de la DGA es válida y exitosa.
 * @param {Object} response - Respuesta de la DGA.
 * @returns {boolean} - `true` si la respuesta es válida y exitosa, `false` en caso contrario.
 */
const checkValidResponseV2 = (response) => {
  if (!response || typeof response !== "object") return false;

  if (response.error) return false; // Manejo de errores de `postToDgaV2`

  return response.status === "00";
};

/**
 * @description Metodo antiguo para enviar datos a la DGA.
 * !! Deprecated !!
 */
const postToDga = async (data) => {
  try {
    const response = await axios.post(URL_ENDPOINT, data, {
      headers: {
        "Content-Type": "text/xml",
        SOAPAction: SOAP_ACTION,
      },
    });

    const parsedResponse = await xml2js.parseStringPromise(response.data);
    return parsedResponse;
  } catch (error) {
    if (error.response) {
      console.log("Error Response Status:", error.response.status);
      console.log("Datos de respuesta ERRONEA:", error.response.data);
    }
  }
};

/**
 * @description Verifica si la respuesta de la DGA es válida.
 * !! Deprecated !!
 */
const checkValidResponse = (response) => {
  let breakIteration = false;

  if (
    !response ||
    !response["soapenv:Envelope"] ||
    !response["soapenv:Envelope"]["soapenv:Body"]
  ) {
    return false;
  }

  response["soapenv:Envelope"]["soapenv:Body"]?.forEach((body) => {
    body["authSendDataExtraccionResponse"]?.forEach((body2) => {
      body2["status"]?.forEach((state) => {
        state["Code"]?.forEach((code) => {
          if (code !== "0") {
            console.log("Tenemos un code no válido");
            breakIteration = true;
            return false;
          }
        });
      });
    });
  });
  if (breakIteration) return false;
  return true;
};

/**
 * @description Verifica si la respuesta de la DGA es válida.
 * !! Deprecated !!
 */
const formatRequest = async (data) => {
  try {
    const builder = new xml2js.Builder({
      headless: true,
      rootName: "soapenv:Envelope",
      renderOpts: { pretty: false },
    });
    const xml = builder.buildObject({
      $: {
        "xmlns:soapenv": "http://schemas.xmlsoap.org/soap/envelope/",
        "xmlns:aut1":
          "http://www.mop.cl/controlextraccion/xsd/datosExtraccion/AuthSendDataExtraccionRequest",
      },
      "soapenv:Header": {
        "aut1:authSendDataExtraccionTraza": {
          "aut1:codigoDeLaObra": data.code,
          "aut1:timeStampOrigen": moment()
            .utc()
            .format("YYYY-MM-DDTHH:mm:ss[Z]"),
        },
      },
      "soapenv:Body": {
        "aut1:authSendDataExtraccionRequest": {
          "aut1:authDataUsuario": {
            "aut1:idUsuario": {
              "aut1:rut": data.rut,
            },
            "aut1:password": data.password,
          },
          "aut1:authDataExtraccionSubterranea": {
            "aut1:fechaMedicion": data.date,
            "aut1:horaMedicion": data.hour,
            "aut1:totalizador": data.totalizador,
            "aut1:caudal": fixNumberFormat(data.caudal),
            "aut1:nivelFreaticoDelPozo": fixNumberFormat(data.nivel_freatico),
          },
        },
      },
    });
    console.log("---- XML ----\n", xml);
    return xml;
  } catch (error) {
    throw error;
  }
};

/**
 * @description Endpoint y acción SOAP para enviar datos a la DGA.
 * !! Deprecated !!
 */
const URL_ENDPOINT =
  "https://snia.mop.gob.cl/controlextraccion/datosExtraccion/SendDataExtraccionService";
const SOAP_ACTION =
  "http://www.mop.cl/controlextraccion/wsdl/datosExtraccion/authSendDataExtraccionOp";

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
