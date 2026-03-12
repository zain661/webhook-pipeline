import express from "express";
import pipelinesRouter from "./routes/pipelines";
import webhooksRouter from "./routes/webhooks";
import jobsRouter from "./routes/jobs";

const app = express();

app.use(express.json());

app.use("/pipelines", pipelinesRouter);
app.use("/webhooks", webhooksRouter);
app.use("/jobs", jobsRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});

export default app;
