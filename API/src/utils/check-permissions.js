// Funcion que permite a un admin acceder a cualquier recurso
// a un company acceder a los recursos que el mismo creo
// y a un normal acceder a los recursos que le pertenecen || OJO con esto deberia solo servir para algunos casos, como getUserInfoById
const checkPermissions = (user, entity) => {
    const { id: requesterId, type: requesterRole } = user;

    if (requesterRole === 'admin') {
        return true;
    }

    if (requesterRole === 'company' && entity.createdBy === requesterId) {
        return true;
    }

    if (requesterRole === 'normal' && entity.userId === requesterId) {
        return true;
    }

    return false
}

module.exports = checkPermissions;