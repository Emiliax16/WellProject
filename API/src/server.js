const app = require('./app');
const { startSchedulers } = require('./jobs/scheduler');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Escuchando en el puerto ${PORT}`);
    startSchedulers();
});
