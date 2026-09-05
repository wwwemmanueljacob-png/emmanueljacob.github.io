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

    if (!decoded.customer_id) {
      return res.status(401).json({
        success: false,
        message: "Invalid customer authentication"
      });
    }

    req.customer = decoded;

    next();
  } catch (error) {
    console.error(error);

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
      applicant_name,
      phone,
      email,
      residential_address,
      employment_status,
      monthly_income,
      business_name,
      business_address,
      business_type,
      monthly_business_income,
      amount,
      duration_months,
      purpose
    } = req.body;

    // ==========================================
    // BASIC VALIDATION
    // ==========================================
    if (!loan_type) {
      return res.status(400).json({
        success: false,
        message: "Loan type is required"
      });
    }

    if (!amount || !duration_months) {
      return res.status(400).json({
        success: false,
        message: "Loan amount and repayment period are required"
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

    // ==========================================
    // PERSONAL LOAN VALIDATION
    // ==========================================
    if (loan_type === "personal") {
      if (
        !applicant_name ||
        !phone ||
        !email ||
        !residential_address ||
        !employment_status ||
        !monthly_income
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Personal loan requires applicant name, phone, email, address, employment status and monthly income"
        });
      }

      const monthlyIncome = Number(monthly_income);

      if (!Number.isFinite(monthlyIncome) || monthlyIncome <= 0) {
        return res.status(400).json({
          success: false,
          message: "Monthly income must be a valid amount greater than zero"
        });
      }
    }

    // ==========================================
    // BUSINESS LOAN VALIDATION
    // ==========================================
    if (loan_type === "business") {
      if (
        !applicant_name ||
        !business_name ||
        !phone ||
        !email ||
        !business_address ||
        !business_type ||
        !monthly_business_income
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Business loan requires applicant name, business name, phone, email, business address, business type and monthly business income"
        });
      }

      const monthlyBusinessIncome = Number(monthly_business_income);

      if (
        !Number.isFinite(monthlyBusinessIncome) ||
        monthlyBusinessIncome <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Monthly business income must be a valid amount greater than zero"
        });
      }
    }

    // ==========================================
    // VERIFY CUSTOMER
    // ==========================================
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, full_name, email, phone")
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
    // PREPARE APPLICATION DATA
    // ==========================================
    const applicationData = {
      customer_id: customer.id,
      loan_type,
      applicant_name: applicant_name || customer.full_name,
      phone: phone || customer.phone,
      email: email || customer.email,
      residential_address: residential_address || null,
      employment_status: employment_status || null,
      monthly_income:
        monthly_income !== undefined && monthly_income !== ""
          ? Number(monthly_income)
          : null,
      business_name: business_name || null,
      business_address: business_address || null,
      business_type: business_type || null,
      monthly_business_income:
        monthly_business_income !== undefined &&
        monthly_business_income !== ""
          ? Number(monthly_business_income)
          : null,
      amount: loanAmount,
      duration_months: duration,
      purpose: purpose || null,
      status: "pending"
    };

    // ==========================================
    // SAVE APPLICATION
    // ==========================================
    const { data: application, error: insertError } = await supabase
      .from("loan_applications")
      .insert([applicationData])
      .select(
        `
        id,
        customer_id,
        loan_type,
        applicant_name,
        phone,
        email,
        residential_address,
        employment_status,
        monthly_income,
        business_name,
        business_address,
        business_type,
        monthly_business_income,
        amount,
        duration_months,
        purpose,
        status,
        created_at
        `
      )
      .single();

    if (insertError) {
      console.error(insertError);

      return res.status(500).json({
        success: false,
        message: "Could not submit loan application",
        error: insertError.message
      });
    }

    // ==========================================
    // SUCCESS
    // ==========================================
    return res.status(201).json({
      success: true,
      message: "Loan application submitted successfully",
      application
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
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
        `
        id,
        loan_type,
        applicant_name,
        phone,
        email,
        residential_address,
        employment_status,
        monthly_income,
        business_name,
        business_address,
        business_type,
        monthly_business_income,
        amount,
        duration_months,
        purpose,
        status,
        created_at
        `
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

    return res.json({
      success: true,
      message: "Loan applications retrieved successfully",
      applications: applications || []
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Could not retrieve loan applications"
    });
  }
});

export default router;
