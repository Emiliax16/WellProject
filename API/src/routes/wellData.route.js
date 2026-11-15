const express = require("express");

const authMiddleware = require("../middlewares/auth.middleware");
const internalKeyMiddleware = require("../middlewares/internal-key.middleware");
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

// Consumidos por el servicio SENDER, que no tiene usuario: en vez del JWT exigen
// la clave interna compartida (`X-Internal-Api-Key`). Sin ella cualquiera podía
// leer todos los reportes pendientes o forzar reenvíos a la DGA.
router.get("/fetchUnsentReports", internalKeyMiddleware, fetchUnsentReports);
router.post("/repostToDGA", internalKeyMiddleware, repostToDGA);

// Acciones disparadas desde el portal: requieren sesión
router.post("/repostAllReportsToDGA", authMiddleware(...AdminAndCompanyAndNormal), repostAllReportsToDGA);
router.delete("/wellData/bulk", authMiddleware(...AdminAndCompanyAndNormal), bulkDeleteWellData);

module.exports = router;
