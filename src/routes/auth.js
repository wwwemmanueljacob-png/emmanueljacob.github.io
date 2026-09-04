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
// CUSTOMER REGISTRATION
// ==========================================
router.post("/register", async (req, res) => {
  try {
    const { full_name, email, phone, password } = req.body;

    if (!full_name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, phone and password are required"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters"
      });
    }

    const { data: existingCustomer, error: checkError } = await supabase
      .from("customers")
      .select("id, email, phone")
      .or(`email.eq.${email},phone.eq.${phone}`)
      .maybeSingle();

    if (checkError) {
      console.error(checkError);

      return res.status(500).json({
        success: false,
        message: "Could not check existing customer"
      });
    }

    if (existingCustomer) {
      return res.status(409).json({
        success: false,
        message: "Email or phone number is already registered"
      });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const { data: customer, error: insertError } = await supabase
      .from("customers")
      .insert([
        {
          full_name,
          email,
          phone,
          password_hash
        }
      ])
      .select("id, full_name, email, phone, created_at")
      .single();

    if (insertError) {
      console.error(insertError);

      return res.status(500).json({
        success: false,
        message: "Could not create customer account"
      });
    }

    res.status(201).json({
      success: true,
      message: "Customer account created successfully",
      customer
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Registration failed"
    });
  }
});


// ==========================================
// CUSTOMER LOGIN
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

    const { data: customer, error } = await supabase
      .from("customers")
      .select("id, full_name, email, phone, password_hash, created_at")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Could not access customer account"
      });
    }

    if (!customer) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      customer.password_hash
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    if (!JWT_SECRET) {
      console.error("JWT_SECRET is not configured");

      return res.status(500).json({
        success: false,
        message: "Authentication system is not configured"
      });
    }

    const token = jwt.sign(
      {
        customer_id: customer.id,
        email: customer.email
      },
      JWT_SECRET,
      {
        expiresIn: "7d"
      }
    );

    const { password_hash, ...safeCustomer } = customer;

    res.json({
      success: true,
      message: "Login successful",
      token,
      customer: safeCustomer
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Login failed"
    });
  }
});


// ==========================================
// CUSTOMER PROFILE
// ==========================================
router.get("/profile", async (req, res) => {
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

    // Verify JWT
    const decoded = jwt.verify(token, JWT_SECRET);

    // Find customer
    const { data: customer, error } = await supabase
      .from("customers")
      .select("id, full_name, email, phone, created_at")
      .eq("id", decoded.customer_id)
      .maybeSingle();

    if (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Could not retrieve customer profile"
      });
    }

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer account not found"
      });
    }

    res.json({
      success: true,
      message: "Customer profile retrieved successfully",
      customer
    });

  } catch (error) {
    console.error(error);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token"
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Authentication token has expired"
      });
    }

    res.status(500).json({
      success: false,
      message: "Could not retrieve customer profile"
    });
  }
});


export default router;
