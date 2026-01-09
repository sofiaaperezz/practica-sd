// routes/predictRoutes.js
const express = require("express");
const router = express.Router();

const predictController = require("../controllers/predictController");

// Contrato del servicio PREDICT
router.get("/health", predictController.health);
router.get("/ready", predictController.ready);
router.post("/predict", predictController.doPredict);

module.exports = router;
