import express from "express";
import bcrypt from "bcryptjs";

const router = express.Router();

// Customer registration
router.post("/register", async (req, res) => {
  try {
    const { full_name, email, phone, password } = req.body;

    // Check required fields
    if (!full_name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, phone and password are required"
      });
    }

    // Basic password validation
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters"
      });
    }

    res.status(201).json({
      success: true,
      message: "Registration data received successfully",
      customer: {
        full_name,
        email,
        phone
      }
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Registration failed"
    });
  }
});

export default router;
