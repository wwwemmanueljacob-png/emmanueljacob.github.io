import express from "express";

const router = express.Router();

// API health check
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "JAY C O B Financial Services API is running",
    status: "online",
    timestamp: new Date().toISOString()
  });
});

// API welcome
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to JAY C O B Financial Services API",
    version: "1.0.0"
  });
});

export default router;
