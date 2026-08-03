const express = require("express");

const authMiddleware = require("../middlewares/auth.middleware");
const {
  createWellData,
  bulkCreateWellData,
  fetchUnsentReports,
  repostToDGA,
  repostAllReportsToDGA,
  bulkDeleteWellData,
} = require("../controllers/wellData.controller");
const {
  AdminAndCompanyAndNormal,
} = require("../utils/allowed-roles.util");
const router = express.Router();

// Ingesta desde los dispositivos IoT: sin JWT a propósito (ver README)
router.post("/wellData", createWellData);
router.post("/massImportWellData", bulkCreateWellData);

// Consumidos por el servicio SENDER: sin JWT a propósito (ver README)
router.get("/fetchUnsentReports", fetchUnsentReports);
router.post("/repostToDGA", repostToDGA);

// Acciones disparadas desde el portal: requieren sesión
router.post("/repostAllReportsToDGA", authMiddleware(...AdminAndCompanyAndNormal), repostAllReportsToDGA);
router.delete("/wellData/bulk", authMiddleware(...AdminAndCompanyAndNormal), bulkDeleteWellData);

module.exports = router;
