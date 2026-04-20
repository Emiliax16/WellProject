'use strict';

const { user, role, person, client, well, wellData } = require('../models');

const DEMO_ADMIN_EMAIL = 'admin.demo@promedicion.cl';
const DEMO_CLIENT_EMAIL = 'cliente.demo@promedicion.cl';
const DEMO_PASSWORD = 'Demo12345';

const pad = (n) => String(n).padStart(2, '0');
const formatDate = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const formatHour = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const formatRealDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const buildReport = (code, minutesAgo, { totalizador, caudal, nivel_freatico }) => {
  const d = new Date(Date.now() - minutesAgo * 60000);
  return {
    code,
    date: formatDate(d),
    hour: formatHour(d),
    realDate: formatRealDate(d),
    totalizador,
    caudal,
    nivel_freatico,
    sent: true,
    sentDate: d.toISOString(),
    createdAt: d,
    updatedAt: d,
  };
};

module.exports = {
  async up() {
    const adminRole = await role.findOne({ where: { type: 'admin' } });
    const normalRole = await role.findOne({ where: { type: 'normal' } });
    if (!adminRole || !normalRole) {
      throw new Error('Faltan los roles base. Corre primero el seed de roles.');
    }

    // Admin demo
    const [adminUser] = await user.findOrCreate({
      where: { email: DEMO_ADMIN_EMAIL },
      defaults: {
        name: 'Admin Demo',
        email: DEMO_ADMIN_EMAIL,
        encrypted_password: DEMO_PASSWORD,
        roleId: adminRole.id,
        isActived: true,
      },
    });

    await person.findOrCreate({
      where: { userId: adminUser.id },
      defaults: {
        userId: adminUser.id,
        fullName: 'Admin Demo',
        phoneNumber: '+56 9 0000 0000',
        location: 'Santiago',
      },
    });

    // Cliente demo dueño de los pozos
    const [clientUser] = await user.findOrCreate({
      where: { email: DEMO_CLIENT_EMAIL },
      defaults: {
        name: 'Cliente Demo',
        email: DEMO_CLIENT_EMAIL,
        encrypted_password: DEMO_PASSWORD,
        roleId: normalRole.id,
        isActived: true,
      },
    });

    await person.findOrCreate({
      where: { userId: clientUser.id },
      defaults: {
        userId: clientUser.id,
        fullName: 'Cliente Demo',
        phoneNumber: '+56 9 1111 1111',
        location: 'Los Andes',
      },
    });

    const [demoClient] = await client.findOrCreate({
      where: { userId: clientUser.id },
      defaults: { userId: clientUser.id },
    });

    // Definición de 3 pozos con distintos estados
    const demoWells = [
      {
        code: 'DEMO-VERDE',
        name: 'Pozo Aconcagua Norte',
        location: 'Los Andes, Región de Valparaíso',
        minutesAgo: 15, // verde
      },
      {
        code: 'DEMO-AMARILLO',
        name: 'Pozo Valle Central',
        location: 'San Felipe, Región de Valparaíso',
        minutesAgo: 180, // 3h → amarillo
      },
      {
        code: 'DEMO-ROJO',
        name: 'Pozo Cordillera Sur',
        location: 'Rancagua, Región del Libertador',
        minutesAgo: 540, // 9h → rojo
      },
    ];

    for (const w of demoWells) {
      const [wellRow] = await well.findOrCreate({
        where: { code: w.code },
        defaults: {
          clientId: demoClient.id,
          name: w.name,
          location: w.location,
          code: w.code,
          isActived: true,
          rutEmpresa: '11111111-1',
          rutUsuario: '22222222-2',
          password: 'demo',
        },
      });

      // Inserto 3 reportes previos (para que la tabla tenga historia) y uno "último" en minutesAgo
      const reports = [
        buildReport(wellRow.code, w.minutesAgo + 360, { totalizador: 100, caudal: 1.2, nivel_freatico: 5.1 }),
        buildReport(wellRow.code, w.minutesAgo + 180, { totalizador: 120, caudal: 1.3, nivel_freatico: 5.2 }),
        buildReport(wellRow.code, w.minutesAgo, { totalizador: 150, caudal: 1.5, nivel_freatico: 5.4 }),
      ];

      for (const r of reports) {
        await wellData.findOrCreate({
          where: { code: r.code, date: r.date, hour: r.hour },
          defaults: r,
        });
      }
    }

    console.log('[demo-seed] datos demo creados correctamente.');
    console.log(`[demo-seed] admin: ${DEMO_ADMIN_EMAIL} / ${DEMO_PASSWORD}`);
    console.log(`[demo-seed] cliente: ${DEMO_CLIENT_EMAIL} / ${DEMO_PASSWORD}`);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('wellData', { code: ['DEMO-VERDE', 'DEMO-AMARILLO', 'DEMO-ROJO'] });
    await queryInterface.bulkDelete('wells', { code: ['DEMO-VERDE', 'DEMO-AMARILLO', 'DEMO-ROJO'] });
    await queryInterface.bulkDelete('users', { email: [DEMO_ADMIN_EMAIL, DEMO_CLIENT_EMAIL] });
  },
};
