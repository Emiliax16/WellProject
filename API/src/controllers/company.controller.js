const db = require('../../models');
const ErrorHandler = require('../utils/error.util');
const checkPermissionsForClientResources = require('../utils/check-permissions');
const { companyNotFound, clientNotFound, clientDoesntBelongToCompany, clientHasNoUserOrPersonAssociated } = require('../utils/errorcodes.util');

const Company = db.company;
const User = db.user;
const Person = db.person;
const Client = db.client;

const getAllCompanies = async (req, res, next) => {
  try {
    const companies = await Company.findAll({
      include: [
        {
          model: User,
          as: 'user',
          attributes: {
            exclude: ['encrypted_password']
          }
        }
      ]
    });
    res.json(companies)
  } catch (error) {
    next(error)
  }
}

const getCompanyInfo = async (req, res, next) => {
  try {
    const { id } = req.params

    const company = await Company.findByPk(id,
      {
          include: [
              {
                  model: User,
                  as: 'user',
                  attributes: {
                      exclude: ['encrypted_password']
                  }
              }
          ]
      }
    )

    if (!company) {
      throw new ErrorHandler(companyNotFound)
    }
 
    res.json(company)
  } catch (error) {
    next(error)
  }
}

const addClientToCompany = async (req, res, next) => {
  try {
      const { id, clientId } = req.params

      const company = await Company.findByPk(id)
      if (!company) {
          throw new ErrorHandler(companyNotFound)
      }

      const client = await Client.findByPk(clientId)
      if (!client) {
          throw new ErrorHandler(clientNotFound)
      }

      await client.update({ companyId: id })
      console.log(client)
      res.json({ message: `Cliente ${clientId} fue agregado a la compañia ${id}` })
  } catch (error) {
      next(error)
  }
}

const removeClientFromCompany = async (req, res, next) => {
  try {
      const { id, clientId } = req.params

      const company = await Company.findByPk(id)
      if (!company) {
          throw new ErrorHandler(companyNotFound)
      }

      const client = await Client.findByPk(clientId)
      if (!client) {
          throw new ErrorHandler(clientNotFound)
      }

      if (client.companyId !== company.id) {
          throw new ErrorHandler(clientDoesntBelongToCompany)
      }

      await client.update({ companyId: null })
      res.json({ message: `Cliente ${clientId} fue removido de la compañia ${id}` })
  } catch (error) {
      next(error)
  }
}

const getAllCompanyClients = async (req, res, next) => {
  try {
    const { id } = req.params

    const company = await Company.findByPk(id,
      {
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
      }
    )
    if (!company) {
        throw new ErrorHandler(companyNotFound)
    }
    const clients = await company.getClients({
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
    })
    res.json(clients)
  } catch (error) {
    next(error)
  }
}

const deleteCompany = async (req, res, next) => {
  try {
    const { id } = req.params

    const company = await Company.findByPk(id)
    if (!company) {
      throw new ErrorHandler(companyNotFound)
    }

    // TODO: negociar si se eliminan en cadena, por el momento no
    // const clients = await company.getClients()
    // clients.forEach(async client => {
    //     await client.update({ companyId: null })
    // })

    const user = await company.getUser();
    await company.destroy();
    await user.destroy();

    res.json({ message: `La compañia ${id} fue eliminada` })
  } catch (error) {
    next(error)
  }
}

const editCompany = async (req, res, next) => {
  try {
    const { id } = req.params
    const company = await Company.findByPk(id)
    if (!company) {
      throw new ErrorHandler(companyNotFound)
    }

    const user = await company.getUser();

    if (!user) {
      throw new ErrorHandler(clientHasNoUserOrPersonAssociated);
    }

    if (!checkPermissionsForClientResources(req.user, company)) {
      throw new ErrorHandler(unauthorized);
    }

    const password = req.body.encrypted_password;

    // Quitamos el password del body para actualizar los datos del company por separado
    if (password) {
      delete req.body.encrypted_password;
      await user.handlePasswordChange(undefined, password);
    }

    await company.updateDetails(user, req.body);
    res.json({ message: `La compañia ${id} fue editada` })
  } catch (error) {
    next(error)
  }
}


module.exports = {
    getAllCompanies,
    getCompanyInfo,
    getAllCompanyClients,
    addClientToCompany,
    removeClientFromCompany,
    deleteCompany,
    editCompany
}