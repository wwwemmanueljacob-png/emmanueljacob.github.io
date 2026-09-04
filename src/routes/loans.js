import express from "express";
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

const JWT_SECRET = process.env.JWT_SECRET;


// ==========================================
// AUTHENTICATION MIDDLEWARE
// ==========================================
function authenticateCustomer(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is required"
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

    req.customer = decoded;

    next();

  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Authentication token has expired"
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid authentication token"
    });
  }
}


// ==========================================
// SUBMIT LOAN APPLICATION
// ==========================================
router.post("/apply", authenticateCustomer, async (req, res) => {
  try {
    const {
      loan_type,
      amount,
      duration_months,
      purpose
    } = req.body;

    if (!loan_type || !amount || !duration_months) {
      return res.status(400).json({
        success: false,
        message: "Loan type, amount and repayment period are required"
      });
    }

    const loanAmount = Number(amount);
    const duration = Number(duration_months);

    if (!Number.isFinite(loanAmount) || loanAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Loan amount must be a valid amount greater than zero"
      });
    }

    if (!Number.isInteger(duration) || duration <= 0) {
      return res.status(400).json({
        success: false,
        message: "Repayment period must be a valid number of months"
      });
    }

    // Make sure the logged-in customer still exists
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id")
      .eq("id", req.customer.customer_id)
      .maybeSingle();

    if (customerError) {
      console.error(customerError);

      return res.status(500).json({
        success: false,
        message: "Could not verify customer account"
      });
    }

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer account not found"
      });
    }

    // Create loan application
    const { data: application, error: insertError } = await supabase
      .from("loan_applications")
      .insert([
        {
          customer_id: customer.id,
          loan_type,
          amount: loanAmount,
          duration_months: duration,
          purpose: purpose || null,
          status: "pending"
        }
      ])
      .select(
        "id, customer_id, loan_type, amount, duration_months, purpose, status, created_at"
      )
      .single();

    if (insertError) {
      console.error(insertError);

      return res.status(500).json({
        success: false,
        message: "Could not submit loan application"
      });
    }

    res.status(201).json({
      success: true,
      message: "Loan application submitted successfully",
      application
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Loan application failed"
    });
  }
});


// ==========================================
// GET MY LOAN APPLICATIONS
// ==========================================
router.get("/my-applications", authenticateCustomer, async (req, res) => {
  try {
    const { data: applications, error } = await supabase
      .from("loan_applications")
      .select(
        "id, loan_type, amount, duration_months, purpose, status, created_at"
      )
      .eq("customer_id", req.customer.customer_id)
      .order("created_at", { ascending: false });

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
      applications
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not retrieve loan applications"
    });
  }
});


export default router;
