const app = require('./app');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(JSON.stringify({ level: 'info', msg: `API listening on ${PORT}` }));
});

server.setTimeout(15_000);
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

const shutdown = (signal) => {
  console.log(JSON.stringify({ level: 'info', msg: `Received ${signal}, shutting down` }));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error(JSON.stringify({
    level: 'fatal',
    msg: 'uncaughtException',
    name: err.name,
    message: err.message,
    stack: err.stack,
  }));
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(JSON.stringify({
    level: 'fatal',
    msg: 'unhandledRejection',
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  }));
  process.exit(1);
});
