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
const getAllWells = async (req, res) => {
  try {
    const wells = await Well.findAll();
    res.json(wells);
  } catch (error) {
    res.status(500).send({
      message: error.message || 'Some error occurred while retrieving Wells'
    });
  }
}

const createWell = async (req, res) => {
  try { 
    const well = await Well.create(req.body)
    res.json({created: well})
  } catch (error) {
    res.status(500).send({
      message: error.message || 'Some error occurred while creating the Well'
    });
  }
}

const getWellDataByWell = async (req, res) => {
  try {
    const well = await Well.findOne({ where: { id: req.params.id } });
    if (!well) {
      res.status(404).send({
        message: 'Well not found'
      });
    }
    //console.log(well.__proto__) -> para conocer los métodos que se pueden usar
    const wellDataInfo = await well.getWellData()
    res.json(wellDataInfo)
  } catch (error) {
    res.status(500).send({
      message: error.message || 'Some error occurred while retrieving Well Data'
    });
  
  }
}

const activeOrDesactiveWell = async (req, res) => {
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

    res.json(well);
  } catch (error) {
    res.status(500).send({
      message: error.message || 'Some error occurred while activating the Well'
    });
  }
}

module.exports = {
    getAllWells,
    createWell,
    getWellDataByWell,
    activeOrDesactiveWell,
}