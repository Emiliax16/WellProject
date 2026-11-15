const db = require('../../models');
const ErrorHandler = require('../utils/error.util');
const checkPermissionsForClientResources = require('../utils/check-permissions');
const assertCanChangeRole = require('../utils/assert-role-change');
const soloCampos = require('../utils/only-fields.util');
const { respuestaDePozo, conClaveDgaOculta, MASCARA_CLAVE_DGA } = require('../utils/well-response.util');

// Lo único que se puede escribir en un pozo desde el portal.
//
// Fuera quedan `clientId`, que decidiría a qué cuenta pertenece el pozo, y
// `editStatusDate`, que fija el controlador al activar o desactivar y que
// `fetchUnsentReports` usa para decidir qué reportes reintentar: escribirla a
// futuro deja los envíos fallidos de ese pozo sin reintentar jamás.
//
// Las credenciales DGA sí entran: el formulario del pozo las edita
// (`wellForm.js` registra `rutEmpresa`, `rutUsuario` y `password`), y quien
// llega hasta acá ya pasó la validación de pertenencia.
const CAMPOS_EDITABLES_WELL = [
  'name', 'location', 'code', 'isActived', 'rutEmpresa', 'rutUsuario', 'password',
];

// Las credenciales DGA no se pueden recuperar: el MOP las entrega una sola vez.
// Por eso, al editar, un valor vacío no borra la que ya existe sino que se
// ignora. El formulario del portal manda `password: ""` en cada guardado
// (registra el campo sin `defaultValue`), así que antes bastaba con cambiarle
// el nombre a un pozo para dejarlo sin credencial (issue #91).
//
// La máscara también se ignora: es lo que devuelven las respuestas en lugar de
// la contraseña, y no debe terminar guardada como si fuera una.
const sinCredencialesVacias = (cambios) => {
  const resultado = { ...cambios };
  for (const campo of ['password', 'rutEmpresa', 'rutUsuario']) {
    if (!(campo in resultado)) continue;
    const valor = resultado[campo];
    const vacio = valor === null || valor === undefined || String(valor).trim() === '';
    if (vacio || (campo === 'password' && valor === MASCARA_CLAVE_DGA)) {
      delete resultado[campo];
    }
  }
  return resultado;
};

// Lo único que se puede escribir al agregar una medición a mano. Fuera quedan
// `sent` y `sentDate`, que marcarían el reporte como enviado a la DGA sin
// haberlo enviado, e `id`. `code` lo fija el controlador desde el pozo.
const CAMPOS_CREABLES_WELL_DATA = [
  'date', 'realDate', 'hour', 'totalizador', 'caudal', 'nivel_freatico',
];
const {
  unauthorized,
  userHasNoClientAssociated,
  clientNotFound,
  wellNotFound,
  clientHasNoUserOrPersonAssociated,
  wellHasDataAssociated,
} = require('../utils/errorcodes.util');
const getPaginationParameters = require('../utils/query-params.util');
const defineDateCondition = require('../utils/month-year-params.util');
const activityLogService = require('../services/activityLog.service');

const Client = db.client;
const Well = db.well;
const WellData = db.wellData;
const User = db.user;
const Person = db.person;
const Company = db.company;
const Distributor = db.distributor;


// El listado se acota al alcance de quien consulta en vez de rechazar: un admin
// sigue viendo todos los clientes, una empresa sólo los suyos y un cliente sólo
// a sí mismo. Antes cualquier empresa o cliente recibía la lista completa, con
// usuario y datos personales.
//
// Devuelve `null` cuando quien consulta no tiene clientes a su cargo. Ojo con
// resolverlo como `{ companyId: null }`: ese filtro trae justamente todos los
// clientes sin empresa.
const alcanceDeClientes = async (user) => {
  if (user.type === 'admin') {
    return {};
  }
  if (user.type === 'company') {
    const company = await Company.findOne({ where: { userId: user.id } });
    return company ? { companyId: company.id } : null;
  }
  if (user.type === 'normal') {
    return { userId: user.id };
  }
  return null;
}

//               GET ALL CLIENTS
const getAllClients = async (req, res, next) => {
  try {
    const alcance = await alcanceDeClientes(req.user);
    if (!alcance) {
      return res.json([]);
    }
    const clients = await Client.findAll({
      where: alcance,
      include: [
        {
          model: User,
          as: 'user',
          attributes: {
            exclude: ['encrypted_password']
          },
          include: [
            {
              model: Person,
              as: 'person',
              attributes: {
                exclude: ['userId']
              }
            }
          ]
        }
      ]
    });
    res.json(clients);
  } catch (error) {
    next(error);
  }
}
 
//               EDIT A CLIENT 
const editClient = async (req, res, next) => {
  try {
    const { id: clientId } = req.params; 

    const client = await Client.findByPk(clientId);
    if (!client) {
      throw new ErrorHandler(clientNotFound);
    }
    const user = await client.getUser();
    const person = await user.getPerson();
    
    if (!user || !person) {
      throw new ErrorHandler(clientHasNoUserOrPersonAssociated);
    }

    if (!await checkPermissionsForClientResources(req.user, client)) {
      throw new ErrorHandler(unauthorized);
    }

    assertCanChangeRole(req.user, user, req.body);

    const password = req.body.encrypted_password;

    // Quitamos el password del body para actualizar los datos del cliente por separado
    if (password) {
      delete req.body.encrypted_password;
      await user.handlePasswordChange(undefined, password);
    }

    await client.updateDetails(user, person, req.body);
    return res.json({ message: `Cliente ${client.id} editado exitosamente.` });
  } catch (error) {
    next(error);
  }
}


//               DELETE A CLIENT
const deleteClient = async (req, res, next) => {
  try {
    const { id: clientId } = req.params;
    const client = await Client.findByPk(clientId);
    if (!client) {
      throw new ErrorHandler(userHasNoClientAssociated);
    }
    const user = await client.getUser();

    if (!await checkPermissionsForClientResources(req.user, client)) {
      throw new ErrorHandler(unauthorized);
    }

    await user.destroy();
    return res.json({message: `Cliente ${client.id} eliminado exitosamente.`});
  } catch (error) {
    next(error);
  }
}

//               GET WELLS OF A CLIENT
const getClientWells = async (req, res, next) => {
  try {
    const { id: clientId } = req.params;

    const client = await Client.findByPk(clientId);
    if (!client) {
      throw new ErrorHandler(clientNotFound);
    }

    if (!await checkPermissionsForClientResources(req.user, client)) {
      throw new ErrorHandler(unauthorized);
    }

    const { limit, offset } = getPaginationParameters(req.query);
    console.log(limit, offset)
    const wells = await Well.findAndCountAll({
      where: { clientId: client.id },
      limit,
      offset,
    });

    res.json({ ...wells, rows: wells.rows.map(conClaveDgaOculta) });

  } catch (error) {
    next(error);
  }
}

//              GET ONE WELL OF A CLIENT
const getOneWell = async (req, res, next) => {
  try {
    const { id: clientId, code } = req.params;

    const client = await Client.findByPk(clientId);
    if (!client) {
      throw new ErrorHandler(userHasNoClientAssociated);
    }

    if (!await checkPermissionsForClientResources(req.user, client)) {
      throw new ErrorHandler(unauthorized);
    }

    const well = await Well.findOne({ where: { code: code, clientId: client.id } });
    if (!well) {
      throw new ErrorHandler(wellNotFound);
    }

    // Devuelve `rutEmpresa` y `rutUsuario`, igual que el listado de pozos del
    // cliente. Es el listado el que alimenta el formulario de edición: el portal
    // pasa ese pozo a `EditWell.js` por `location.state`, y `wellForm.js` usa los
    // RUT como valor inicial. `password` va enmascarado en las dos rutas, porque
    // el portal solo necesita saber si existe.
    res.json(conClaveDgaOculta(well));
  } catch (error) {
    next(error);
  }
}

// EDIT A WELL OF A CLIENT

const editClientWell = async (req, res, next) => {
  try {
    const { id: clientId, code } = req.params;

    const client = await Client.findByPk(clientId, {
      include: [
        {
          model: User,
          as: 'user',
          include: [{ model: Person, as: 'person' }]
        },
        {
          model: Company,
          as: 'company',
          include: [
            {
              model: User,
              as: 'user',
              include: [{ model: Person, as: 'person' }]
            },
            {
              model: Distributor,
              as: 'distributor',
              include: [
                {
                  model: User,
                  as: 'user',
                  include: [{ model: Person, as: 'person' }]
                }
              ]
            }
          ]
        }
      ]
    });
    if (!client) {
      throw new ErrorHandler(userHasNoClientAssociated);
    }

    if (!await checkPermissionsForClientResources(req.user, client)) {
      throw new ErrorHandler(unauthorized);
    }

    const well = await Well.findOne({ where: { code: code, clientId: client.id } });
    if (!well) {
      throw new ErrorHandler(wellNotFound);
    }

    if (req.body.code && req.body.code !== well.code) {
      const reportsAssociated = await WellData.findAndCountAll({
        where: { code: well.code }
      });

      if (reportsAssociated.count > 0) {
        throw new ErrorHandler(wellHasDataAssociated);
      }
    }

    // Check if isActived changed for activity logging
    const wasActive = well.isActived;
    const willBeActive = req.body.isActived !== undefined ? req.body.isActived : wasActive;
    const activationChanged = wasActive !== willBeActive;

    await well.update(sinCredencialesVacias(soloCampos(req.body, CAMPOS_EDITABLES_WELL)));

    // Log activation/deactivation
    if (activationChanged) {
      try {
        const context = {
          client: {
            id: client.id,
            name: client.user?.person?.fullName || client.user?.email
          }
        };

        if (client.company) {
          context.company = {
            id: client.company.id,
            name: client.company.user?.person?.fullName || client.company.user?.email
          };

          if (client.company.distributor) {
            context.distributor = {
              id: client.company.distributor.id,
              name: client.company.distributor.user?.person?.fullName || client.company.distributor.user?.email
            };
          }
        }

        await activityLogService.createActivityLog({
          action: willBeActive ? 'activated' : 'deactivated',
          entityType: 'well',
          entityId: well.id,
          entityName: well.code,
          context,
          userId: req.user.id
        });
      } catch (logError) {
        console.error('Error creating activity log:', logError);
      }
    }

    return res.json({message: "Pozo editado exitosamente."});
  } catch (error) {
    next(error);
  }
}

// DELETE A WELL OF A CLIENT

const deleteClientWell = async (req, res, next) => {
  try {
    const { id: clientId, code } = req.params;
    const client = await Client.findByPk(clientId);
    if (!client) {
      throw new ErrorHandler(userHasNoClientAssociated);
    }

    if (!await checkPermissionsForClientResources(req.user, client)) {
      throw new ErrorHandler(unauthorized);
    }

    const well = await Well.findOne({ where: { code: code, clientId: client.id } });
    if (!well) {
      throw new ErrorHandler(wellNotFound);
    }

    const reportsAssociated = await WellData.findAndCountAll({
      where: { code: well.code }
    });

    if (reportsAssociated.count > 0) {
      throw new ErrorHandler(wellHasDataAssociated);
    }

    await well.destroy();
    return res.json({message: `Pozo ${code} eliminado exitosamente.`});
  } catch (error) {
    next(error);
  }
}

//               GET DATA OF A WELL

const getWellData = async (req, res, next) => {
  try {
    const { id: clientId, code: wellCode } = req.params;

    const client = await Client.findByPk(clientId);
    if (!client) {
      throw new ErrorHandler(clientNotFound);
    }

    if (!await checkPermissionsForClientResources(req.user, client)) {
      throw new ErrorHandler(unauthorized);
    }
    const well = await Well.findOne({ where: { code: wellCode, clientId: client.id } });
    if (!well) {
      throw new ErrorHandler(wellNotFound);
    }
    const { limit, offset } = getPaginationParameters(req.query);
    const { startDate, endDate } = defineDateCondition(req.query);

    const wellData = await WellData.findAndCountAll({
      where: { code: well.code,
        realDate: {
          [db.Op.between]: [startDate, endDate]
       },
      },
      limit,
      offset,
      order: [['realDate', 'DESC'], ['hour', 'DESC']],
    });
    res.json(wellData);
  
  } catch (error) {
    next(error);
  }
}

//               CREATE A WELL FOR A CLIENT

const createClientWell = async (req, res, next) => {
  try {
    const { id: clientId } = req.params;
    const client = await Client.findByPk(clientId, {
      include: [
        {
          model: User,
          as: 'user',
          include: [{ model: Person, as: 'person' }]
        },
        {
          model: Company,
          as: 'company',
          include: [
            {
              model: User,
              as: 'user',
              include: [{ model: Person, as: 'person' }]
            },
            {
              model: Distributor,
              as: 'distributor',
              include: [
                {
                  model: User,
                  as: 'user',
                  include: [{ model: Person, as: 'person' }]
                }
              ]
            }
          ]
        }
      ]
    });
    if (!client) {
      throw new ErrorHandler(clientNotFound);
    }

    if (!await checkPermissionsForClientResources(req.user, client)) {
      throw new ErrorHandler(unauthorized);
    }

    const well = await Well.create({
      ...soloCampos(req.body, CAMPOS_EDITABLES_WELL),
      clientId: client.id,
    });

    // Create activity log
    try {
      const context = {
        client: {
          id: client.id,
          name: client.user?.person?.fullName || client.user?.email
        }
      };

      if (client.company) {
        context.company = {
          id: client.company.id,
          name: client.company.user?.person?.fullName || client.company.user?.email
        };

        if (client.company.distributor) {
          context.distributor = {
            id: client.company.distributor.id,
            name: client.company.distributor.user?.person?.fullName || client.company.distributor.user?.email
          };
        }
      }

      await activityLogService.createActivityLog({
        action: 'created',
        entityType: 'well',
        entityId: well.id,
        entityName: well.code,
        context,
        userId: req.user.id
      });
    } catch (logError) {
      console.error('Error creating activity log:', logError);
    }

    // A diferencia del GET de un pozo, acá el portal no lee el cuerpo:
    // `wellForm.js` hace `await postNewWell(...)` y navega a la lista. Así que
    // la creación no tiene por qué devolver de vuelta las credenciales que
    // acaba de recibir.
    res.json(respuestaDePozo(well));
  } catch (error) {
    next(error);
  }
}

//               ADD DATA TO A WELL OF A CLIENT

const addDataToClientWell = async (req, res, next) => {
  try {
    const { id: clientId, code: wellCode } = req.params;

    const client = await Client.findByPk(clientId);
    if (!client) {
      throw new ErrorHandler(clientNotFound);
    }
    // Sin esta validación, cualquier usuario con sesión podía agregar
    // mediciones a un pozo ajeno, y si el pozo estaba activo el hook
    // `afterCreate` las enviaba a la DGA con las credenciales de ese pozo.
    if (!await checkPermissionsForClientResources(req.user, client)) {
      throw new ErrorHandler(unauthorized);
    }
    const well = await Well.findOne({ where: { code: wellCode, clientId: client.id } });
    if (!well) {
      throw new ErrorHandler(wellNotFound);
    }
    const wellData = await WellData.create({
      ...soloCampos(req.body, CAMPOS_CREABLES_WELL_DATA),
      code: well.code,
    });
    res.json(wellData);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllClients,
  editClient,
  deleteClient,
  deleteClientWell,
  editClientWell,
  getClientWells,
  getWellData,
  createClientWell,
  addDataToClientWell,
  getOneWell,
}