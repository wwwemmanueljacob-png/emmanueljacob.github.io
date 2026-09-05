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
// ADMIN AUTHENTICATION
// ==========================================
function authenticateAdmin(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (
      !authorization ||
      !authorization.startsWith("Bearer ")
    ) {
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
    const tables = [
      "customers",
      "loan_applications",
      "payments",
      "support_messages"
    ];

    const counts = {};

    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select("id", {
          count: "exact",
          head: true
        });

      if (error) {
        console.error(error);

        return res.status(500).json({
          success: false,
          message: `Could not retrieve ${table} statistics`
        });
      }

      counts[table] = count || 0;
    }

    const { count: pendingLoans, error: pendingError } =
      await supabase
        .from("loan_applications")
        .select("id", {
          count: "exact",
          head: true
        })
        .eq("status", "pending");

    if (pendingError) {
      console.error(pendingError);

      return res.status(500).json({
        success: false,
        message: "Could not retrieve pending loan statistics"
      });
    }

    const { count: approvedLoans, error: approvedError } =
      await supabase
        .from("loan_applications")
        .select("id", {
          count: "exact",
          head: true
        })
        .eq("status", "approved");

    if (approvedError) {
      console.error(approvedError);

      return res.status(500).json({
        success: false,
        message: "Could not retrieve approved loan statistics"
      });
    }

    const { count: rejectedLoans, error: rejectedError } =
      await supabase
        .from("loan_applications")
        .select("id", {
          count: "exact",
          head: true
        })
        .eq("status", "rejected");

    if (rejectedError) {
      console.error(rejectedError);

      return res.status(500).json({
        success: false,
        message: "Could not retrieve rejected loan statistics"
      });
    }

    const { count: newSupportMessages, error: newSupportError } =
      await supabase
        .from("support_messages")
        .select("id", {
          count: "exact",
          head: true
        })
        .eq("status", "new");

    if (newSupportError) {
      console.error(newSupportError);

      return res.status(500).json({
        success: false,
        message: "Could not retrieve new support statistics"
      });
    }

    res.json({
      success: true,
      message: "Admin dashboard retrieved successfully",
      dashboard: {
        customers: counts.customers,
        loan_applications: counts.loan_applications,
        pending_loans: pendingLoans || 0,
        approved_loans: approvedLoans || 0,
        rejected_loans: rejectedLoans || 0,
        payments: counts.payments,
        support_messages: counts.support_messages,
        new_support_messages: newSupportMessages || 0
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

// ==========================================
// GET ALL CUSTOMERS
// ==========================================
router.get("/customers", authenticateAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("customers")
      .select("id, full_name, email, phone, created_at")
      .order("created_at", {
        ascending: false
      });

    if (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Could not retrieve customers"
      });
    }

    res.json({
      success: true,
      message: "Customers retrieved successfully",
      customers: data || [],
      total: data ? data.length : 0
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not retrieve customers"
    });
  }
});

// ==========================================
// GET ONE CUSTOMER
// ==========================================
router.get("/customers/:id", authenticateAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("customers")
      .select("id, full_name, email, phone, created_at")
      .eq("id", req.params.id)
      .maybeSingle();

    if (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Could not retrieve customer"
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    res.json({
      success: true,
      message: "Customer retrieved successfully",
      customer: data
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not retrieve customer"
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
      .order("created_at", {
        ascending: false
      });

    if (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Could not retrieve loan applications"
      });
    }

    res.json({
      success: true,
      message: "Loan applications retrieved successfully",
      loans: data || [],
      total: data ? data.length : 0
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not retrieve loan applications"
    });
  }
});

// ==========================================
// GET ONE LOAN
// ==========================================
router.get("/loans/:id", authenticateAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("loan_applications")
      .select(
        "id, customer_id, loan_type, amount, duration_months, purpose, status, created_at"
      )
      .eq("id", req.params.id)
      .maybeSingle();

    if (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Could not retrieve loan application"
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Loan application not found"
      });
    }

    res.json({
      success: true,
      message: "Loan application retrieved successfully",
      loan: data
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not retrieve loan application"
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

      const allowedStatuses = [
        "pending",
        "approved",
        "rejected"
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid status. Use pending, approved, or rejected"
        });
      }

      const { data, error } = await supabase
        .from("loan_applications")
        .update({
          status
        })
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

      res.json({
        success: true,
        message: `Loan application ${status} successfully`,
        loan: data
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        success: false,
        message: "Could not update loan status"
      });
    }
  }
);

// ==========================================
// APPROVE LOAN
// ==========================================
router.patch(
  "/loans/:id/approve",
  authenticateAdmin,
  async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("loan_applications")
        .update({
          status: "approved"
        })
        .eq("id", req.params.id)
        .select(
          "id, customer_id, loan_type, amount, duration_months, purpose, status, created_at"
        )
        .maybeSingle();

      if (error) {
        console.error(error);

        return res.status(500).json({
          success: false,
          message: "Could not approve loan"
        });
      }

      if (!data) {
        return res.status(404).json({
          success: false,
          message: "Loan application not found"
        });
      }

      res.json({
        success: true,
        message: "Loan approved successfully",
        loan: data
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        success: false,
        message: "Could not approve loan"
      });
    }
  }
);

// ==========================================
// REJECT LOAN
// ==========================================
router.patch(
  "/loans/:id/reject",
  authenticateAdmin,
  async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("loan_applications")
        .update({
          status: "rejected"
        })
        .eq("id", req.params.id)
        .select(
          "id, customer_id, loan_type, amount, duration_months, purpose, status, created_at"
        )
        .maybeSingle();

      if (error) {
        console.error(error);

        return res.status(500).json({
          success: false,
          message: "Could not reject loan"
        });
      }

      if (!data) {
        return res.status(404).json({
          success: false,
          message: "Loan application not found"
        });
      }

      res.json({
        success: true,
        message: "Loan rejected successfully",
        loan: data
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        success: false,
        message: "Could not reject loan"
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
      .order("created_at", {
        ascending: false
      });

    if (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Could not retrieve payments"
      });
    }

    res.json({
      success: true,
      message: "Payments retrieved successfully",
      payments: data || [],
      total: data ? data.length : 0
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not retrieve payments"
    });
  }
});

// ==========================================
// UPDATE PAYMENT STATUS
// ==========================================
router.patch(
  "/payments/:id/status",
  authenticateAdmin,
  async (req, res) => {
    try {
      const { payment_status } = req.body;

      const allowedStatuses = [
        "pending",
        "approved",
        "completed",
        "rejected",
        "failed"
      ];

      if (!allowedStatuses.includes(payment_status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid payment status"
        });
      }

      const { data, error } = await supabase
        .from("payments")
        .update({
          payment_status
        })
        .eq("id", req.params.id)
        .select(
          "id, customer_id, loan_application_id, amount, payment_method, payment_status, created_at"
        )
        .maybeSingle();

      if (error) {
        console.error(error);

        return res.status(500).json({
          success: false,
          message: "Could not update payment status"
        });
      }

      if (!data) {
        return res.status(404).json({
          success: false,
          message: "Payment not found"
        });
      }

      res.json({
        success: true,
        message: "Payment status updated successfully",
        payment: data
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        success: false,
        message: "Could not update payment status"
      });
    }
  }
);

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
      .order("created_at", {
        ascending: false
      });

    if (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Could not retrieve support messages"
      });
    }

    res.json({
      success: true,
      message: "Support messages retrieved successfully",
      messages: data || [],
      total: data ? data.length : 0
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
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

      const allowedStatuses = [
        "new",
        "read",
        "replied",
        "resolved"
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid support status"
        });
      }

      const { data, error } = await supabase
        .from("support_messages")
        .update({
          status
        })
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

      res.json({
        success: true,
        message: "Support message status updated successfully",
        support_message: data
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        success: false,
        message: "Could not update support m
