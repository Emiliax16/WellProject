const db = require('../../models');
const ErrorHandler = require('../utils/error.util');
const checkPermissionsForClientResources = require('../utils/check-permissions');
const assertCanChangeRole = require('../utils/assert-role-change');
const { companyNotFound, clientNotFound, clientDoesntBelongToCompany, clientHasNoUserOrPersonAssociated, unauthorized } = require('../utils/errorcodes.util');

const Company = db.company;
const User = db.user;
const Person = db.person;
const Client = db.client;
const Distributor = db.distributor;

// El listado se acota al alcance de quien consulta en vez de rechazar: un admin
// sigue viendo todas, una distribuidora sólo las suyas y una empresa sólo la
// propia. Antes cualquier empresa recibía las demás con su usuario asociado.
//
// Devuelve `null` cuando quien consulta no gestiona ninguna empresa. Ojo con
// resolverlo como `{ distributorId: null }`: ese filtro trae justamente todas
// las empresas sin distribuidora.
const alcanceDeEmpresas = async (user) => {
  if (user.type === 'admin') {
    return {};
  }
  if (user.type === 'distributor') {
    const distributor = await Distributor.findOne({ where: { userId: user.id } });
    return distributor ? { distributorId: distributor.id } : null;
  }
  return { userId: user.id };
}

const getAllCompanies = async (req, res, next) => {
  try {
    const alcance = await alcanceDeEmpresas(req.user);
    if (!alcance) {
      return res.json([]);
    }
    const companies = await Company.findAll({
      where: alcance,
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

    if (!await checkPermissionsForClientResources(req.user, company)) {
      throw new ErrorHandler(unauthorized)
    }

    res.json(company)
  } catch (error) {
    next(error)
  }
}

const addClientToCompany = async (req, res, next) => {
  try {
      // Asignar o quitar clientes decide a qué empresa pertenecen, y con eso
      // quién puede leer sus credenciales DGA o cambiarles la contraseña. Sólo
      // un admin puede hacerlo; la ruta ya lo exige y esto lo repite por si
      // alguien la vuelve a abrir.
      if (req.user.type !== 'admin') {
          throw new ErrorHandler(unauthorized)
      }

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
      res.json({ message: `Cliente ${clientId} fue agregado a la compañia ${id}` })
  } catch (error) {
      next(error)
  }
}

const removeClientFromCompany = async (req, res, next) => {
  try {
      // Igual que al asignar: quitar un cliente de su empresa cambia quién
      // puede gestionarlo. Sólo un admin puede hacerlo.
      if (req.user.type !== 'admin') {
          throw new ErrorHandler(unauthorized)
      }

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
    if (!await checkPermissionsForClientResources(req.user, company)) {
        throw new ErrorHandler(unauthorized)
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

    if (!await checkPermissionsForClientResources(req.user, company)) {
      throw new ErrorHandler(unauthorized);
    }

    assertCanChangeRole(req.user, user, req.body);

    // `distributorId` decide de qué distribuidora cuelga la empresa, y con eso
    // quién ve sus clientes. Sólo un admin lo cambia; para el resto se ignora,
    // igual que cualquier campo no editable.
    if (req.user.type !== 'admin') {
      delete req.body.distributorId;
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