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

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is missing"
      });
    }

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
// SUBMIT PAYMENT
// ==========================================
router.post("/submit", authenticateCustomer, async (req, res) => {
  try {
    const {
      loan_application_id,
      amount,
      payment_method
    } = req.body;

    // Validate required fields
    if (!loan_application_id || !amount || !payment_method) {
      return res.status(400).json({
        success: false,
        message:
          "Loan application ID, payment amount and payment method are required"
      });
    }

    const loanId = Number(loan_application_id);
    const paymentAmount = Number(amount);

    // Validate loan ID
    if (!Number.isInteger(loanId) || loanId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Loan application ID must be a valid number"
      });
    }

    // Validate payment amount
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Payment amount must be greater than zero"
      });
    }

    // ==========================================
    // VERIFY CUSTOMER
    // ==========================================
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

    // ==========================================
    // VERIFY LOAN BELONGS TO CUSTOMER
    // ==========================================
    const { data: loan, error: loanError } = await supabase
      .from("loan_applications")
      .select("id, customer_id, loan_type, amount, status")
      .eq("id", loanId)
      .eq("customer_id", customer.id)
      .maybeSingle();

    if (loanError) {
      console.error(loanError);

      return res.status(500).json({
        success: false,
        message: "Could not verify loan application"
      });
    }

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: "Loan application not found for this customer"
      });
    }

    // ==========================================
    // CREATE PAYMENT
    // ==========================================
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert([
        {
          customer_id: customer.id,
          loan_application_id: loan.id,
          amount: paymentAmount,
          payment_method,
          payment_status: "pending"
        }
      ])
      .select(
        "id, customer_id, loan_application_id, amount, payment_method, payment_status, created_at"
      )
      .single();

    if (paymentError) {
      console.error(paymentError);

      return res.status(500).json({
        success: false,
        message: "Could not create payment"
      });
    }

    // ==========================================
    // SUCCESS RESPONSE
    // ==========================================
    res.status(201).json({
      success: true,
      message: "Payment submitted successfully",
      payment
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Payment submission failed"
    });
  }
});

// ==========================================
// GET MY PAYMENT HISTORY
// ==========================================
router.get("/my-payments", authenticateCustomer, async (req, res) => {
  try {
    const { data: payments, error } = await supabase
      .from("payments")
      .select(
        "id, loan_application_id, amount, payment_method, payment_status, created_at"
      )
      .eq("customer_id", req.customer.customer_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Could not retrieve payment history"
      });
    }

    res.json({
      success: true,
      message: "Payment history retrieved successfully",
      payments
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not retrieve payment history"
    });
  }
});

export default router;
