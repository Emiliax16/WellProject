const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const {
  getAllDistributors,
  getDistributorInfo,
  getAllDistributorCompanies,
  addCompanyToDistributor,
  removeCompanyFromDistributor,
  deleteDistributor,
  editDistributor,
} = require("../controllers/distributor.controller");
const router = express.Router();

router.get("/distributors", authMiddleware("admin"), getAllDistributors);
router.get(
  "/distributors/:id",
  authMiddleware("admin", "distributor"),
  getDistributorInfo
);
router.get(
  "/distributors/:id/companies",
  authMiddleware("admin", "distributor"),
  getAllDistributorCompanies
);
router.post(
  "/distributors/:id/companies/:companyId",
  authMiddleware("admin", "distributor"),
  addCompanyToDistributor
);
router.delete(
  "/distributors/:id/companies/:companyId",
  authMiddleware("admin", "distributor"),
  removeCompanyFromDistributor
);
router.delete(
  "/distributors/:id/delete",
  authMiddleware("admin"),
  deleteDistributor
);
router.put("/distributors/:id/edit", authMiddleware("admin"), editDistributor);

module.exports = router;
