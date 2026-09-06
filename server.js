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
    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS"
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization"
    ]
  })
);

app.use(express.json({ limit: "10mb" }));

app.use(
  express.urlencoded({
    extended: true
  })
);


/* =====================================================
   TEMPORARY IN-MEMORY DATABASE
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

  return crypto
    .randomBytes(32)
    .toString("hex");

}


function now() {

  return new Date().toISOString();

}


function normalizeEmail(email) {

  return String(email || "")
    .trim()
    .toLowerCase();

}


function normalizeStatus(status) {

  return String(status || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");

}


function addAuditLog(
  adminEmail,
  action,
  application = null
) {

  const log = {

    id:
      generateId("LOG"),

    date:
      now(),

    created_at:
      now(),

    user:
      adminEmail,

    admin_email:
      adminEmail,

    action,

    application_id:
      application?.id || null,

    old_status:
      application?.old_status || null,

    new_status:
      application?.new_status || null

  };

  auditLogs.unshift(log);

  return log;

}


/* =====================================================
   CUSTOMER AUTHENTICATION
===================================================== */

function authenticateCustomer(
  req,
  res,
  next
) {

  const header =
    req.headers.authorization || "";


  if (!header.startsWith("Bearer ")) {

    return res.status(401).json({

      success:
        false,

      message:
        "Customer authentication token is required."

    });

  }


  const token =
    header.substring(7);


  const customer =
    customerSessions.get(token);


  if (!customer) {

    return res.status(401).json({

      success:
        false,

      message:
        "Invalid or expired customer session."

    });

  }


  req.customer =
    customer;


  req.customerToken =
    token;


  next();

}


/* =====================================================
   ADMIN AUTHENTICATION
===================================================== */

function authenticateAdmin(
  req,
  res,
  next
) {

  const header =
    req.headers.authorization || "";


  if (!header.startsWith("Bearer ")) {

    return res.status(401).json({

      success:
        false,

      message:
        "Administrator authentication token is required."

    });

  }


  const token =
    header.substring(7);


  const admin =
    adminSessions.get(token);


  if (!admin) {

    return res.status(401).json({

      success:
        false,

      message:
        "Invalid or expired administrator session."

    });

  }


  req.admin =
    admin;


  req.adminToken =
    token;


  next();

}


/* =====================================================
   ROOT
===================================================== */

app.get("/", (req, res) => {

  res.json({

    success:
      true,

    message:
      "JAY C O B FINANCIAL SERVICES Backend is running",

    version:
      "4.0.0"

  });

});


/* =====================================================
   HEALTH CHECK
===================================================== */

app.get("/api/health", (req, res) => {

  res.json({

    success:
      true,

    status:
      "OK",

    message:
      "Server is healthy",

    version:
      "4.0.0",

    timestamp:
      now()

  });

});


/* =====================================================
   CUSTOMER REGISTRATION
===================================================== */

app.post(
  "/api/auth/register",
  (req, res) => {

    const {

      name,

      full_name,

      email,

      phone,

      password

    } = req.body;


    const customerName =
      name || full_name;


    if (
      !customerName ||
      !email ||
      !password
    ) {

      return res.status(400).json({

        success:
          false,

        message:
          "Name, email and password are required."

      });

    }


    const normalizedEmail =
      normalizeEmail(email);


    const existingCustomer =
      customers.find(
        customer =>
          customer.email ===
          normalizedEmail
      );


    if (existingCustomer) {

      return res.status(409).json({

        success:
          false,

        message:
          "A customer with this email already exists."

      });

    }


    const customer = {

      id:
        generateId("CUS"),

      name:
        String(customerName).trim(),

      full_name:
        String(customerName).trim(),

      email:
        normalizedEmail,

      phone:
        phone || "",

      password,

      status:
        "ACTIVE",

      created_at:
        now(),

      updated_at:
        now()

    };


    customers.push(customer);


    const token =
      generateToken();


    customerSessions.set(
      token,
      {

        id:
          customer.id,

        email:
          customer.email,

        name:
          customer.name

      }
    );


    return res.status(201).json({

      success:
        true,

      message:
        "Customer registered successfully.",

      token,

      customer: {

        id:
          customer.id,

        name:
          customer.name,

        full_name:
          customer.full_name,

        email:
          customer.email,

        phone:
          customer.phone,

        status:
          customer.status,

        created_at:
          customer.created_at

      }

    });

  }
);


/* =====================================================
   CUSTOMER LOGIN
===================================================== */

app.post(
  "/api/auth/login",
  (req, res) => {

    const {
      email,
      password
    } = req.body;


    if (
      !email ||
      !password
    ) {

      return res.status(400).json({

        success:
          false,

        message:
          "Email and password are required."

      });

    }


    const normalizedEmail =
      normalizeEmail(email);


    const customer =
      customers.find(
        item =>
          item.email ===
            normalizedEmail &&
          item.password ===
            password
      );


    if (!customer) {

      return res.status(401).json({

        success:
          false,

        message:
          "Invalid email or password."

      });

    }


    const token =
      generateToken();


    customerSessions.set(
      token,
      {

        id:
          customer.id,

        email:
          customer.email,

        name:
          customer.name

      }
    );


    return res.json({

      success:
        true,

      message:
        "Login successful.",

      token,

      customer: {

        id:
          customer.id,

        name:
          customer.name,

        full_name:
          customer.full_name,

        email:
          customer.email,

        phone:
          customer.phone,

        status:
          customer.status,

        created_at:
          customer.created_at

      }

    });

  }
);


/* =====================================================
   CUSTOMER PROFILE
===================================================== */

app.get(
  "/api/auth/profile",
  authenticateCustomer,
  (req, res) => {

    const customer =
      customers.find(
        item =>
          item.id ===
          req.customer.id
      );


    if (!customer) {

      return res.status(404).json({

        success:
          false,

        message:
          "Customer not found."

      });

    }


    return res.json({

      success:
        true,

      customer: {

        id:
          customer.id,

        name:
          customer.name,

        full_name:
          customer.full_name,

        email:
          customer.email,

        phone:
          customer.phone,

        status:
          customer.status,

        created_at:
          customer.created_at,

        updated_at:
          customer.updated_at

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

    customerSessions.delete(
      req.customerToken
    );


    return res.json({

      success:
        true,

      message:
        "Customer logged out successfully."

    });

  }
);


/* =====================================================
   LOAN APPLICATION
   FIXED FOR duration_months
===================================================== */

app.post(
  "/api/loans/apply",
  authenticateCustomer,
  (req, res) => {

    console.log(
      "================================================="
    );

    console.log(
      "NEW LOAN APPLICATION REQUEST"
    );

    console.log(
      "Customer:",
      req.customer
    );

    console.log(
      "Request body:",
      req.body
    );


    /* ===============================================
       ACCEPT ALL COMPATIBLE FIELD NAMES
    =============================================== */

    const selectedLoanType =

      req.body.loan_type ||

      req.body.loanType ||

      req.body.type ||

      "Personal Loan";


    const rawAmount =

      req.body.amount ??

      req.body.loan_amount ??

      req.body.loanAmount;


    const rawDuration =

      req.body.duration_months ??

      req.body.duration ??

      req.body.loan_duration ??

      req.body.loanDuration;


    const loanAmount =
      Number(rawAmount);


    const loanDuration =
      Number(rawDuration);


    const purpose =
      req.body.purpose || "";


    /* ===============================================
       VALIDATE LOAN TYPE
    =============================================== */

    if (!selectedLoanType) {

      return res.status(400).json({

        success:
          false,

        message:
          "Loan type is required."

      });

    }


    /* ===============================================
       VALIDATE AMOUNT
    =============================================== */

    if (
      !Number.isFinite(loanAmount) ||
      loanAmount <= 0
    ) {

      return res.status(400).json({

        success:
          false,

        message:
          "Please enter a valid loan amount."

      });

    }


    /* ===============================================
       VALIDATE DURATION
    =============================================== */

    if (
      !Number.isFinite(loanDuration) ||
      loanDuration <= 0
    ) {

      return res.status(400).json({

        success:
          false,

        message:
          "Please select a valid loan duration."

      });

    }


    /* ===============================================
       FIND CUSTOMER
    =============================================== */

    const customer =
      customers.find(
        item =>
          item.id ===
          req.customer.id
      );


    if (!customer) {

      return res.status(404).json({

        success:
          false,

        message:
          "Customer account not found."

      });

    }


    /* ===============================================
       CREATE LOAN APPLICATION
    =============================================== */

    const application = {

      id:
        generateId("LOAN"),


      /* CUSTOMER */

      customer_id:
        customer.id,

      customerId:
        customer.id,

      customer_name:
        customer.name,

      customerName:
        customer.name,

      customer_email:
        customer.email,

      email:
        customer.email,


      /* LOAN */

      loan_type:
        selectedLoanType,

      loanType:
        selectedLoanType,

      amount:
        loanAmount,


      /* BOTH FIELD NAMES */

      duration:
        loanDuration,

      duration_months:
        loanDuration,


      purpose:
        purpose,


      /* STATUS */

      status:
        "PENDING",

      interest_rate:
        10,


      /* DATES */

      created_at:
        now(),

      updated_at:
        now(),

      reviewed_at:
        null,

      reviewed_by:
        null

    };


    /* ===============================================
       SAVE APPLICATION
    =============================================== */

    applications.unshift(
      application
    );


    console.log(
      "LOAN APPLICATION SAVED:",
      application
    );


    console.log(
      "================================================="
    );


    /* ===============================================
       RESPONSE
    =============================================== */

    return res.status(201).json({

      success:
        true,

      message:
        "Loan application submitted successfully.",

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

    const customerApplications =
      applications.filter(
        application =>

          application.customer_id ===
            req.customer.id ||

          application.customerId ===
            req.customer.id ||

          application.customer_email ===
            req.customer.email ||

          application.email ===
            req.customer.email
      );


    customerApplications.sort(
      (a, b) =>
        new Date(b.created_at) -
        new Date(a.created_at)
    );


    return res.json({

      success:
        true,

      applications:
        customerApplications

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

    const application =
      applications.find(
        item =>

          item.id ===
            req.params.id &&

          (

            item.customer_id ===
              req.customer.id ||

            item.customerId ===
              req.customer.id ||

            item.customer_email ===
              req.customer.email ||

            item.email ===
              req.customer.email

          )
      );


    if (!application) {

      return res.status(404).json({

        success:
          false,

        message:
          "Loan application not found."

      });

    }


    return res.json({

      success:
        true,

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

    const customerPayments =
      payments.filter(
        payment =>

          payment.customer_id ===
            req.customer.id ||

          payment.customer_email ===
            req.customer.email
      );


    return res.json({

      success:
        true,

      payments:
        customerPayments

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


    if (
      !message ||
      !String(message).trim()
    ) {

      return res.status(400).json({

        success:
          false,

        message:
          "Support message is required."

      });

    }


    const supportMessage = {

      id:
        generateId("MSG"),

      customer_id:
        req.customer.id,

      customer_name:
        req.customer.name,

      customer_email:
        req.customer.email,

      subject:
        subject ||
        "Customer Support",

      message:
        String(message).trim(),

      status:
        "UNREAD",

      created_at:
        now()

    };


    supportMessages.unshift(
      supportMessage
    );


    return res.status(201).json({

      success:
        true,

      message:
        "Support message sent successfully.",

      support_message:
        supportMessage

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

    const messages =
      supportMessages.filter(
        message =>
          message.customer_id ===
          req.customer.id
      );


    return res.json({

      success:
        true,

      messages

    });

  }
);


/* =====================================================
   ADMIN LOGIN
===================================================== */

app.post(
  "/api/admin/login",
  (req, res) => {

    const {
      email,
      password
    } = req.body;


    if (
      !email ||
      !password
    ) {

      return res.status(400).json({

        success:
          false,

        message:
          "Administrator email and password are required."

      });

    }


    const normalizedEmail =
      normalizeEmail(email);


    if (

      normalizedEmail !==
        normalizeEmail(ADMIN_EMAIL) ||

      password !==
        ADMIN_PASSWORD

    ) {

      return res.status(401).json({

        success:
          false,

        message:
          "Invalid administrator credentials."

      });

    }


    const token =
      generateToken();


    const admin = {

      email:
        ADMIN_EMAIL,

      role:
        "ADMIN"

    };


    adminSessions.set(
      token,
      admin
    );


    return res.json({

      success:
        true,

      message:
        "Administrator login successful.",

      token,

      admin

    });

  }
);


/* =====================================================
   ADMIN LOGOUT
===================================================== */

app.post(
  "/api/admin/logout",
  authenticateAdmin,
  (req, res) => {

    adminSessions.delete(
      req.adminToken
    );


    return res.json({

      success:
        true,

      message:
        "Administrator logged out successfully."

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

    const safeCustomers =
      customers.map(
        customer => ({

          id:
            customer.id,

          name:
            customer.name,

          full_name:
            customer.full_name,

          email:
            customer.email,

          phone:
            customer.phone,

          status:
            customer.status,

          created_at:
            customer.created_at,

          updated_at:
            customer.updated_at

        })
      );


    return res.json({

      success:
        true,

      customers:
        safeCustomers

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

    return res.json({

      success:
        true,

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

    const application =
      applications.find(
        item =>
          item.id ===
          req.params.id
      );


    if (!application) {

      return res.status(404).json({

        success:
          false,

        message:
          "Loan application not found."

      });

    }


    return res.json({

      success:
        true,

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

    const {
      status
    } = req.body;


    const allowedStatuses = [

      "PENDING",

      "UNDER REVIEW",

      "APPROVED",

      "REJECTED"

    ];


    if (!status) {

      return res.status(400).json({

        success:
          false,

        message:
          "Loan status is required."

      });

    }


    const normalizedStatus =
      normalizeStatus(status);


    if (
      !allowedStatuses.includes(
        normalizedStatus
      )
    ) {

      return res.status(400).json({

        success:
          false,

        message:
          "Invalid loan status."

      });

    }


    const application =
      applications.find(
        item =>
          item.id ===
          req.params.id
      );


    if (!application) {

      return res.status(404).json({

        success:
          false,

        message:
          "Loan application not found."

      });

    }


    const oldStatus =
      application.status;


    /* ===============================================
       UPDATE STATUS
    =============================================== */

    application.status =
      normalizedStatus;


    application.updated_at =
      now();


    /* ===============================================
       REVIEW INFORMATION
    =============================================== */

    if (
      normalizedStatus ===
        "PENDING"
    ) {

      application.reviewed_at =
        null;

      application.reviewed_by =
        null;

    } else {

      application.reviewed_at =
        now();

      application.reviewed_by =
        req.admin.email;

    }


    /* ===============================================
       AUDIT LOG
    =============================================== */

    addAuditLog(

      req.admin.email,

      `Loan application ${application.id} changed from ${oldStatus} to ${normalizedStatus}`,

      {

        id:
          application.id,

        old_status:
          oldStatus,

        new_status:
          normalizedStatus

      }

    );


    console.log(
      `APPLICATION ${application.id}: ${oldStatus} -> ${normalizedStatus}`
    );


    return res.json({

      success:
        true,

      message:
        "Loan application status updated successfully.",

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

    const pending =
      applications.filter(
        item =>
          item.status ===
          "PENDING"
      ).length;


    const underReview =
      applications.filter(
        item =>
          item.status ===
          "UNDER REVIEW"
      ).length;


    const approved =
      applications.filter(
        item =>
          item.status ===
          "APPROVED"
      ).length;


    const rejected =
      applications.filter(
        item =>
          item.status ===
          "REJECTED"
      ).length;


    const approvedAmount =
      applications
        .filter(
          item =>
            item.status ===
            "APPROVED"
        )
        .reduce(
          (total, item) =>
            total +
            Number(
              item.amount || 0
            ),
          0
        );


    return res.json({

      success:
        true,

      statistics: {

        total_customers:
          customers.length,

        total_applications:
          applications.length,

        pending,

        under_review:
          underReview,

        approved,

        rejected,

        total_approved_amount:
          approvedAmount,

        total_payments:
          payments.length

      },

      pending,

      under_review:
        underReview,

      approved,

      rejected,

      total_customers:
        customers.length,

      total_applications:
        applications.length

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

      id:
        generateId("FOLLOW"),

      customer_id:
        customer_id || null,

      customer_name:
        customer_name || "",

      customer_email:
        customer_email || "",

      message:
        message ||
        notes ||
        "",

      notes:
        notes ||
        message ||
        "",

      created_by:
        req.admin.email,

      created_at:
        now()

    };


    followups.unshift(
      followup
    );


    addAuditLog(

      req.admin.email,

      `Customer follow-up created for ${
        customer_email ||
        customer_name ||
        customer_id ||
        "customer"
      }`

    );


    return res.status(201).json({

      success:
        true,

      message:
        "Follow-up created successfully.",

      followup

    });

  }
);


/* =====================================================
   ADMIN FOLLOW-UPS
===================================================== */

app.get(
  "/api/admin/followups",
  authenticateAdmin,
  (req, res) => {

    return res.json({

      success:
        true,

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

    return res.json({

      success:
        true,

      audit_logs:
        auditLogs,

      logs:
        auditLogs

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

    return res.json({

      success:
        true,

      messages:
        supportMessages,

      support_messages:
        supportMessages

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

    return res.json({

      success:
        true,

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

    const activeLoans =
      applications.filter(
        item =>
          item.status ===
          "APPROVED"
      );


    return res.json({

      success:
        true,

      loans:
        activeLoans,

      applications:
        activeLoans

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

    return res.json({

      success:
        true,

      admin:
        req.admin

    });

  }
);


/* =====================================================
   API INFORMATION
===================================================== */

app.get(
  "/api",
  (req, res) => {

    return res.json({

      success:
        true,

      message:
        "JAY C O B Financial Services API",

      version:
        "4.0.0",

      routes: {

        health:
          "/api/health",

        customer_login:
          "/api/auth/login",

        customer_register:
          "/api/auth/register",

        customer_profile:
          "/api/auth/profile",

        customer_logout:
          "/api/auth/logout",

        loan_apply:
          "/api/loans/apply",

        customer_applications:
          "/api/loans/my-applications",

        customer_loan:
          "/api/loans/:id",

        customer_payments:
          "/api/payments/my-payments",

        customer_support:
          "/api/support/send",

        customer_support_messages:
          "/api/support/my-messages",

        admin_login:
          "/api/admin/login",

        admin_customers:
          "/api/admin/customers",

        admin_applications:
          "/api/admin/applications",

        admin_application:
          "/api/admin/applications/:id",

        admin_change_status:
          "/api/admin/applications/:id/status",

        admin_statistics:
          "/api/admin/statistics",

        admin_followups:
          "/api/admin/followups",

        admin_audit_logs:
          "/api/admin/audit-logs",

        admin_support:
          "/api/admin/support-messages",

        admin_payments:
          "/api/admin/payments",

        admin_active_loans:
          "/api/admin/active-loans",

        admin_profile:
          "/api/admin/profile"

      }

    });

  }
);


/* =====================================================
   404 HANDLER
===================================================== */

app.use(
  (req, res) => {

    res.status(404).json({

      success:
        false,

      message:
        "Route not found",

      method:
        req.method,

      path:
        req.originalUrl

    });

  }
);


/* =====================================================
   ERROR HANDLER
===================================================== */

app.use(
  (err, req, res, next) => {

    console.error(
      "SERVER ERROR:",
      err
    );


    res.status(500).json({

      success:
        false,

      message:
        "Internal server error",

      error:
        process.env.NODE_ENV ===
        "production"

          ? undefined

          : err.message

    });

  }
);


/* =====================================================
   START SERVER
===================================================== */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      "================================================="
    );

    console.log(
      "JAY C O B FINANCIAL SERVICES BACKEND"
    );

    console.log(
      `Running on port ${PORT}`
    );

    console.log(
      `Admin email: ${ADMIN_EMAIL}`
    );

    console.log(
      "API: /api"
    );

    console.log(
      "Health: /api/health"
    );

    console.log(
      "================================================="
    );

  }
);
