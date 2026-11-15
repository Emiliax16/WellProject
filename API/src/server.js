const app = require('./app');
const { startSchedulers } = require('./jobs/scheduler');
const { avisarSiFaltaClave } = require('./middlewares/internal-key.middleware');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    // Este mensaje es la señal que el runbook de despliegue usa para confirmar
    // que la aplicación arrancó tras un despliegue. No cambiar el texto.
    console.log(`Escuchando en el puerto ${PORT}`);
    avisarSiFaltaClave();
    startSchedulers();
});

// A propósito NO se fija `server.setTimeout`: acota la duración total del
// manejador, y acá hay peticiones legítimamente largas. `POST /wellData` espera
// hasta 12 s a la DGA, y `POST /repostAllReportsToDGA` reenvía lotes de a 3 en
// paralelo, así que puede tardar minutos. Un tope de request cortaría envíos
// reales al regulador.
//
// Los timeouts de conexiones ociosas (`keepAliveTimeout`, `headersTimeout`) van
// aparte, porque hay que contrastarlos con la configuración de Nginx antes de
// aplicarlos.

const registrarFatal = (tipo, error) => {
    console.error(JSON.stringify({
        level: 'fatal',
        msg: tipo,
        name: error instanceof Error ? error.name : undefined,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        at: new Date().toISOString(),
    }));
};

// Sin estos handlers, una excepción no capturada mata el proceso sin dejar más
// rastro que el stack de Node. Fue lo que pasó el 4 de agosto de 2026: la API
// quedó caída y nadie se enteró hasta que alguien intentó usarla.
//
// Se registra y se sale con código 1. Salir es lo correcto: tras una
// `uncaughtException` el estado del proceso es indeterminado y seguir sirviendo
// peticiones puede corromper datos.
//
// En producción la API corre con `node` (`npm start`), así que `exit(1)`
// detiene el contenedor y Docker lo levanta de nuevo. Con nodemon, que es solo
// para desarrollo, el proceso queda esperando cambios y no se reinicia.
process.on('uncaughtException', (error) => {
    registrarFatal('uncaughtException', error);
    process.exit(1);
});

// Desde Node 15 una rejection sin capturar ya termina el proceso, pero sin este
// handler lo hace sin contexto propio. Registrarlo es la diferencia entre poder
// diagnosticar el incidente y no poder.
process.on('unhandledRejection', (reason) => {
    registrarFatal('unhandledRejection', reason);
    process.exit(1);
});

// Apagado ordenado: deja de aceptar conexiones nuevas y espera a que terminen
// las peticiones en curso. Importa porque un `POST /wellData` en vuelo puede
// estar transmitiendo al regulador.
const apagar = (senal) => {
    console.log(JSON.stringify({ level: 'info', msg: `${senal} recibido, cerrando` }));
    server.close(() => process.exit(0));
    // Si alguna conexión no cierra, no quedarse colgado para siempre.
    setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('SIGINT', () => apagar('SIGINT'));

module.exports = server;
