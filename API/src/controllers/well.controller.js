//well.controller.js
const checkPermissionsForClientResources = require('../utils/check-permissions');
const ErrorHandler = require('../utils/error.util');
const { unauthorized } = require('../utils/errorcodes.util');
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
    const wells = await Well.findAll();
    return res.json(wells);
  } catch (error) {
    return next(error);
  }
}

const createWell = async (req, res, next) => {
  try {
    const well = await Well.create(req.body)
    return res.json({ created: well })
  } catch (error) {
    return next(error);
  }
}

const getWellDataByWell = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid well id' });
    }

    const well = await Well.findByPk(id);
    if (!well) {
      return res.status(404).json({ error: 'Well not found' });
    }

    const wellDataInfo = await well.getWellData();
    return res.json(wellDataInfo);
  } catch (error) {
    return next(error);
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

    if (!checkPermissionsForClientResources(req.user, undefined, true)) {
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

    return res.json(well);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
    getAllWells,
    createWell,
    getWellDataByWell,
    activeOrDesactiveWell,
}