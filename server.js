"use strict";
import "dotenv/config";
import express from "express";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.json({
    message: "TwinCore API is running 🚀",
    status: "ok",
    timestamp: new Date().toISOString()
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

// Example route to test Python model
app.get("/predict", async (req, res) => {
  try {
    const { stdout, stderr } = await execAsync("python3 test_predict.py");
    if (stderr) console.error("Python stderr:", stderr);
    
    res.json({
      success: true,
      prediction: stdout.trim(),
      message: "Python model executed successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// You can add more routes here later
app.post("/api/twin", (req, res) => {
  res.json({
    message: "Digital Twin endpoint ready",
    received: req.body
  });
});

// Start server
app.listen(PORT, () => {
  console.log(✅ TwinCore server started on port ${PORT});
  console.log(🌍 Health check: http://localhost:${PORT}/);
});
