const db = require('../../models');
const Company = db.company;
const Distributor = db.distributor;

// Funcion que permite a un admin acceder a cualquier recurso
// a un company acceder a los recursos que el mismo creo
// y a un normal acceder a los recursos que le pertenecen || OJO con esto deberia solo servir para algunos casos, como getUserInfoById
const checkPermissionsForClientResources = async (user, entity)=> {
    const { id: requesterId, type: requesterRole } = user;

    if (requesterRole === 'admin') {
        return true;
    }

    if (requesterRole === 'company'){
        const company = await Company.findOne({ where: {userId: requesterId} })
        if (entity?.createdBy === requesterId || entity?.companyId === company.id) {
            return true;
        }
    }

    if (requesterRole === 'distributor') {
        const distributor = await Distributor.findOne({ where: {userId: requesterId} })
        if (entity?.createdBy === requesterId || entity?.distributorId === distributor.id) {
            return true;
        }
    }

    if (requesterRole === 'normal' && entity?.userId === requesterId) {
        return true;
    }

    return false
}

module.exports = checkPermissionsForClientResources;