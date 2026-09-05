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

    return res.json({
      success: true,
      message: "Admin login successful",
      token,
      admin: safeAdmin
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Admin login failed"
    });
  }
});

// ==========================================
// ADMIN AUTHENTICATION
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

    const token = authorization.substring(7);

    if (!token || !JWT_SECRET) {
      return res.status(401).json({
        success: false,
        message: "Invalid admin authentication"
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
    console.error(error);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired admin authentication token"
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

    return res.json({
      success: true,
      message: "Admin profile retrieved successfully",
      admin
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
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
    const customers = await supabase
      .from("customers")
      .select("id", { count: "exact", head: true });

    const loans = await supabase
      .from("loan_applications")
      .select("id", { count: "exact", head: true });

    const pendingLoans = await supabase
      .from("loan_applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    const approvedLoans = await supabase
      .from("loan_applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved");

    const rejectedLoans = await supabase
      .from("loan_applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "rejected");

    const payments = await supabase
      .from("payments")
      .select("id", { count: "exact", head: true });

    const support = await supabase
      .from("support_messages")
      .select("id", { count: "exact", head: true });

    const newSupport = await supabase
      .from("support_messages")
      .select("id", { count: "exact", head: true })
      .eq("status", "new");

    const results = [
      customers,
      loans,
      pendingLoans,
      approvedLoans,
      rejectedLoans,
      payments,
      support,
      newSupport
    ];

    const failed = results.find((result) => result.error);

    if (failed) {
      console.error(failed.error);

      return res.status(500).json({
        success: false,
        message: "Could not retrieve dashboard statistics"
      });
    }

    return res.json({
      success: true,
      message: "Admin dashboard retrieved successfully",
      dashboard: {
        customers: customers.count || 0,
        loan_applications: loans.count || 0,
        pending_loans: pendingLoans.count || 0,
        approved_loans: approvedLoans.count || 0,
        rejected_loans: rejectedLoans.count || 0,
        payments: payments.count || 0,
        support_messages: support.count || 0,
        new_support_messages: newSupport.count || 0
      }
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Could not retrieve admin dashboard"
    });
  }
});

// ==========================================
// GET ALL CUSTOMERS
// ==========================================
router.get("/customers", authenticateAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("customers")
      .select("id, full_name, email, phone, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Could not retrieve customers"
      });
    }

    return res.json({
      success: true,
      message: "Customers retrieved successfully",
      customers: data || [],
      total: data ? data.length : 0
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Could not retrieve customers"
    });
  }
});

// ==========================================
// GET ALL LOANS
// ==========================================
router.get("/loans", authenticateAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("loan_applications")
      .select(
        "id, customer_id, loan_type, amount, duration_months, purpose, status, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Could not retrieve loan applications"
      });
    }

    return res.json({
      success: true,
      message: "Loan applications retrieved successfully",
      loans: data || [],
      total: data ? data.length : 0
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Could not retrieve loan applications"
    });
  }
});

// ==========================================
// UPDATE LOAN STATUS
// ==========================================
router.patch(
  "/loans/:id/status",
  authenticateAdmin,
  async (req, res) => {
    try {
      const { status } = req.body;

      if (!["pending", "approved", "rejected"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid loan status"
        });
      }

      const { data, error } = await supabase
        .from("loan_applications")
        .update({ status })
        .eq("id", req.params.id)
        .select(
          "id, customer_id, loan_type, amount, duration_months, purpose, status, created_at"
        )
        .maybeSingle();

      if (error) {
        console.error(error);

        return res.status(500).json({
          success: false,
          message: "Could not update loan status"
        });
      }

      if (!data) {
        return res.status(404).json({
          success: false,
          message: "Loan application not found"
        });
      }

      return res.json({
        success: true,
        message: "Loan status updated successfully",
        loan: data
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Could not update loan status"
      });
    }
  }
);

// ==========================================
// GET ALL PAYMENTS
// ==========================================
router.get("/payments", authenticateAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("payments")
      .select(
        "id, customer_id, loan_application_id, amount, payment_method, payment_status, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Could not retrieve payments"
      });
    }

    return res.json({
      success: true,
      message: "Payments retrieved successfully",
      payments: data || [],
      total: data ? data.length : 0
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Could not retrieve payments"
    });
  }
});

// ==========================================
// GET ALL SUPPORT MESSAGES
// ==========================================
router.get("/support", authenticateAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("support_messages")
      .select(
        "id, customer_id, name, email, subject, message, status, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Could not retrieve support messages"
      });
    }

    return res.json({
      success: true,
      message: "Support messages retrieved successfully",
      messages: data || [],
      total: data ? data.length : 0
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Could not retrieve support messages"
    });
  }
});

// ==========================================
// UPDATE SUPPORT MESSAGE STATUS
// ==========================================
router.patch(
  "/support/:id/status",
  authenticateAdmin,
  async (req, res) => {
    try {
      const { status } = req.body;

      if (!["new", "read", "replied", "resolved"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid support status"
        });
      }

      const { data, error } = await supabase
        .from("support_messages")
        .update({ status })
        .eq("id", req.params.id)
        .select(
          "id, customer_id, name, email, subject, message, status, created_at"
        )
        .maybeSingle();

      if (error) {
        console.error(error);

        return res.status(500).json({
          success: false,
          message: "Could not update support message"
        });
      }

      if (!data) {
        return res.status(404).json({
          success: false,
          message: "Support message not found"
        });
      }

      return res.json({
        success: true,
        message: "Support message updated successfully",
        support_message: data
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Could not update support message"
      });
    }
  }
);

export default router;
