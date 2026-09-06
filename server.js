import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 8080;

/* =====================================================
   CONFIGURATION
===================================================== */

const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL || "admin@jaycobfinancial.com";

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "admin123456";

/* =====================================================
   MIDDLEWARE
===================================================== */

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =====================================================
   IN-MEMORY DATABASE
   Temporary until a real database is connected.
===================================================== */

const customers = [];
const applications = [];
const payments = [];
const supportMessages = [];
const followups = [];
const auditLogs = [];

const customerSessions = new Map();
const adminSessions = new Map();

/* =====================================================
   HELPERS
===================================================== */

function generateId(prefix = "ID") {
  return `${prefix}_${crypto.randomUUID()}`;
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

function now() {
  return new Date().toISOString();
}

function addAuditLog(adminEmail, action, application = null) {
  const log = {
    id: generateId("LOG"),
    date: now(),
    created_at: now(),
    user: adminEmail,
    admin_email: adminEmail,
    action,
    application_id: application?.id || null,
    old_status: application?.old_status || null,
    new_status: application?.new_status || null
  };

  auditLogs.unshift(log);

  return log;
}

/* =====================================================
   AUTHENTICATION MIDDLEWARE
===================================================== */

function authenticateCustomer(req, res, next) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Customer authentication token is required."
    });
  }

  const token = header.substring(7);
  const customer = customerSessions.get(token);

  if (!customer) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired customer session."
    });
  }

  req.customer = customer;

  next();
}

function authenticateAdmin(req, res, next) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Administrator authentication token is required."
    });
  }

  const token = header.substring(7);
  const admin = adminSessions.get(token);

  if (!admin) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired administrator session."
    });
  }

  req.admin = admin;

  next();
}

/* =====================================================
   ROOT
===================================================== */

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "JAY C O B FINANCIAL SERVICES Backend is running",
    version: "3.0.0"
  });
});

/* =====================================================
   HEALTH CHECK
===================================================== */

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "OK",
    message: "Server is healthy"
  });
});

/* =====================================================
   CUSTOMER REGISTRATION
===================================================== */

app.post("/api/auth/register", (req, res) => {
  const {
    name,
    full_name,
    email,
    phone,
    password
  } = req.body;

  const customerName = name || full_name;

  if (!customerName || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "Name, email and password are required."
    });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const existingCustomer = customers.find(
    customer => customer.email === normalizedEmail
  );

  if (existingCustomer) {
    return res.status(409).json({
      success: false,
      message: "A customer with this email already exists."
    });
  }

  const customer = {
    id: generateId("CUS"),
    name: customerName,
    full_name: customerName,
    email: normalizedEmail,
    phone: phone || "",
    password,
    created_at: now(),
    updated_at: now()
  };

  customers.push(customer);

  const token = generateToken();

  customerSessions.set(token, {
    id: customer.id,
    email: customer.email,
    name: customer.name
  });

  res.status(201).json({
    success: true,
    message: "Customer registered successfully.",
    token,
    customer: {
      id: customer.id,
      name: customer.name,
      full_name: customer.full_name,
      email: customer.email,
      phone: customer.phone
    }
  });
});

/* =====================================================
   CUSTOMER LOGIN
===================================================== */

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required."
    });
  }

  const customer = customers.find(
    item =>
      item.email === String(email).trim().toLowerCase() &&
      item.password === password
  );

  if (!customer) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password."
    });
  }

  const token = generateToken();

  customerSessions.set(token, {
    id: customer.id,
    email: customer.email,
    name: customer.name
  });

  res.json({
    success: true,
    message: "Login successful.",
    token,
    customer: {
      id: customer.id,
      name: customer.name,
      full_name: customer.full_name,
      email: customer.email,
      phone: customer.phone
    }
  });
});

/* =====================================================
   CUSTOMER PROFILE
===================================================== */

app.get(
  "/api/auth/profile",
  authenticateCustomer,
  (req, res) => {
    const customer = customers.find(
      item => item.id === req.customer.id
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found."
      });
    }

    res.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        full_name: customer.full_name,
        email: customer.email,
        phone: customer.phone,
        created_at: customer.created_at
      }
    });
  }
);

/* =====================================================
   CUSTOMER LOGOUT
===================================================== */

app.post(
  "/api/auth/logout",
  authenticateCustomer,
  (req, res) => {
    const token = req.headers.authorization.substring(7);

    customerSessions.delete(token);

    res.json({
      success: true,
      message: "Customer logged out successfully."
    });
  }
);

/* =====================================================
   LOAN APPLICATION
===================================================== */

app.post(
  "/api/loans/apply",
  authenticateCustomer,
  (req, res) => {
    const {
      loan_type,
      loanType,
      amount,
      duration,
      purpose
    } = req.body;

    if (!amount || !duration) {
      return res.status(400).json({
        success: false,
        message: "Loan amount and duration are required."
      });
    }

    const customer = customers.find(
      item => item.id === req.customer.id
    );

    const application = {
      id: generateId("LOAN"),
      customer_id: customer?.id || req.customer.id,
      customer_name: customer?.name || req.customer.name,
      customer_email: customer?.email || req.customer.email,
      email: customer?.email || req.customer.email,

      loan_type: loan_type || loanType || "Personal Loan",
      amount: Number(amount),
      duration: Number(duration),
      purpose: purpose || "",

      status: "PENDING",

      created_at: now(),
      updated_at: now(),

      reviewed_at: null,
      reviewed_by: null
    };

    applications.unshift(application);

    res.status(201).json({
      success: true,
      message: "Loan application submitted successfully.",
      application
    });
  }
);

/* =====================================================
   CUSTOMER LOAN APPLICATIONS
===================================================== */

app.get(
  "/api/loans/my-applications",
  authenticateCustomer,
  (req, res) => {
    const customerApplications = applications.filter(
      application =>
        application.customer_id === req.customer.id ||
        application.customer_email === req.customer.email
    );

    res.json({
      success: true,
      applications: customerApplications
    });
  }
);

/* =====================================================
   CUSTOMER SINGLE LOAN
===================================================== */

app.get(
  "/api/loans/:id",
  authenticateCustomer,
  (req, res) => {
    const application = applications.find(
      item =>
        item.id === req.params.id &&
        (
          item.customer_id === req.customer.id ||
          item.customer_email === req.customer.email
        )
    );

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Loan application not found."
      });
    }

    res.json({
      success: true,
      application
    });
  }
);

/* =====================================================
   CUSTOMER PAYMENTS
===================================================== */

app.get(
  "/api/payments/my-payments",
  authenticateCustomer,
  (req, res) => {
    const customerPayments = payments.filter(
      payment =>
        payment.customer_id === req.customer.id ||
        payment.customer_email === req.customer.email
    );

    res.json({
      success: true,
      payments: customerPayments
    });
  }
);

/* =====================================================
   CUSTOMER SUPPORT MESSAGE
===================================================== */

app.post(
  "/api/support/send",
  authenticateCustomer,
  (req, res) => {
    const {
      message,
      subject
    } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Support message is required."
      });
    }

    const supportMessage = {
      id: generateId("MSG"),
      customer_id: req.customer.id,
      customer_name: req.customer.name,
      customer_email: req.customer.email,
      subject: subject || "Customer Support",
      message,
      status: "UNREAD",
      created_at: now()
    };

    supportMessages.unshift(supportMessage);

    res.status(201).json({
      success: true,
      message: "Support message sent successfully.",
      support_message: supportMessage
    });
  }
);

/* =====================================================
   CUSTOMER SUPPORT MESSAGES
===================================================== */

app.get(
  "/api/support/my-messages",
  authenticateCustomer,
  (req, res) => {
    const messages = supportMessages.filter(
      message =>
        message.customer_id === req.customer.id
    );

    res.json({
      success: true,
      messages
    });
  }
);

/* =====================================================
   ADMIN LOGIN
===================================================== */

app.post("/api/admin/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Administrator email and password are required."
    });
  }

  const normalizedEmail = String(email)
    .trim()
    .toLowerCase();

  if (
    normalizedEmail !== ADMIN_EMAIL.toLowerCase() ||
    password !== ADMIN_PASSWORD
  ) {
    return res.status(401).json({
      success: false,
      message: "Invalid administrator credentials."
    });
  }

  const token = generateToken();

  const admin = {
    email: ADMIN_EMAIL,
    role: "ADMIN"
  };

  adminSessions.set(token, admin);

  res.json({
    success: true,
    message: "Administrator login successful.",
    token,
    admin
  });
});

/* =====================================================
   ADMIN LOGOUT
===================================================== */

app.post(
  "/api/admin/logout",
  authenticateAdmin,
  (req, res) => {
    const token = req.headers.authorization.substring(7);

    adminSessions.delete(token);

    res.json({
      success: true,
      message: "Administrator logged out successfully."
    });
  }
);

/* =====================================================
   ADMIN CUSTOMERS
===================================================== */

app.get(
  "/api/admin/customers",
  authenticateAdmin,
  (req, res) => {
    const safeCustomers = customers.map(customer => ({
      id: customer.id,
      name: customer.name,
      full_name: customer.full_name,
      email: customer.email,
      phone: customer.phone,
      created_at: customer.created_at
    }));

    res.json({
      success: true,
      customers: safeCustomers
    });
  }
);

/* =====================================================
   ADMIN APPLICATIONS
===================================================== */

app.get(
  "/api/admin/applications",
  authenticateAdmin,
  (req, res) => {
    res.json({
      success: true,
      applications
    });
  }
);

/* =====================================================
   ADMIN SINGLE APPLICATION
===================================================== */

app.get(
  "/api/admin/applications/:id",
  authenticateAdmin,
  (req, res) => {
    const application = applications.find(
      item => item.id === req.params.id
    );

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Loan application not found."
      });
    }

    res.json({
      success: true,
      application
    });
  }
);

/* =====================================================
   ADMIN CHANGE LOAN STATUS
===================================================== */

app.put(
  "/api/admin/applications/:id/status",
  authenticateAdmin,
  (req, res) => {
    const { status } = req.body;

    const allowedStatuses = [
      "PENDING",
      "UNDER REVIEW",
      "APPROVED",
      "REJECTED"
    ];

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Loan status is required."
      });
    }

    const normalizedStatus = String(status)
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");

    if (!allowedStatuses.includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid loan status."
      });
    }

    const application = applications.find(
      item => item.id === req.params.id
    );

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Loan application not found."
      });
    }

    const oldStatus = application.status;

    application.status = normalizedStatus;
    application.updated_at = now();
    application.reviewed_at = now();
    application.reviewed_by = req.admin.email;

    addAuditLog(
      req.admin.email,
      `Loan application ${application.id} changed from ${oldStatus} to ${normalizedStatus}`,
      {
        id: application.id,
        old_status: oldStatus,
        new_status: normalizedStatus
      }
    );

    res.json({
      success: true,
      message: "Loan application status updated successfully.",
      application
    });
  }
);

/* =====================================================
   ADMIN STATISTICS
===================================================== */

app.get(
  "/api/admin/statistics",
  authenticateAdmin,
  (req, res) => {
    const pending = applications.filter(
      item => item.status === "PENDING"
    ).length;

    const underReview = applications.filter(
      item => item.status === "UNDER REVIEW"
    ).length;

    const approved = applications.filter(
      item => item.status === "APPROVED"
    ).length;

    const rejected = applications.filter(
      item => item.status === "REJECTED"
    ).length;

    const approvedAmount = applications
      .filter(item => item.status === "APPROVED")
      .reduce(
        (total, item) => total + Number(item.amount || 0),
        0
      );

    res.json({
      success: true,

      statistics: {
        total_customers: customers.length,
        total_applications: applications.length,
        pending,
        under_review: underReview,
        approved,
        rejected,
        total_approved_amount: approvedAmount,
        total_payments: payments.length
      },

      pending,
      under_review: underReview,
      approved,
      rejected,
      total_customers: customers.length,
      total_applications: applications.length
    });
  }
);

/* =====================================================
   ADMIN FOLLOW-UPS
===================================================== */

app.post(
  "/api/admin/followups",
  authenticateAdmin,
  (req, res) => {
    const {
      customer_id,
      customer_name,
      customer_email,
      message,
      notes
    } = req.body;

    const followup = {
      id: generateId("FOLLOW"),
      customer_id: customer_id || null,
      customer_name: customer_name || "",
      customer_email: customer_email || "",
      message: message || notes || "",
      notes: notes || message || "",
      created_by: req.admin.email,
      created_at: now()
    };

    followups.unshift(followup);

    addAuditLog(
      req.admin.email,
      `Customer follow-up created for ${customer_email || customer_name || customer_id || "customer"}`
    );

    res.status(201).json({
      success: true,
      message: "Follow-up created successfully.",
      followup
    });
  }
);

app.get(
  "/api/admin/followups",
  authenticateAdmin,
  (req, res) => {
    res.json({
      success: true,
      followups
    });
  }
);

/* =====================================================
   ADMIN AUDIT LOGS
===================================================== */

app.get(
  "/api/admin/audit-logs",
  authenticateAdmin,
  (req, res) => {
    res.json({
      success: true,
      audit_logs: auditLogs,
      logs: auditLogs
    });
  }
);

/* =====================================================
   ADMIN SUPPORT MESSAGES
===================================================== */

app.get(
  "/api/admin/support-messages",
  authenticateAdmin,
  (req, res) => {
    res.json({
      success: true,
      messages: supportMessages,
      support_messages: supportMessages
    });
  }
);

/* =====================================================
   ADMIN PAYMENTS
===================================================== */

app.get(
  "/api/admin/payments",
  authenticateAdmin,
  (req, res) => {
    res.json({
      success: true,
      payments
    });
  }
);

/* =====================================================
   ADMIN ACTIVE / APPROVED LOANS
===================================================== */

app.get(
  "/api/admin/active-loans",
  authenticateAdmin,
  (req, res) => {
    const activeLoans = applications.filter(
      item => item.status === "APPROVED"
    );

    res.json({
      success: true,
      loans: activeLoans,
      applications: activeLoans
    });
  }
);

/* =====================================================
   ADMIN PROFILE
===================================================== */

app.get(
  "/api/admin/profile",
  authenticateAdmin,
  (req, res) => {
    res.json({
      success: true,
      admin: req.admin
    });
  }
);

/* =====================================================
   API INFORMATION
===================================================== */

app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "JAY C O B Financial Services API",
    version: "3.0.0",

    routes: {
      health: "/api/health",

      customer_login: "/api/auth/login",
      customer_register: "/api/auth/register",

      admin_login: "/api/admin/login",
      admin_customers: "/api/admin/customers",
      admin_applications: "/api/admin/applications",
      admin_statistics: "/api/admin/statistics",
      admin_followups: "/api/admin/followups",
      admin_audit_logs: "/api/admin/audit-logs",
      admin_support: "/api/admin/support-messages"
    }
  });
});

/* =====================================================
   404 HANDLER
===================================================== */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    method: req.method,
    path: req.originalUrl
  });
});

/* =====================================================
   ERROR HANDLER
===================================================== */

app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);

  res.status(500).json({
    success: false,
    message: "Internal server error",
    error:
      process.env.NODE_ENV === "production"
        ? undefined
        : err.message
  });
});

/* =====================================================
   START SERVER
===================================================== */

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `JAY C O B Financial Services backend running on port ${PORT}`
  );

  console.log(`Admin email: ${ADMIN_EMAIL}`);
});
