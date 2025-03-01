import express from 'express';
import { sendOtp, verifyOtp } from '../controllers/apiController.js';
import ApiKey from '../models/apiModel.js';

const router = express.Router();

// Middleware to authenticate API key from URL parameter
const authenticateApiKeyFromUrl = async (req, res, next) => {
  try {
    const apiKey = req.params.apiKey;
    
    if (!apiKey) {
      return res.status(401).json({ success: false, message: 'API key is required' });
    }
    
    // Find and validate the API key
    const apiKeyDoc = await ApiKey.findOne({ key: apiKey, active: true });
    
    if (!apiKeyDoc) {
      return res.status(403).json({ success: false, message: 'Invalid or inactive API key' });
    }
    
    // Set user info in request object
    req.user = {
      userId: apiKeyDoc.user,
      apiKeyId: apiKeyDoc._id
    };
    
    next();
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
};

// Route for sending OTP: /api/otp/send/:apiKey/:recipient
router.post('/send/:apiKey/:recipient', authenticateApiKeyFromUrl, (req, res) => {
  // Set the recipient from URL params
  req.body.recipient = req.params.recipient;
  
  // Forward to the sendOtp controller
  sendOtp(req, res);
});

// Route for verifying OTP: /api/otp/verify/:apiKey/:recipient/:otp
router.post('/verify/:apiKey/:recipient/:otp', authenticateApiKeyFromUrl, (req, res) => {
  // Set the recipient and OTP from URL params
  req.body.recipient = req.params.recipient;
  req.body.otp = req.params.otp;
  
  // Forward to the verifyOtp controller
  verifyOtp(req, res);
});

export default router;
