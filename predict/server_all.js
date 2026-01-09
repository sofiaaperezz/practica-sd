// server-predict.js
// Servicio 3: PREDICT
// Cumple el contrato oficial: /health, /ready, /predict

const express = require('express');
const path = require('path');
const { pathToFileURL } = require('url');
const tf = require('@tensorflow/tfjs');
const wasmBackend = require('@tensorflow/tfjs-backend-wasm');

const MODEL_VERSION = "v1.0";
const PORT = process.env.PORT || 3002;

// ---------------------------------------------------------------------
//  CONFIG EXPRESS
// ---------------------------------------------------------------------
const app = express();
app.use(express.json());

// ---------------------------------------------------------------------
//  LOAD TFJS MODEL
// ---------------------------------------------------------------------
let model = null;
let ready = false;
let inputName = null;
let outputName = null;
let inputDim = null;

const modelDir = path.resolve(__dirname, "model");
app.use('/model', express.static(modelDir));

function wasmFileDirUrl() {
  const distFsPath = path.join(
    __dirname,
    "node_modules",
    "@tensorflow",
    "tfjs-backend-wasm",
    "dist"
  );
  return pathToFileURL(distFsPath + path.sep).href;
}

async function loadModel(serverUrl) {
  await tf.setBackend("wasm");
  const wasmPath = wasmFileDirUrl();
  wasmBackend.setWasmPaths(wasmPath);

  await tf.ready();
  console.log("[TF] Backend:", tf.getBackend());

  const modelUrl = `${serverUrl}/model/model.json`;
  console.log("[TF] Cargando modelo:", modelUrl);

  model = await tf.loadGraphModel(modelUrl);

  if (model && model.inputs && model.inputs.length > 0) {
    inputName = model.inputs[0].name;
    inputDim = model.inputs[0].shape[1];
  }
  if (model && model.outputs && model.outputs.length > 0) {
    outputName = model.outputs[0].name;
  }

  console.log("[TF] inputName:", inputName);
  console.log("[TF] outputName:", outputName);
  console.log("[TF] inputDim:", inputDim);

  // warm-up
  const Xwarm = tf.zeros([1, inputDim], "float32");
  let out = null;
  if (typeof model.executeAsync === "function") {
    out = await model.executeAsync({ [inputName]: Xwarm });
  } else {
    out = model.execute({ [inputName]: Xwarm });
  }

  if (Array.isArray(out)) out.forEach(t => t.dispose?.());
  else if (out && out.dispose) out.dispose();

  Xwarm.dispose();

  ready = true;
  console.log("[TF] Modelo listo.");
}

// ---------------------------------------------------------------------
//  ENDPOINTS
// ---------------------------------------------------------------------

// GET /health
app.get('/health', (req, res) => {
  res.json({
    status: "ok",
    service: "predict"
  });
});

// GET /ready
app.get('/ready', (req, res) => {
  if (!ready) {
    return res.status(503).json({
      ready: false,
      modelVersion: MODEL_VERSION,
      message: "Model is still loading"
    });
  }

  res.json({
    ready: true,
    modelVersion: MODEL_VERSION
  });
});

// POST /predict
app.post('/predict', async (req, res) => {
  const start = Date.now();

  try {
    if (!ready || !model) {
      return res.status(503).json({
        error: "Model not ready",
        ready: false
      });
    }

    const { features, meta } = req.body;

    // Validaciones contrato
    if (!features) {
      return res.status(400).json({ error: "Missing features" });
    }
    if (!meta || typeof meta !== "object") {
      return res.status(400).json({ error: "Missing meta object" });
    }

    const { featureCount, dataId, source, correlationId } = meta;

    if (featureCount !== inputDim) {
      return res.status(400).json({
        error: `featureCount must be ${inputDim}, received ${featureCount}`
      });
    }

    if (!Array.isArray(features) || features.length !== inputDim) {
      return res.status(400).json({
        error: `features must be an array of ${inputDim} numbers`
      });
    }

    // Tensores
    const X = tf.tensor2d([features], [1, inputDim], "float32");

    let out;
    if (typeof model.executeAsync === "function") {
      out = await model.executeAsync({ [inputName]: X });
    } else {
      out = model.execute({ [inputName]: X });
    }

    const preds2d = Array.isArray(out)
      ? await out[0].array()
      : await out.array();

    const prediction_real = preds2d[0][0];
    const prediction = Math.max(prediction_real, 0);

    // Limpieza
    if (Array.isArray(out)) out.forEach(t => t.dispose?.());
    else if (out.dispose) out.dispose();
    X.dispose();


    const latencyMs = Date.now() - start;

    // Respuesta 201
    res.status(201).json({
      prediction,
      latencyMs
    });

  } catch (err) {
    console.error("Error en /predict:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// ---------------------------------------------------------------------
//  START SERVER
// ---------------------------------------------------------------------
app.listen(PORT, async () => {
  const serverUrl = `http://localhost:${PORT}`;
  console.log(`[PREDICT] Servicio en ${serverUrl}`);

  await loadModel(serverUrl);
});
