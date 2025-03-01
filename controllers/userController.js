import User from "../models/userModel.js";
import ApiKey from "../models/apiModel.js";
import Order from "../models/orderModel.js";
import Transaction from "../models/transactionModel.js";
import Plan from "../models/planModel.js";
import Wallet from "../models/walletModel.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import Razorpay from 'razorpay';
import mongoose from 'mongoose';

// Set your JWT secret and expiration (use environment variables in production)
const JWT_SECRET = process.env.JWT_SECRET ;
const JWT_EXPIRES_IN = "1d";

// REGISTER A NEW USER (COMPANY)
export const register = async (req, res) => {
  const {
    companyName,
    email,
    password,
    contactNumber,
    taxIdentificationNumber,
    businessPan,
    registeredBusinessId,
    senderConfig, // { email, emailPassword, phoneNumber }
  } = req.body;

  try {
    // Input validation
    if (!email || !password || !companyName) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    let user = await User.findOne({ email });
    if (user) {
      return res.status(409).json({
        success: false,
        message: "User already exists",
      });
    }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);
    user = new User({
      companyName,
      email,
      password: hashedPassword,
      contactNumber,
      taxIdentificationNumber,
      businessPan,
      registeredBusinessId
    });
    await user.save();

    // Generate a JWT token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });
    return res.json({
      success: true,
      message: "User registered successfully",
      token,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// USER LOGIN
export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });
    return res.json({
      success: true,
      message: "Logged in successfully",
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// CREATE A NEW API KEY
export const createApiKey = async (req, res) => {
  try {
    const { email, emailPassword, emailService = "gmail" } = req.body;
    
    if (!email || !emailPassword) {
      return res.json({
        success: false,
        message: "Email and password are required for OTP sending",
      });
    }

    // Add Gmail app password warning
    let gmailWarning = "";
    if (email.includes("gmail.com") && emailService === "gmail") {
      gmailWarning = "IMPORTANT: For Gmail accounts, you must use an App Password instead of your regular password. Regular passwords won't work due to Gmail's security policies. Please see our documentation for setting up an App Password.";
    }

    // Generate encryption key and IV
    const encryptionKey = crypto.scryptSync(process.env.ENCRYPTION_SECRET || 'your-secret-key', 'salt', 32);
    const iv = crypto.randomBytes(16);

    // Encrypt email and password
    const encryptEmail = (text) => {
      const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return encrypted;
    };

    const encryptedEmail = email;
    const encryptedPassword = emailPassword;
    
    const userId = req.user.userId;
    const key = crypto.randomBytes(16).toString("hex");

    const newApiKey = new ApiKey({
      user: userId,
      key,
      emailConfig: {
        email: encryptedEmail,
        password: encryptedPassword,
        iv: iv.toString('hex'),
        service: emailService
      }
    });
    await newApiKey.save();

    const baseUrl = process.env.API_BASE_URL || "http://localhost:5000";
    // Direct API URL that includes the key in the URL path
    const apiBaseUrl = `${baseUrl}/api/${key}`;

    return res.json({
      success: true,
      message: "API key created successfully",
      apiKey: {
        _id: newApiKey._id,
        key: newApiKey.key,
        email: email, // Return original email for display
        active: newApiKey.active,
        createdAt: newApiKey.createdAt
      },
      apiEndpoints: {
        baseUrl: apiBaseUrl,
        usage: {
          send: `${apiBaseUrl}/send/{recipient}`,
          verify: `${apiBaseUrl}/verify/{recipient}/{otp}`
        }
      },
      gmailWarning: gmailWarning || undefined
    });
  } catch (error) {
    return res.json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Add this utility function to decrypt when needed
export const decryptEmailConfig = (encryptedData, ivString) => {
  try {
    const encryptionKey = crypto.scryptSync(process.env.ENCRYPTION_SECRET || 'your-secret-key', 'salt', 32);
    const iv = typeof ivString === 'string' ? Buffer.from(ivString, 'hex') : ivString;
    const decipher = crypto.createDecipheriv('aes-256-cbc', encryptionKey, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error(`Decryption failed: ${error.message}`);
  }
};

// DELETE AN EXISTING API KEY
export const deleteApiKey = async (req, res) => {
  const { apiKeyId } = req.params;

  try {
    const userId = req.user.userId;
    
    // Debug info
    console.debug("Deleting API key:", { apiKeyId, userId });
    
    // Validate both IDs
    const isValidApiKeyId = mongoose.Types.ObjectId.isValid(apiKeyId);
    console.log(`Is valid API Key ID: ${isValidApiKeyId}`);
    
    // Find all API keys for this user to check what exists
    const userApiKeys = await ApiKey.find({ user: userId });
    console.log(`User has ${userApiKeys.length} API keys in total`);
    console.log("Available API key IDs:", userApiKeys.map(key => key._id.toString()));
    
    let apiKey;
    
    // First try to find by MongoDB ObjectID
    if (isValidApiKeyId) {
      apiKey = await ApiKey.findOne({ _id: apiKeyId, user: userId });
      console.log(`Search by ObjectID result: ${apiKey ? 'Found' : 'Not found'}`);
    }
    
    // If not found by ObjectID, try finding by the key string itself
    if (!apiKey) {
      apiKey = await ApiKey.findOne({ key: apiKeyId, user: userId });
      console.log(`Search by key string result: ${apiKey ? 'Found' : 'Not found'}`);
    }
    
    if (!apiKey) {
      // Try searching without user filter to see if key exists but belongs to someone else
      const anyApiKey = await ApiKey.findById(apiKeyId);
      if (anyApiKey) {
        console.log("API key exists but belongs to different user");
        return res.json({
          success: false,
          message: "You don't have permission to delete this API key.",
        });
      }
      
      return res.json({
        success: false,
        message: "API key not found. Please check the key ID and try again.",
      });
    }

    await ApiKey.deleteOne({ _id: apiKey._id });
    return res.json({
      success: true,
      message: "API key deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteApiKey:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// GET ALL API KEYS FOR THE AUTHENTICATED USER
export const getApiKeys = async (req, res) => {
  try {
    const userId = req.user.userId;
    const apiKeys = await ApiKey.find({ user: userId });
    return res.json({
      success: true,
      message: "API keys retrieved successfully",
      apiKeys,
    });
  } catch (error) {
    return res.json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// CREATE ORDER & SIMULATE PAYMENT (DUMMY RAZORPAYX)
export const createOrder = async (req, res) => {
  const { amount, creditsPurchased } = req.body;

  try {
    const userId = req.user.userId;

    // Create a new order with status 'pending'
    let order = new Order({
      user: userId,
      amount,
      creditsPurchased,
      status: "pending",
    });
    await order.save();

    // Create Razorpay payment link
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    const paymentLink = await razorpay.paymentLink.create({
      amount: amount * 100, // Convert to paise
      currency: "INR",
      reference_id: order._id.toString(),
      description: `Purchase ${creditsPurchased} credits`,
      callback_url: "http://localhost:5000/api/user/payment/callback",
      callback_method: "get"
    });

    return res.json({
      success: true,
      message: "Order created successfully",
      order,
      payment_link: paymentLink.short_url
    });
  } catch (error) {
    console.log(error);
    return res.json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// HANDLE RAZORPAY PAYMENT CALLBACK
export const handlePaymentCallback = async (req, res) => {
  try {
    // Extract payment data from query params
    const {
      razorpay_payment_id,
      razorpay_payment_link_id,
      razorpay_payment_link_reference_id,
      razorpay_payment_link_status,
      razorpay_signature
    } = req.query;

    // Log the received callback data
    console.log("Razorpay callback received:", req.query);

    // Verify the payment signature (important for security)
    const text = `${razorpay_payment_link_id}|${razorpay_payment_link_reference_id}|${razorpay_payment_link_status}|${razorpay_payment_id}`;
    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest("hex");
    
    const isSignatureValid = generated_signature === razorpay_signature;

    if (!isSignatureValid) {
      console.error("Invalid Razorpay signature");
      return res.json({
        success: false,
        message: "Invalid payment signature"
      });
    }

    // Verify the payment status
    if (razorpay_payment_link_status !== 'paid') {
      return res.json({
        success: false,
        message: "Payment failed or pending",
        status: razorpay_payment_link_status
      });
    }

    // Find the order using the reference_id (which should be your order ID)
    const orderId = razorpay_payment_link_reference_id;
    const order = await Order.findById(orderId);
    
    if (!order) {
      console.error("Order not found:", orderId);
      return res.json({
        success: false,
        message: "Order not found",
        orderId
      });
    }

    // Check if payment is already processed (idempotency)
    if (order.status === "completed") {
      return res.json({
        success: true,
        message: "Payment already processed",
        order,
      });
    }

    // Update order status
    order.status = "completed";
    order.paymentId = razorpay_payment_id;
    order.paymentLinkId = razorpay_payment_link_id;
    order.updatedAt = new Date();
    await order.save();

    // Update or create wallet for the user
    let wallet = await Wallet.findOne({ user: order.user });
    if (!wallet) {
      wallet = new Wallet({ user: order.user, balance: 0 });
    }
    wallet.balance += order.creditsPurchased;
    wallet.updatedAt = new Date();
    await wallet.save();

    // Create a transaction record
    const transaction = new Transaction({
      user: order.user,
      amount: order.creditsPurchased,
      type: "credit",
      description: `Order ${order._id} payment completed. ${order.creditsPurchased} credits added.`,
      paymentId: razorpay_payment_id,
      orderId: order._id
    });
    await transaction.save();

    // Redirect to frontend with success message
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success?orderId=${order._id}&status=success`);

  } catch (error) {
    console.error("Payment callback error:", error);
    // Redirect to frontend with error message
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/failed?error=${encodeURIComponent(error.message)}`);
  }
};

// GET ALL ORDERS FOR THE AUTHENTICATED USER
export const getOrders = async (req, res) => {
  try {
    const userId = req.user.userId;
    const orders = await Order.find({ user: userId }).sort({ createdAt: -1 });
    return res.json({
      success: true,
      message: "Orders retrieved successfully",
      orders,
    });
  } catch (error) {
    return res.json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// GET TRANSACTION HISTORY FOR THE AUTHENTICATED USER
export const getTransactions = async (req, res) => {
  try {
    const userId = req.user.userId;
    const transactions = await Transaction.find({ user: userId }).sort({ timestamp: -1 });
    return res.json({
      success: true,
      message: "Transactions retrieved successfully",
      transactions,
    });
  } catch (error) {
    return res.json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// GET ALL AVAILABLE PLANS
export const getPlans = async (req, res) => {
  try {
    const plans = await Plan.find({});
    return res.json({
      success: true,
      message: "Plans retrieved successfully",
      plans,
    });
  } catch (error) {
    return res.json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// UPDATE USER'S SUBSCRIPTION PLAN
export const updatePlan = async (req, res) => {
  const { planId } = req.body;

  try {
    const userId = req.user.userId;
    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.json({
        success: false,
        message: "Plan not found",
      });
    }

    await User.findByIdAndUpdate(userId, { subscriptionPlan: planId });
    return res.json({
      success: true,
      message: "Subscription plan updated successfully",
      plan,
    });
  } catch (error) {
    return res.json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// GET WALLET DETAILS FOR THE AUTHENTICATED USER
export const getWallet = async (req, res) => {
  try {
    const userId = req.user.userId;
    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      return res.json({
        success: false,
        message: "Wallet not found",
      });
    }
    return res.json({
      success: true,
      message: "Wallet retrieved successfully",
      wallet,
    });
  } catch (error) {
    return res.json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
