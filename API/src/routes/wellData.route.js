const express = require("express");

const {
  createWellData,
  bulkCreateWellData,
  fetchUnsentReports,
  repostToDGA,
  repostAllReportsToDGA,
} = require("../controllers/wellData.controller");
const router = express.Router();

router.post("/wellData", createWellData);
router.get("/fetchUnsentReports", fetchUnsentReports);
router.post("/repostAllReportsToDGA", repostAllReportsToDGA);
router.post("/repostToDGA", repostToDGA);
router.post("/massImportWellData", bulkCreateWellData);

module.exports = router;
