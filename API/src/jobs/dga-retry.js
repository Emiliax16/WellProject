// Reintento diario de los reportes que la DGA no aceptó.
//
// Reemplaza al SENDER (Rails), que hacía lo mismo llamando a la API por HTTP.
// Sigue la sección 6 del documento de transmisión de la DGA ("Transmisión MEE
// subterráneas, nueva API"):
//
// - §6.2: si la respuesta no es `00`, o no llega, la medición se reenvía una
//   vez al día siguiente, y así cada día hasta recibir `00`. Por eso corre una
//   vez al día y vuelve a tomar lo que siga pendiente.
// - §6.1: las mediciones atrasadas se envían una por una, con al menos 5
//   minutos entre cada envío.
// - §6.3: no se retransmiten mediciones que la DGA ya tiene. Se omite toda hora
//   de un pozo que ya tenga un reporte enviado, y `processAndPostData` lo vuelve
//   a comprobar justo antes de transmitir.
//
// Diferencias con el SENDER, a propósito:
//
// - Un rechazo no detiene la corrida. El SENDER abortaba el lote en el primer
//   error, así que un pozo con credenciales malas dejaba sin reintento a todos
//   los demás.
// - Envía una medición por hora y por pozo, la primera que llegó. La DGA guarda
//   una sola por hora, y transmitir la segunda solo produciría un rechazo.
// - La ventana es de 35 días, decidida con Emilia el 17-11-2026. La de 3 días
//   venía de agosto, cuando la cola tenía 57 mil duplicados; con los
//   duplicados resueltos (PRs #97 y #98) lo que queda son fallas reales, y la
//   DGA pide seguir reintentándolas.
// - Un pozo activo sin `editStatusDate` también entra (#69). El modelo `well`
//   ahora la fija cada vez que cambia `isActived`, pero los pozos anteriores a
//   ese cambio pueden tenerla vacía.

const { wellData: WellData } = require('../../models');
const processAndPostData = require('../services/wellData/handleSendData.service');
const { iniciarCorrida, terminarCorrida } = require('./estado-reintento');
const {
  buscarPendientes: buscarEnLaBase,
  DIAS_DE_VENTANA,
  HORAS_DE_GRACIA,
} = require('../services/wellData/pendientesDga.service');

// Qué cuenta como pendiente (pozo activo, días anteriores, 35 días, una
// medición por hora y sin horas ya enviadas) está en `pendientesDga.service.js`,
// que comparte con la alerta de las 08:00.

// §6.1: al menos 5 minutos entre cada envío de mediciones atrasadas.
const SEPARACION_MS = 5 * 60 * 1000;

// Con 5 minutos entre envíos, 250 reportes ocupan casi 21 horas: la corrida
// termina antes de la siguiente. Lo que exceda queda para el día siguiente.
const MAXIMO_POR_CORRIDA = 250;

const buscarPendientes = ({ ahora = new Date(), maximo = MAXIMO_POR_CORRIDA } = {}) =>
  buscarEnLaBase({ ahora, maximo });

// El reporte y su pozo, si el reporte sigue sin enviarse y el pozo sigue
// activo. Si no, ambos vienen en `null`.
const leerEnviable = async (id) => {
  const reporte = await WellData.findByPk(id);
  const pozo = reporte && !reporte.sent ? await reporte.getWell() : null;
  return pozo && pozo.isActived ? { reporte, pozo } : { reporte: null, pozo: null };
};

const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Evita dos corridas a la vez, por ejemplo si una se alarga y node-cron recupera
// una ejecución. Si el proceso se reinicia a mitad de camino no queda nada
// colgado: lo que falte se toma en la corrida siguiente.
let enCurso = false;

const reintentarPendientes = async ({
  ahora = new Date(),
  esperar = dormir,
  maximo = MAXIMO_POR_CORRIDA,
} = {}) => {
  if (enCurso) {
    console.warn('[reintento-dga] ya hay una corrida en curso; se omite esta');
    return { omitida: true };
  }
  enCurso = true;
  let error = null;

  try {
    // Si la búsqueda falla, la corrida queda registrada como terminada con
    // error, para que la alerta de las 08:00 lo informe.
    iniciarCorrida({ inicio: ahora, pendientes: 0, alcanzoElMaximo: false });
    const ids = await buscarPendientes({ ahora, maximo });
    console.log(
      `[reintento-dga] ${ids.length} medición(es) pendiente(s) de los últimos ${DIAS_DE_VENTANA} días`
    );

    const estado = iniciarCorrida({ inicio: ahora, pendientes: ids.length, alcanzoElMaximo: ids.length >= maximo });
    let transmitioAntes = false;

    for (const id of ids) {
      let reporte = null;
      try {
        // La corrida puede durar horas: cada reporte y su pozo se vuelven a leer
        // justo antes de enviarlo, por si se envió o se desactivó entre medio.
        // Si hay que esperar los 5 minutos, se leen otra vez después.
        let pozo;
        ({ reporte, pozo } = await leerEnviable(id));
        if (reporte && transmitioAntes) {
          await esperar(SEPARACION_MS);
          ({ reporte, pozo } = await leerEnviable(id));
        }
        if (!reporte) {
          estado.omitidos += 1;
          continue;
        }
        transmitioAntes = true;

        await processAndPostData(reporte, pozo);
        estado.aceptados += 1;
      } catch (error) {
        // Puede ser un rechazo de la DGA, un timeout o un error propio, como
        // la base caída: en ningún caso se corta la corrida. Solo se registra
        // el mensaje, porque un error de axios completo podría arrastrar el
        // cuerpo enviado, que lleva las credenciales DGA del pozo.
        estado.fallidos += 1;
        const detalle = reporte ? ` (${reporte.code} ${reporte.date} ${reporte.hour})` : '';
        console.error(`[reintento-dga] falló el reintento del reporte ${id}${detalle}: ${error.message}`);
      }
    }

    const { pendientes, aceptados, fallidos, omitidos } = estado;
    const resultado = { pendientes, aceptados, fallidos, omitidos };
    console.log('[reintento-dga] resultado:', resultado);
    return resultado;
  } catch (e) {
    error = e.message;
    throw e;
  } finally {
    terminarCorrida({ error });
    enCurso = false;
  }
};

module.exports = {
  reintentarPendientes,
  buscarPendientes,
  DIAS_DE_VENTANA,
  HORAS_DE_GRACIA,
  SEPARACION_MS,
  MAXIMO_POR_CORRIDA,
};
