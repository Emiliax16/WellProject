// Funcion que permite a un admin acceder a cualquier recurso
// a un company acceder a los recursos que el mismo creo
// y a un normal acceder a los recursos que le pertenecen || OJO con esto deberia solo servir para algunos casos, como getUserInfoById
const checkPermissionsForClientResources = (user, entity, beingModified = false) => {
    const { id: requesterId, type: requesterRole } = user;

    if (requesterRole === 'admin') {
        return true;
    }

    if (requesterRole === 'company' && (beingModified || entity?.createdBy === requesterId || entity?.companyId === requesterId)) {
        return true;
    }

    if (requesterRole === 'normal' && entity?.userId === requesterId) {
        return true;
    }

    return false
}

module.exports = checkPermissionsForClientResources;