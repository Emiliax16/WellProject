const db = require("../../models");

const User = db.user;
const Role = db.role;
const Client = db.client;
const Company = db.company;
const Distributor = db.distributor;
const Well = db.well;
const Op = db.Op;

/**
 * Get global statistics for the admin dashboard
 * Returns total counts and monthly trends for clients, companies, distributors, and wells
 */
const getGlobalStats = async (req, res) => {
  try {
    // Calculate date range for "this month"
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get role IDs dynamically
    const normalRole = await Role.findOne({ where: { type: "normal" } });
    const companyRole = await Role.findOne({ where: { type: "company" } });
    const distributorRole = await Role.findOne({
      where: { type: "distributor" },
    });

    // Count total clients (active users with role 'normal')
    const totalClients = await User.count({
      where: {
        roleId: normalRole?.id,
        isActived: true,
      },
    });

    // Count clients created this month
    const clientsThisMonth = await User.count({
      where: {
        roleId: normalRole?.id,
        isActived: true,
        createdAt: {
          [Op.gte]: firstDayOfMonth,
        },
      },
    });

    // Count total companies (active users with role 'company')
    const totalCompanies = await User.count({
      where: {
        roleId: companyRole?.id,
        isActived: true,
      },
    });

    // Count companies created this month
    const companiesThisMonth = await User.count({
      where: {
        roleId: companyRole?.id,
        isActived: true,
        createdAt: {
          [Op.gte]: firstDayOfMonth,
        },
      },
    });

    // Count total distributors (active users with role 'distributor')
    const totalDistributors = await User.count({
      where: {
        roleId: distributorRole?.id,
        isActived: true,
      },
    });

    // Count distributors created this month
    const distributorsThisMonth = await User.count({
      where: {
        roleId: distributorRole?.id,
        isActived: true,
        createdAt: {
          [Op.gte]: firstDayOfMonth,
        },
      },
    });

    // Count total active wells
    const totalWells = await Well.count({
      where: {
        isActived: true,
      },
    });

    // Count wells created this month
    const wellsThisMonth = await Well.count({
      where: {
        isActived: true,
        createdAt: {
          [Op.gte]: firstDayOfMonth,
        },
      },
    });

    return res.status(200).json({
      clients: {
        total: totalClients,
        trend: clientsThisMonth,
      },
      companies: {
        total: totalCompanies,
        trend: companiesThisMonth,
      },
      distributors: {
        total: totalDistributors,
        trend: distributorsThisMonth,
      },
      wells: {
        total: totalWells,
        trend: wellsThisMonth,
      },
    });
  } catch (error) {
    console.error("Error fetching global stats:", error);
    return res.status(500).json({
      message: "Error al obtener estadísticas globales",
      error: error.message,
    });
  }
};

module.exports = {
  getGlobalStats,
};
