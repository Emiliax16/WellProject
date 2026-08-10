const db = require("../../models");
const client = require("../../models/client");
const ErrorHandler = require("../utils/error.util");
const {
  userNotFound,
  passwordsDontMatch,
  unauthorized,
} = require("../utils/errorcodes.util");
const checkPermissionsForClientResources = require("../utils/check-permissions");
const company = require("../../models/company");
const distributor = require("../../models/distributor");
const activityLogService = require("../services/activityLog.service");
const { sequelize } = db;
const User = db.user;
const Client = db.client;
const Person = db.person;
const Company = db.company;
const Distributor = db.distributor;
const Role = db.role;

// Control de destino para las creaciones de usuario. `checkPermissions` no
// puede resolverlo: cuando se registra a alguien todavía no existe la entidad
// contra la cual comparar pertenencia, así que lo que se valida es qué rol se
// está creando y bajo qué empresa o distribuidora queda colgando.
// Devuelve la empresa bajo la cual debe quedar el cliente cuando el body no la
// trae. Sin eso, una empresa que da de alta un cliente desde la vista general
// del portal —donde `companyId` viaja como null— crearía un cliente huérfano y
// perdería el acceso al cliente que acaba de crear.
const assertCanCreateUserWithRole = async (requester, targetRole, body, transaction) => {
  const { id: requesterId, type: requesterRole } = requester;

  if (requesterRole === 'admin') {
    return { companyIdPorDefecto: null };
  }

  // Nadie que no sea admin puede fabricar un admin. Es el escalamiento directo.
  if (targetRole === 'admin') {
    throw new ErrorHandler(unauthorized);
  }

  if (requesterRole === 'company') {
    // Una empresa sólo da de alta a sus propios clientes.
    if (targetRole !== 'normal') {
      throw new ErrorHandler(unauthorized);
    }
    const own = await Company.findOne({ where: { userId: requesterId }, transaction });
    if (!own) {
      throw new ErrorHandler(unauthorized);
    }
    if (body.companyId && parseInt(body.companyId, 10) !== own.id) {
      throw new ErrorHandler(unauthorized);
    }
    return { companyIdPorDefecto: own.id };
  }

  if (requesterRole === 'distributor') {
    const own = await Distributor.findOne({ where: { userId: requesterId }, transaction });
    if (!own) {
      throw new ErrorHandler(unauthorized);
    }
    // Sus empresas, y los clientes que cuelguen de esas empresas.
    if (targetRole === 'company') {
      if (body.distributorId && parseInt(body.distributorId, 10) !== own.id) {
        throw new ErrorHandler(unauthorized);
      }
      return { companyIdPorDefecto: null };
    }
    if (targetRole === 'normal') {
      // Una distribuidora no tiene una empresa "propia" evidente, así que si no
      // indica cuál, el cliente queda sin empresa igual que antes.
      if (!body.companyId) {
        return { companyIdPorDefecto: null };
      }
      const target = await Company.findByPk(parseInt(body.companyId, 10), { transaction });
      if (!target || target.distributorId !== own.id) {
        throw new ErrorHandler(unauthorized);
      }
      return { companyIdPorDefecto: null };
    }
  }

  throw new ErrorHandler(unauthorized);
};

//           GET USER DATA

const getUsers = async (req, res, next) => {
  try {
    const users = await User.findAll({
      attributes: {
        exclude: ["encrypted_password"],
      },
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
};

const getUserInfo = async (req, res, next) => {
  try {
    const { id } = req.user;

    const user = await User.findByPk(id, {
      attributes: { exclude: ["encrypted_password"] },
      include: {
        model: Role,
        as: "role",
        attributes: ["type"],
      },
    });

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const userRoleType = user.role.type;

    if (userRoleType === "company") {
      const userWithCompany = await User.findByPk(id, {
        attributes: { exclude: ["encrypted_password"] },
        include: {
          model: Company,
          as: "company",
        },
      });
      return res.json(userWithCompany);
    } else if (userRoleType === "distributor") {
      const userWithDistributor = await User.findByPk(id, {
        attributes: { exclude: ["encrypted_password"] },
        include: {
          model: Distributor,
          as: "distributor",
        },
      });
      return res.json(userWithDistributor);
    } else {
      const userWithClient = await User.findByPk(id, {
        attributes: { exclude: ["encrypted_password"] },
        include: {
          model: Client,
          as: "client",
        },
      });
      return res.json(userWithClient);
    }
  } catch (error) {
    next(error);
  }
};

const getUserInfoById = async (req, res, next) => {
  try {
    // si los id no son iguales, solo se puede proceder si el rol del usuario es admin
    const { id: clientId } = req.params;

    const client = await Client.findByPk(clientId);
    const userId = client.userId;

    if (!await checkPermissionsForClientResources(req.user, client)) {
      throw new ErrorHandler(unauthorized);
    }

    const user = await User.findByPk(userId, {
      attributes: { exclude: ["encrypted_password"] },
      include: {
        model: Person,
        as: "person",
        attributes: {
          exclude: ["userId"],
        },
      },
    });

    if (!user) {
      throw new ErrorHandler(userNotFound);
    }

    const role = await Role.findByPk(user.roleId);

    if (!role) {
      throw new ErrorHandler(roleNotFound);
    }

    const userWithRole = {
      ...user.toJSON(),
      role: role.type,
    };

    res.json(userWithRole);
  } catch (error) {
    next(error);
  }
};

//                USER WELLS

//                USER AUTH

const registerUser = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id: requesterId, type: requesterRole } = req.user;
    if (!await checkPermissionsForClientResources(req.user, undefined, true)) {
      throw new ErrorHandler(unauthorized);
    }
    delete req.body.id;

    const userParams = {
      name: req.body.name,
      email: req.body.email,
      encrypted_password: req.body.encrypted_password,
      roleId: req.body.roleId,
      isActived: req.body.isActived,
      createdBy: requesterId,
    };

    const role = await Role.findByPk(userParams.roleId, { transaction });
    // `userParams` y `req.body` llevan `encrypted_password` sin hashear.
    console.log(`[users] registrando ${userParams.email} con rol ${role?.type}`);

    if (!role) {
      throw new ErrorHandler(userNotFound);
    }

    // En una creación no hay entidad contra la cual comprobar pertenencia, así
    // que el control es sobre el destino: a quién se está creando y bajo quién
    // queda colgando. Sin esto, una empresa podría crearse un admin o meter un
    // cliente bajo otra empresa.
    const { companyIdPorDefecto } = await assertCanCreateUserWithRole(
      req.user, role.type, req.body, transaction
    );

    const user = await User.create(userParams, {
      transaction,
      individualHooks: true,
    });

    let createdClient = null;
    let createdCompany = null;
    let createdDistributor = null;

    if (role.type === "normal") {
      const clientParams = { userId: user.id };
      if (req.body.companyId) {
        clientParams.companyId = parseInt(req.body.companyId, 10);
      } else if (companyIdPorDefecto) {
        // El portal manda `companyId: null` al crear desde la vista general.
        clientParams.companyId = companyIdPorDefecto;
      }

      createdClient = await Client.create(clientParams, { transaction });
    }

    let personalParams = {};
    if (role.type === "normal" || role.type === "admin") {
      personalParams = {
        fullName: req.body.fullName,
        location: req.body.location,
        phoneNumber: req.body.phoneNumber,
        personalEmail: req.body.personalEmail,
        userId: user.id,
      };

      await Person.create(personalParams, { transaction });
    } else if (role.type === "company") {
      personalParams = {
        companyLogo: req.body.companyLogo,
        companyRut: req.body.companyRut,
        phoneNumber: req.body.phoneNumber,
        recoveryEmail: req.body.recoveryEmail,
        location: req.body.location,
        userId: user.id,
        distributorId: req.body?.distributorId,
      };

      createdCompany = await Company.create(personalParams, { transaction });
    } else if (role.type === "distributor") {
      personalParams = {
        distributorLogo: req.body.distributorLogo,
        distributorRut: req.body.distributorRut,
        phoneNumber: req.body.phoneNumber,
        recoveryEmail: req.body.recoveryEmail,
        location: req.body.location,
        userId: user.id,
      };

      createdDistributor = await Distributor.create(personalParams, {
        transaction,
      });
    }

    await transaction.commit();

    try {
      if (createdClient) {
        const context = {
          client: { id: createdClient.id, name: req.body.fullName },
        };

        if (req.body.companyId) {
          const clientCompany = await Company.findByPk(req.body.companyId, {
            include: [
              {
                model: User,
                as: "user",
                include: [{ model: Person, as: "person" }],
              },
            ],
          });
          if (clientCompany) {
            context.company = {
              id: clientCompany.id,
              name:
                clientCompany.user?.person?.fullName || clientCompany.user?.email,
            };

            if (clientCompany.distributorId) {
              const clientDistributor = await Distributor.findByPk(
                clientCompany.distributorId,
                {
                  include: [
                    {
                      model: User,
                      as: "user",
                      include: [{ model: Person, as: "person" }],
                    },
                  ],
                }
              );
              if (clientDistributor) {
                context.distributor = {
                  id: clientDistributor.id,
                  name:
                    clientDistributor.user?.person?.fullName ||
                    clientDistributor.user?.email,
                };
              }
            }
          }
        }

        await activityLogService.createActivityLog({
          action: "created",
          entityType: "client",
          entityId: createdClient.id,
          entityName: req.body.fullName,
          context,
          userId: requesterId,
        });
      }

      if (createdCompany) {
        const context = {
          company: { id: createdCompany.id, name: req.body.name },
        };

        if (createdCompany.distributorId) {
          const companyDistributor = await Distributor.findByPk(
            createdCompany.distributorId,
            {
              include: [
                {
                  model: User,
                  as: "user",
                  include: [{ model: Person, as: "person" }],
                },
              ],
            }
          );
          if (companyDistributor) {
            context.distributor = {
              id: companyDistributor.id,
              name:
                companyDistributor.user?.person?.fullName ||
                companyDistributor.user?.email,
            };
          }
        }

        await activityLogService.createActivityLog({
          action: "created",
          entityType: "company",
          entityId: createdCompany.id,
          entityName: req.body.name,
          context,
          userId: requesterId,
        });
      }

      if (createdDistributor) {
        await activityLogService.createActivityLog({
          action: "created",
          entityType: "distributor",
          entityId: createdDistributor.id,
          entityName: req.body.name,
          context: {
            distributor: { id: createdDistributor.id, name: req.body.name },
          },
          userId: requesterId,
        });
      }
    } catch (logError) {
      // Log the error but don't fail the main operation
      console.error("Error creating activity log:", logError);
    }

    delete user.dataValues.encrypted_password;
    const token = await user.generateToken();
    res.json({ user, token });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new ErrorHandler(userNotFound);
    }
    const isValid = await user.checkPassword(password);
    if (!isValid) {
      throw new ErrorHandler(passwordsDontMatch);
    }
    const role = await user.getRole();
    if (role.type !== "admin" && !user.isActived) {
      throw new ErrorHandler(unauthorized);
    }

    delete user.dataValues.encrypted_password;
    const token = await user.generateToken();
    res.status(201).json({ user, token });
  } catch (error) {
    next(error);
  }
};

const getUserRoleById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);

    if (!user) {
      throw new ErrorHandler(userNotFound);
    }

    const role = await user.getRole();
    if (!role) {
      throw new ErrorHandler(userNotFound);
    }

    res.status(200).json(role);
  } catch (error) {
    next(error);
  }
};

const getAllUserRoles = async (req, res, next) => {
  try {
    const roles = await Role.findAll();
    res.status(200).json(roles);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  getUserInfo,
  getUserInfoById,
  registerUser,
  loginUser,
  getUserRoleById,
  getAllUserRoles,
};
