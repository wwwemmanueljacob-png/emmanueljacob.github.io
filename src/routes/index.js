import express from "express";
import { createClient } from "@supabase/supabase-js";
import authRoutes from "./auth.js";
import loanRoutes from "./loans.js";
import paymentRoutes from "./payments.js";
import supportRoutes from "./support.js";

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

// ==========================================
// CUSTOMER AUTHENTICATION ROUTES
// ==========================================
router.use("/auth", authRoutes);

// ==========================================
// LOAN ROUTES
// ==========================================
router.use("/loans", loanRoutes);

// ==========================================
// PAYMENT ROUTES
// ==========================================
router.use("/payments", paymentRoutes);

// ==========================================
// SUPPORT ROUTES
// ==========================================
router.use("/support", supportRoutes);

// ==========================================
// API HEALTH CHECK
// ==========================================
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "JAY C O B Financial Services API is running",
    status: "online",
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// API WELCOME
// ==========================================
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to JAY C O B Financial Services API",
    version: "1.0.0"
  });
});

// ==========================================
// TEST SUPABASE CONNECTION
// ==========================================
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
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Database connection error"
    });
  }
});

export default router;
