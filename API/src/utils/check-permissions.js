const db = require('../../models');
const Company = db.company;
const Distributor = db.distributor;

// Verifica que el solicitante pueda operar sobre `entity`, siguiendo la
// jerarquía distribuidora → empresa → cliente → pozo.
//
//   admin        cualquier recurso.
//   dueño        cualquier rol sobre su propio registro (`entity.userId`).
//                Es lo que permite que una empresa edite sus propios datos.
//   company      los clientes que cuelgan de su empresa.
//   distributor  sus empresas, y los clientes de esas empresas.
//
// `isCreation` es para operaciones que todavía no tienen entidad, como registrar
// un usuario. Ahí no hay pertenencia que comprobar: el authMiddleware de la ruta
// ya filtró por rol, y validar el destino le corresponde al controlador.
//
// ⚠️ Es `async`. Llamarla sin `await` devuelve una Promise, que siempre es
// truthy, así que `!checkPermissions(...)` nunca se cumple y la validación no
// bloquea nada. Fue el bug del issue #60: parecía validar y no validaba.
const checkPermissionsForClientResources = async (user, entity, isCreation = false) => {
    const { id: requesterId, type: requesterRole } = user;

    if (requesterRole === 'admin') {
        return true;
    }

    if (isCreation) {
        return true;
    }

    // Sin entidad no hay pertenencia que verificar, así que se niega. Sólo las
    // creaciones pueden llegar acá sin entidad, y ésas ya salieron arriba.
    if (!entity) {
        return false;
    }

    if (entity.userId === requesterId) {
        return true;
    }

    if (requesterRole === 'company') {
        const company = await Company.findOne({ where: { userId: requesterId } });
        // Un usuario con rol company pero sin fila en `companies` no gestiona
        // a nadie. Antes esto reventaba con TypeError al leer `company.id`.
        if (!company) {
            return false;
        }
        return entity.companyId === company.id;
    }

    if (requesterRole === 'distributor') {
        const distributor = await Distributor.findOne({ where: { userId: requesterId } });
        if (!distributor) {
            return false;
        }

        // Sus empresas.
        if (entity.distributorId === distributor.id) {
            return true;
        }

        // Los clientes de sus empresas: hay que subir un nivel para saber de
        // qué distribuidora cuelga la empresa del cliente.
        if (entity.companyId) {
            const company = await Company.findByPk(entity.companyId);
            return !!company && company.distributorId === distributor.id;
        }
    }

    return false;
}

module.exports = checkPermissionsForClientResources;
