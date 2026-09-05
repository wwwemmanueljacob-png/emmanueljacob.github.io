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

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Admin authentication token is missing"
      });
    }

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

// ==========================================
// ADMIN DASHBOARD
// ==========================================
router.get("/dashboard", authenticateAdmin, async (req, res) => {
  try {

    // ------------------------------------------
    // COUNT CUSTOMERS
    // ------------------------------------------
    const { count: customersCount, error: customersError } =
      await supabase
        .from("customers")
        .select("id", { count: "exact", head: true });

    if (customersError) {
      console.error(customersError);

      return res.status(500).json({
        success: false,
        message: "Could not retrieve customer statistics"
      });
    }

    // ------------------------------------------
    // COUNT LOAN APPLICATIONS
    // ------------------------------------------
    const { count: loansCount, error: loansError } =
      await supabase
        .from("loan_applications")
        .select("id", { count: "exact", head: true });

    if (loansError) {
      console.error(loansError);

      return res.status(500).json({
        success: false,
        message: "Could not retrieve loan statistics"
      });
    }

    // ------------------------------------------
    // COUNT PENDING LOANS
    // ------------------------------------------
    const { count: pendingLoansCount, error: pendingLoansError } =
      await supabase
        .from("loan_applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");

    if (pendingLoansError) {
      console.error(pendingLoansError);

      return res.status(500).json({
        success: false,
        message: "Could not retrieve pending loan statistics"
      });
    }

    // ------------------------------------------
    // COUNT APPROVED LOANS
    // ------------------------------------------
    const { count: approvedLoansCount, error: approvedLoansError } =
      await supabase
        .from("loan_applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved");

    if (approvedLoansError) {
      console.error(approvedLoansError);

      return res.status(500).json({
        success: false,
        message: "Could not retrieve approved loan statistics"
      });
    }

    // ------------------------------------------
    // COUNT PAYMENTS
    // ------------------------------------------
    const { count: paymentsCount, error: paymentsError } =
      await supabase
        .from("payments")
        .select("id", { count: "exact", head: true });

    if (paymentsError) {
      console.error(paymentsError);

      return res.status(500).json({
        success: false,
        message: "Could not retrieve payment statistics"
      });
    }

    // ------------------------------------------
    // COUNT SUPPORT MESSAGES
    // ------------------------------------------
    const { count: supportCount, error: supportError } =
      await supabase
        .from("support_messages")
        .select("id", { count: "exact", head: true });

    if (supportError) {
      console.error(supportError);

      return res.status(500).json({
        success: false,
        message: "Could not retrieve support statistics"
      });
    }

    // ------------------------------------------
    // COUNT NEW SUPPORT MESSAGES
    // ------------------------------------------
    const { count: newSupportCount, error: newSupportError } =
      await supabase
        .from("support_messages")
        .select("id", { count: "exact", head: true })
        .eq("status", "new");

    if (newSupportError) {
      console.error(newSupportError);

      return res.status(500).json({
        success: false,
        message: "Could not retrieve new support statistics"
      });
    }

    // ------------------------------------------
    // RETURN DASHBOARD
    // ------------------------------------------
    res.json({
      success: true,
      message: "Admin dashboard retrieved successfully",
      dashboard: {
        customers: customersCount || 0,
        loan_applications: loansCount || 0,
        pending_loans: pendingLoansCount || 0,
        approved_loans: approvedLoansCount || 0,
        payments: paymentsCount || 0,
        support_messages: supportCount || 0,
        new_support_messages: newSupportCount || 0
      }
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not retrieve admin dashboard"
    });
  }
});

export default router;
