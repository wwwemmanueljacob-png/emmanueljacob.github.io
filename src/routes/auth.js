import express from "express";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

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

    // Check whether email or phone already exists
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

    // Hash password before storing it
    const password_hash = await bcrypt.hash(password, 12);

    // Create customer
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

    // Find customer by email
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

    // Verify password
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

    // Never send password hash to the client
    const { password_hash, ...safeCustomer } = customer;

    res.json({
      success: true,
      message: "Login successful",
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

export default router;
