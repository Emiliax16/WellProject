const express = require("express");

const {
  createWellData,
  bulkCreateWellData,
  fetchUnsentReports,
  repostToDGA,
  repostAllReportsToDGA,
  bulkDeleteWellData,
} = require("../controllers/wellData.controller");
const router = express.Router();

router.post("/wellData", createWellData);
router.get("/fetchUnsentReports", fetchUnsentReports);
router.post("/repostAllReportsToDGA", repostAllReportsToDGA);
router.post("/repostToDGA", repostToDGA);
router.post("/massImportWellData", bulkCreateWellData);
router.delete("/wellData/bulk", bulkDeleteWellData);

module.exports = router;
