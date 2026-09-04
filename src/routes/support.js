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
// SEND SUPPORT MESSAGE
// ==========================================
router.post("/send", authenticateCustomer, async (req, res) => {
  try {
    const {
      name,
      email,
      subject,
      message
    } = req.body;

    // Validate required fields
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "Name, email and message are required"
      });
    }

    // Basic email validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address"
      });
    }

    // Limit message length
    if (message.length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Message must not exceed 5000 characters"
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
    // SAVE SUPPORT MESSAGE
    // ==========================================
    const { data: supportMessage, error: insertError } = await supabase
      .from("support_messages")
      .insert([
        {
          customer_id: customer.id,
          name,
          email,
          subject: subject || null,
          message,
          status: "new"
        }
      ])
      .select(
        "id, customer_id, name, email, subject, message, status, created_at"
      )
      .single();

    if (insertError) {
      console.error(insertError);

      return res.status(500).json({
        success: false,
        message: "Could not save support message"
      });
    }

    // ==========================================
    // SUCCESS
    // ==========================================
    res.status(201).json({
      success: true,
      message: "Support message sent successfully",
      support_message: supportMessage
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not send support message"
    });
  }
});

// ==========================================
// GET MY SUPPORT MESSAGES
// ==========================================
router.get("/my-messages", authenticateCustomer, async (req, res) => {
  try {
    const { data: messages, error } = await supabase
      .from("support_messages")
      .select(
        "id, name, email, subject, message, status, created_at"
      )
      .eq("customer_id", req.customer.customer_id)
      .order("created_at", { ascending: false });

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
      messages
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not retrieve support messages"
    });
  }
});

export default router;
