import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

const JWT_SECRET = process.env.JWT_SECRET;

// ==========================================
// ADMIN LOGIN
// ==========================================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    const { data: admin, error } = await supabase
      .from("admins")
      .select("id, full_name, email, password_hash, role, created_at")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Could not access admin account"
      });
    }

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid admin email or password"
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      admin.password_hash
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid admin email or password"
      });
    }

    if (!JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Authentication system is not configured"
      });
    }

    const token = jwt.sign(
      {
        admin_id: admin.id,
        email: admin.email,
        role: admin.role
      },
      JWT_SECRET,
      {
        expiresIn: "7d"
      }
    );

    const { password_hash, ...safeAdmin } = admin;

    res.json({
      success: true,
      message: "Admin login successful",
      token,
      admin: safeAdmin
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Admin login failed"
    });
  }
});

// ==========================================
// ADMIN AUTHENTICATION MIDDLEWARE
// ==========================================
function authenticateAdmin(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Admin authentication token is required"
      });
    }

    const token = authorization.split(" ")[1];

    if (!JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Authentication system is not configured"
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded.admin_id) {
      return res.status(403).json({
        success: false,
        message: "Admin access required"
      });
    }

    req.admin = decoded;

    next();

  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Admin authentication token has expired"
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid admin authentication token"
    });
  }
}

// ==========================================
// ADMIN PROFILE
// ==========================================
router.get("/profile", authenticateAdmin, async (req, res) => {
  try {
    const { data: admin, error } = await supabase
      .from("admins")
      .select("id, full_name, email, role, created_at")
      .eq("id", req.admin.admin_id)
      .maybeSingle();

    if (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Could not retrieve admin profile"
      });
    }

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin account not found"
      });
    }

    res.json({
      success: true,
      message: "Admin profile retrieved successfully",
      admin
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not retrieve admin profile"
    });
  }
});

export default router;
