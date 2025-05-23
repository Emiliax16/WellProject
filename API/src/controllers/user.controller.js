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
const { sequelize } = db;
const User = db.user;
const Client = db.client;
const Person = db.person;
const Company = db.company;
const Distributor = db.distributor;
const Role = db.role;

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

    if (!checkPermissionsForClientResources(req.user, client)) {
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

    if (!checkPermissionsForClientResources(req.user, undefined, true)) {
      throw new ErrorHandler(unauthorized);
    }

    const userParams = {
      name: req.body.name,
      email: req.body.email,
      encrypted_password: req.body.encrypted_password,
      roleId: req.body.roleId,
      isActived: req.body.isActived,
      createdBy: requesterId,
    };

    const role = await Role.findByPk(userParams.roleId, { transaction });

    if (!role) {
      throw new ErrorHandler(userNotFound);
    }

    const user = await User.create(userParams, {
      transaction,
      individualHooks: true,
    });

    if (role.type === "normal") {
      const clientParams = { userId: user.id };
      if (req.body.companyId) {
        clientParams.companyId = parseInt(req.body.companyId, 10);
      }

      await Client.create(clientParams, { transaction });
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

      await Company.create(personalParams, { transaction });
    } else if (role.type === "distributor") {
      personalParams = {
        distributorLogo: req.body.distributorLogo,
        distributorRut: req.body.distributorRut,
        phoneNumber: req.body.phoneNumber,
        recoveryEmail: req.body.recoveryEmail,
        location: req.body.location,
        userId: user.id,
      };

      await Distributor.create(personalParams, { transaction });
    }

    await transaction.commit();

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
