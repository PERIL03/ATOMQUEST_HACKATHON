require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const { authMiddleware } = require("./middleware/auth");

const authRoutes = require("./routes/auth");
const goalSheetRoutes = require("./routes/goalsheets");
const goalRoutes = require("./routes/goals");
const achievementRoutes = require("./routes/achievements");
const checkinRoutes = require("./routes/checkins");
const adminRoutes = require("./routes/admin");
const reportRoutes = require("./routes/reports");
const dashboardRoutes = require("./routes/dashboard");
const { runEscalations } = require("./services/escalations");

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

const healthPayload = () => ({
  status: "ok",
  uptimeSeconds: Math.floor(process.uptime()),
  timestamp: new Date().toISOString(),
});

app.get("/health", (req, res) => {
  res.json(healthPayload());
});

app.get("/healthz", (req, res) => {
  res.json(healthPayload());
});

app.get("/api/health", (req, res) => {
  res.json(healthPayload());
});

app.get("/api/healthz", (req, res) => {
  res.json(healthPayload());
});

app.use("/api/auth", authRoutes);

app.use("/api", authMiddleware);
app.use("/api/goalsheets", goalSheetRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/achievements", achievementRoutes);
app.use("/api/checkins", checkinRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/dashboard", dashboardRoutes);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`API running on port ${port}`);
});

if (process.env.ENABLE_ESCALATIONS !== "false") {
  runEscalations().catch((error) => console.error("Escalation run failed", error));
  setInterval(() => {
    runEscalations().catch((error) => console.error("Escalation run failed", error));
  }, 1000 * 60 * 60 * 12);
}
