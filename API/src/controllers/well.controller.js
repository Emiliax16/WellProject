//well.controller.js
const checkPermissionsForClientResources = require('../utils/check-permissions');
const ErrorHandler = require('../utils/error.util');
const { unauthorized, clientNotFound } = require('../utils/errorcodes.util');
const soloCampos = require('../utils/only-fields.util');
const activityLogService = require('../services/activityLog.service');
const db = require('../../models')

const Well = db.well;
const WellData = db.wellData;
const Client = db.client;
const Company = db.company;
const Distributor = db.distributor;
const User = db.user;
const Person = db.person;

//  TODO: no se esta usando ninguno de estos métodos excepto el activeOrDesactiveWell
const getAllWells = async (req, res, next) => {
  try {
    // Este listado es global y no filtra por cliente, así que no carga las
    // credenciales DGA. Los listados por cliente (/clients/:id/wells) sí las
    // devuelven, porque el formulario de edición del portal las necesita.
    const wells = await Well.findAll({
      attributes: { exclude: ['password', 'rutEmpresa', 'rutUsuario'] }
    });
    res.json(wells);
  } catch (error) {
    // Se delega en el middleware de errores. Respondiendo acá con
    // `error.message` se filtraba el detalle interno —un fallo de conexión
    // devolvía «connect ECONNREFUSED 127.0.0.1:5432»— y encima por una ruta
    // que no exige sesión.
    next(error);
  }
}

// Los mismos campos que acepta la creación desde `/clients/:id/wells/create`.
// Fuera queda `editStatusDate`, que fija el controlador de activación y sobre la
// que pivotea `fetchUnsentReports`: escribirla a futuro deja los envíos
// fallidos de ese pozo sin reintentar jamás.
const CAMPOS_CREABLES_WELL = [
  'name', 'location', 'code', 'isActived', 'rutEmpresa', 'rutUsuario', 'password',
];

const createWell = async (req, res, next) => {
  try {
    // El `clientId` viene del body y decide de quién es el pozo, así que hay
    // que comprobar que quien llama pueda operar sobre ese cliente. Sin esto,
    // cualquier usuario autenticado podía crear un pozo sobre la cuenta de otro
    // —y fijarle `editStatusDate`—, que es la misma vía que cierra el #81 en
    // `/clients/:id/wells/create`, por otra puerta.
    const client = await Client.findByPk(req.body.clientId);
    if (!client) {
      throw new ErrorHandler(clientNotFound);
    }

    if (!await checkPermissionsForClientResources(req.user, client)) {
      throw new ErrorHandler(unauthorized);
    }

    const well = await Well.create({
      ...soloCampos(req.body, CAMPOS_CREABLES_WELL),
      clientId: client.id,
    });
    res.json({ created: well })
  } catch (error) {
    next(error);
  }
}

const getWellDataByWell = async (req, res, next) => {
  try {
    const well = await Well.findOne({ where: { id: req.params.id } });
    if (!well) {
      return res.status(404).send({
        message: 'Well not found'
      });
    }
    //console.log(well.__proto__) -> para conocer los métodos que se pueden usar
    const wellDataInfo = await well.getWellData()
    res.json(wellDataInfo)
  } catch (error) {
    next(error);
  }
}

const activeOrDesactiveWell = async (req, res, next) => {
  try {
    // Get well with full context for activity logging
    const well = await Well.findOne({
      where: { id: req.params.id },
      include: [
        {
          model: Client,
          as: 'client',
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
        }
      ]
    });

    if (!well) {
      return res.status(404).send({
        message: 'Well not found'
      });
    }

    // Se valida contra el cliente dueño del pozo, no contra `undefined`. Antes
    // no se comprobaba pertenencia alguna, así que cualquier usuario podía
    // desactivar el pozo de otro cliente y cortarle el reporte a la DGA.
    if (!await checkPermissionsForClientResources(req.user, well.client)) {
      throw new ErrorHandler(unauthorized);
    }

    // Store previous state
    const wasActive = well.isActived;

    // Toggle activation
    well.isActived = !well.isActived;

    // Update edit status date
    well.editStatusDate = new Date();

    await well.save();

    // Create activity log
    try {
      const context = {
        client: {
          id: well.client.id,
          name: well.client.user?.person?.fullName || well.client.user?.email
        }
      };

      if (well.client.company) {
        context.company = {
          id: well.client.company.id,
          name: well.client.company.user?.person?.fullName || well.client.company.user?.email
        };

        if (well.client.company.distributor) {
          context.distributor = {
            id: well.client.company.distributor.id,
            name: well.client.company.distributor.user?.person?.fullName || well.client.company.distributor.user?.email
          };
        }
      }

      await activityLogService.createActivityLog({
        action: well.isActived ? 'activated' : 'deactivated',
        entityType: 'well',
        entityId: well.id,
        entityName: well.code,
        context,
        userId: req.user.id
      });
    } catch (logError) {
      console.error('Error creating activity log:', logError);
    }

    res.json(well);
  } catch (error) {
    // Se delega en el middleware de errores para que un fallo de autorización
    // salga como 401 y no como 500. Antes todo caía en el mismo `catch` y el
    // portal no podía distinguir "este pozo no es tuyo" de "el servidor se
    // cayó".
    next(error);
  }
}

module.exports = {
    getAllWells,
    createWell,
    getWellDataByWell,
    activeOrDesactiveWell,
}