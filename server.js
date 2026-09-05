import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import apiRoutes from "./src/routes/index.js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 8080;

// ==========================================
// MIDDLEWARE
// ==========================================
app.use(cors());

// Accept JSON requests
app.use(express.json({ limit: "1mb" }));

// Accept form-style requests
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ==========================================
// HOME API ROUTE
// ==========================================
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Emmanuel Jacob Backend is running",
    version: "1.0.0"
  });
});

// ==========================================
// MAIN API ROUTES
// ==========================================
app.use("/api", apiRoutes);

// ==========================================
// 404 HANDLER
// ==========================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

// ==========================================
// ERROR HANDLER
// ==========================================
app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error"
  });
});

// ==========================================
// START SERVER
// ==========================================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
