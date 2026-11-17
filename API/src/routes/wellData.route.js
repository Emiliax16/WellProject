const express = require("express");

const authMiddleware = require("../middlewares/auth.middleware");
const {
  createWellData,
  bulkCreateWellData,
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

// `/fetchUnsentReports` y `/repostToDGA`, que consumía el SENDER, ya no
// existen: el reintento a la DGA corre dentro de la API (`src/jobs/dga-retry.js`)
// y no necesita rutas expuestas.

// Acciones disparadas desde el portal: requieren sesión
router.post("/repostAllReportsToDGA", authMiddleware(...AdminAndCompanyAndNormal), repostAllReportsToDGA);
router.delete("/wellData/bulk", authMiddleware(...AdminAndCompanyAndNormal), bulkDeleteWellData);

module.exports = router;
