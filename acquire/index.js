const express = require("express");
const { MongoClient } = require("mongodb");

const app = express();
app.use(express.json());

const client = new MongoClient("mongodb://mongo:27017");
let db;

(async () => {
  await client.connect();
  db = client.db("energy");
  console.log("Acquire conectado a Mongo");
})();

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "acquire" });
});

app.post("/data", async (req, res) => {
  try {
    const now = new Date();
    let targetDate = new Date(now);

    if (now.getHours() >= 23) {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    targetDate.setHours(0, 0, 0, 0);

    const timeEnd = new Date(targetDate);
    timeEnd.setMilliseconds(timeEnd.getMilliseconds() - 1);

    const timeStart = new Date(timeEnd);
    timeStart.setDate(timeStart.getDate() - 3);

    const features = [
      120.5,
      118.3,
      115.2,
      now.getHours(),
      now.getDay(),
      now.getMonth() + 1,
      now.getDate()
    ];

    const doc = {
      features,
      featureCount: features.length,
      scalerVersion: "v1",
      createdAt: new Date(),
      targetDate,
      fetchMeta: {
        timeStart,
        timeEnd
      },
      source: "acquire"
    };

    const result = await db
      .collection("prepared_samples")
      .insertOne(doc);

    res.status(201).json({
      dataId: result.insertedId,
      features,
      featureCount: features.length,
      scalerVersion: "v1",
      createdAt: doc.createdAt
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "El servicio Acquire dejó de funcionar"
    });
  }
});

app.listen(3001, () => {
  console.log("Acquire en 3001");
});
