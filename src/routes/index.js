import express from "express";
import { createClient } from "@supabase/supabase-js";
import authRoutes from "./auth.js";

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

// Customer authentication routes
router.use("/auth", authRoutes);

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

// Test Supabase connection
router.get("/database-test", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("customers")
      .select("id")
      .limit(1);

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Supabase connection failed",
        error: error.message
      });
    }

    res.json({
      success: true,
      message: "Supabase database connected successfully",
      database: "online",
      records_found: data.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Database connection error"
    });
  }
});

export default router;
