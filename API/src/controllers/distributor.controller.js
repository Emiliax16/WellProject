const db = require("../../models");
const ErrorHandler = require("../utils/error.util");
const checkPermissionsForClientResources = require("../utils/check-permissions");
const {
  companyNotFound,
  distributorNotFound,
  companyDoesntBelongToDistributor,
  distributorHasNoUserOrPersonAssociated,
} = require("../utils/errorcodes.util");

const Company = db.company;
const Distributor = db.distributor;
const User = db.user;
const Person = db.person;

const getAllDistributors = async (req, res, next) => {
  try {
    const distributors = await Distributor.findAll({
      include: [
        {
          model: User,
          as: "user",
          attributes: {
            exclude: ["encrypted_password"],
          },
        },
      ],
    });
    res.json(distributors);
  } catch (error) {
    next(error);
  }
};

const getDistributorInfo = async (req, res, next) => {
  try {
    const { id } = req.params;

    const distributor = await Distributor.findByPk(id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: {
            exclude: ["encrypted_password"],
          },
        },
      ],
    });

    if (!distributor) {
      throw new ErrorHandler(distributorNotFound);
    }

    res.json(distributor);
  } catch (error) {
    next(error);
  }
};

const addCompanyToDistributor = async (req, res, next) => {
  try {
    const { id, companyId } = req.params;

    const distributor = await Distributor.findByPk(id);
    if (!distributor) {
      throw new ErrorHandler(distributorNotFound);
    }

    const company = await Company.findByPk(companyId);
    if (!company) {
      throw new ErrorHandler(companyNotFound);
    }

    await company.update({ distributorId: id });
    console.log(company);
    res.json({
      message: `Compañía ${companyId} fue agregado a la distribuidora ${id}`,
    });
  } catch (error) {
    next(error);
  }
};

const removeCompanyFromDistributor = async (req, res, next) => {
  try {
    const { id, companyId } = req.params;

    const distributor = await Distributor.findByPk(id);
    if (!distributor) {
      throw new ErrorHandler(distributorNotFound);
    }

    const company = await Company.findByPk(companyId);
    if (!company) {
      throw new ErrorHandler(companyNotFound);
    }

    if (company.distributorId !== distributor.id) {
      throw new ErrorHandler(companyDoesntBelongToDistributor);
    }

    await company.update({ distributorId: null });
    res.json({
      message: `Compañía ${companyId} fue removido de la distribuidora ${id}`,
    });
  } catch (error) {
    next(error);
  }
};

const getAllDistributorCompanies = async (req, res, next) => {
  try {
    const { id } = req.params;

    const distributor = await Distributor.findByPk(id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: {
            exclude: ["encrypted_password"],
          },
          include: [
            {
              model: Person,
              as: "person",
              attributes: {
                exclude: ["userId"],
              },
            },
          ],
        },
      ],
    });
    if (!distributor) {
      throw new ErrorHandler(distributorNotFound);
    }
    const companies = await distributor.getCompanies({
      include: [
        {
          model: User,
          as: "user",
          attributes: {
            exclude: ["encrypted_password"],
          },
        },
      ],
    });
    res.json(companies);
  } catch (error) {
    next(error);
  }
};

const deleteDistributor = async (req, res, next) => {
  try {
    const { id } = req.params;

    const distributor = await Distributor.findByPk(id);
    if (!distributor) {
      throw new ErrorHandler(distributorNotFound);
    }

    const user = await distributor.getUser();

    await distributor.destroy();
    await user.destroy();

    res.json({ message: `La distribuidora ${id} fue eliminada` });
  } catch (error) {
    next(error);
  }
};

const editDistributor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const distributor = await Distributor.findByPk(id);
    if (!distributor) {
      throw new ErrorHandler(distributorNotFound);
    }

    const user = await distributor.getUser();

    if (!user) {
      throw new ErrorHandler(distributorHasNoUserOrPersonAssociated);
    }

    if (!checkPermissionsForClientResources(req.user, distributor)) {
      throw new ErrorHandler(unauthorized);
    }

    const password = req.body.encrypted_password;

    // Quitamos el password del body para actualizar los datos del company por separado
    if (password) {
      delete req.body.encrypted_password;
      await user.handlePasswordChange(undefined, password);
    }

    await distributor.updateDetails(user, req.body);
    res.json({ message: `La compañia ${id} fue editada` });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllDistributors,
  getDistributorInfo,
  getAllDistributorCompanies,
  addCompanyToDistributor,
  removeCompanyFromDistributor,
  deleteDistributor,
  editDistributor,
};
