import express from "express";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

// Customer registration
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

export default router;
