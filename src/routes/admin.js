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
// UPDATE LOAN APPLICATION STATUS
// + CREATE LOAN + REPAYMENT SCHEDULES
// ==========================================
router.put(
  "/applications/:id/status",
  authenticateAdmin,
  async (req, res) => {
    try {

      const applicationId = req.params.id;

      const requestedStatus =
        String(req.body?.status || "")
          .trim()
          .toUpperCase();

      const rejectionReason =
        String(req.body?.rejection_reason || "")
          .trim();

      const allowedStatuses = [
        "PENDING",
        "UNDER REVIEW",
        "APPROVED",
        "REJECTED"
      ];

      if (!allowedStatuses.includes(requestedStatus)) {
        return res.status(400).json({
          success: false,
          message: "Invalid loan status"
        });
      }


      // ==========================================
      // GET LOAN APPLICATION
      // ==========================================

      const {
        data: application,
        error: applicationError
      } = await supabase
        .from("loan_applications")
        .select(`
          id,
          customer_id,
          loan_type,
          amount,
          duration_months,
          interest_rate,
          purpose,
          status,
          created_at
        `)
        .eq("id", applicationId)
        .maybeSingle();

      if (applicationError) {
        console.error(
          "Loan application fetch error:",
          applicationError
        );

        return res.status(500).json({
          success: false,
          message: "Could not retrieve loan application",
          error: applicationError.message
        });
      }

      if (!application) {
        return res.status(404).json({
          success: false,
          message: "Loan application not found"
        });
      }


      // ==========================================
      // REJECTION
      // ==========================================

      if (requestedStatus === "REJECTED") {

        if (!rejectionReason) {
          return res.status(400).json({
            success: false,
            message: "Rejection reason is required"
          });
        }

        const {
          data,
          error
        } = await supabase
          .from("loan_applications")
          .update({
            status: "REJECTED",
            rejection_reason: rejectionReason,
            reviewed_at: new Date().toISOString(),
            reviewed_by: req.admin?.admin_id || null
          })
          .eq("id", applicationId)
          .select()
          .maybeSingle();

        if (error) {
          console.error(
            "Loan rejection error:",
            error
          );

          return res.status(500).json({
            success: false,
            message: "Could not reject loan application",
            error: error.message
          });
        }

        return res.json({
          success: true,
          message: "Loan application rejected successfully",
          application: data
        });
      }


      // ==========================================
      // NON-APPROVED STATUS
      // ==========================================

      if (requestedStatus !== "APPROVED") {

        const {
          data,
          error
        } = await supabase
          .from("loan_applications")
          .update({
            status: requestedStatus,
            reviewed_at: new Date().toISOString(),
            reviewed_by: req.admin?.admin_id || null
          })
          .eq("id", applicationId)
          .select()
          .maybeSingle();

        if (error) {
          console.error(
            "Loan status update error:",
            error
          );

          return res.status(500).json({
            success: false,
            message: "Could not update loan status",
            error: error.message
          });
        }

        return res.json({
          success: true,
          message: "Loan status updated successfully",
          application: data
        });
      }


      // ==========================================
      // APPROVAL
      // ==========================================

      const principal =
        Number(application.amount);

      const duration =
        Number(application.duration_months);

      const interestRate =
        Number(application.interest_rate || 0);

      if (
        !Number.isFinite(principal) ||
        principal <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid loan amount"
        });
      }

      if (
        !Number.isFinite(duration) ||
        duration <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid loan duration"
        });
      }


      // ==========================================
      // FLAT MONTHLY INTEREST
      // ==========================================

      const totalInterest =
        principal *
        (interestRate / 100) *
        duration;

      const totalAmount =
        principal +
        totalInterest;

      const monthlyInstallment =
        totalAmount / duration;

      const approvalDate =
        new Date();


      // ==========================================
      // CHECK WHETHER LOAN ALREADY EXISTS
      // ==========================================

      const {
        data: existingLoan,
        error: existingLoanError
      } = await supabase
        .from("loans")
        .select("id")
        .eq("customer_id", application.customer_id)
        .eq("loan_amount", principal)
        .eq("application_date", application.created_at)
        .maybeSingle();

      if (existingLoanError) {
        console.error(
          "Existing loan check error:",
          existingLoanError
        );

        return res.status(500).json({
          success: false,
          message: "Could not verify existing loan",
          error: existingLoanError.message
        });
      }


      let loan = existingLoan;


      // ==========================================
      // CREATE LOAN RECORD
      // ==========================================

      if (!loan) {

        const finalDueDate =
          new Date(approvalDate);

        finalDueDate.setMonth(
          finalDueDate.getMonth() + duration
        );


        const {
          data: newLoan,
          error: loanError
        } = await supabase
          .from("loans")
          .insert({
            customer_id:
              application.customer_id,

            loan_amount:
              principal,

            interest_rate:
              interestRate,

            total_amount:
              totalAmount,

            amount_paid:
              0,

            remaining_balance:
              totalAmount,

            loan_status:
              "APPROVED",

            application_date:
              application.created_at,

            approval_date:
              approvalDate.toISOString(),

            due_date:
              finalDueDate.toISOString(),

            approved_by:
              req.admin?.admin_id || null,

            purpose:
              application.purpose || null
          })
          .select()
          .single();

        if (loanError) {
          console.error(
            "Loan creation error:",
            loanError
          );

          return res.status(500).json({
            success: false,
            message: "Could not create approved loan",
            error: loanError.message
          });
        }

        loan = newLoan;
      }


      // ==========================================
      // CHECK FOR EXISTING SCHEDULES
      // ==========================================

      const {
        data: existingSchedules,
        error: scheduleCheckError
      } = await supabase
        .from("loan_schedules")
        .select("id")
        .eq("loan_id", loan.id);

      if (scheduleCheckError) {
        console.error(
          "Schedule check error:",
          scheduleCheckError
        );

        return res.status(500).json({
          success: false,
          message: "Could not check repayment schedules",
          error: scheduleCheckError.message
        });
      }


      // ==========================================
      // CREATE REPAYMENT SCHEDULE
      // ==========================================

      if (
        !existingSchedules ||
        existingSchedules.length === 0
      ) {

        const schedules = [];

        for (
          let installment = 1;
          installment <= duration;
          installment++
        ) {

          const dueDate =
            new Date(approvalDate);

          dueDate.setMonth(
            dueDate.getMonth() + installment
          );


          // Handle rounding on the final installment
          let installmentAmount =
            monthlyInstallment;

          if (installment === duration) {
            installmentAmount =
              totalAmount -
              (monthlyInstallment *
               (duration - 1));
          }


          schedules.push({
            loan_id:
              loan.id,

            customer_id:
              application.customer_id,

            installment_number:
              installment,

            due_date:
              dueDate.toISOString(),

            amount_due:
              Number(
                installmentAmount.toFixed(2)
              ),

            amount_paid:
              0,

            remaining_amount:
              Number(
                installmentAmount.toFixed(2)
              ),

            status:
              "PENDING",

            paid_date:
              null
          });
        }


        const {
          error: scheduleError
        } = await supabase
          .from("loan_schedules")
          .insert(schedules);

        if (scheduleError) {
          console.error(
            "Schedule creation error:",
            scheduleError
          );

          return res.status(500).json({
            success: false,
            message:
              "Loan created but repayment schedules could not be created",
            error:
              scheduleError.message
          });
        }
      }


      // ==========================================
      // UPDATE APPLICATION
      // ==========================================

      const {
        data: updatedApplication,
        error: updateError
      } = await supabase
        .from("loan_applications")
        .update({
          status:
            "APPROVED",

          reviewed_at:
            approvalDate.toISOString(),

          reviewed_by:
            req.admin?.admin_id || null,

          rejection_reason:
            null
        })
        .eq("id", applicationId)
        .select()
        .maybeSingle();

      if (updateError) {
        console.error(
          "Application approval update error:",
          updateError
        );

        return res.status(500).json({
          success: false,
          message:
            "Loan created but application status could not be updated",
          error:
            updateError.message
        });
      }


      // ==========================================
      // SUCCESS
      // ==========================================

      return res.json({
        success: true,

        message:
          "Loan approved and repayment schedule created successfully.",

        application:
          updatedApplication,

        loan:
          loan,

        schedule: {
          duration_months:
            duration,

          interest_rate:
            interestRate,

          total_interest:
            Number(
              totalInterest.toFixed(2)
            ),

          total_amount:
            Number(
              totalAmount.toFixed(2)
            ),

          monthly_installment:
            Number(
              monthlyInstallment.toFixed(2)
            )
        }
      });

    } catch (error) {

      console.error(
        "Loan approval server error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Could not approve loan application",
        error:
          error.message
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
