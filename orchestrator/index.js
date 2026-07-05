const express = require("express");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const { SECRET, verificarToken } = require("./middleware/auth");

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "orchestrator" });
});

app.post("/login", (req, res) => {

  const { username, password } = req.body;

  if (username !== "admin" || password !== "1234") {
    return res.status(401).json({
      error: "Usuario o contraseña incorrectos"
    });
  }

  const token = jwt.sign(
    {
      username: username
    },
    SECRET,
    {
      expiresIn: "1h"
    }
  );

  res.json({
    token
  });

});


app.post("/run", verificarToken, async (req, res) => {
    try {

    const acquireRes = await axios.post("http://acquire:3001/data");

    const { dataId, features } = acquireRes.data;

    const predictRes = await axios.post(
      "http://predict:3002/predict",
      {
        features,
        meta: {
          featureCount: features.length,
          dataId,
          source: "orchestrator"
        }
      }
    );

    res.json({
      dataId,
      predictionId: predictRes.data.predictionId,
      prediction: predictRes.data.prediction,
      timestamp: predictRes.data.timestamp
    });

  } catch (err) {
    console.error(err);

    res.status(502).json({
      error: "Fallo en el flujo"
    });
  }
});

app.listen(8080, () => {
  console.log("Orchestrator en 8080");
});