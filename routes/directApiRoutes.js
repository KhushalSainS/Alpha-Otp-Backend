import express from 'express';
import { sendOtp, verifyOtp } from '../controllers/apiController.js';
import ApiKey from '../models/apiModel.js';

const router = express.Router({ mergeParams: true }); // Important: mergeParams must be true

// Middleware to authenticate API key from URL parameter
const authenticateApiKeyFromUrl = async (req, res, next) => {
  try {
    const apiKey = req.params.apiKey;
    console.log('Authenticating with API key:', apiKey);
    
    if (!apiKey) {
      console.log('API key is missing in URL params');
      return res.status(401).json({ success: false, message: 'API key is required' });
    }
    
    // Find and validate the API key
    const apiKeyDoc = await ApiKey.findOne({ key: apiKey, active: true });
    
    if (!apiKeyDoc) {
      console.log('Invalid or inactive API key:', apiKey);
      return res.status(403).json({ success: false, message: 'Invalid or inactive API key' });
    }
    
    // Set user info in request object
    req.user = {
      userId: apiKeyDoc.user,
      apiKeyId: apiKeyDoc._id
    };
    
    console.log('API key authentication successful for user:', apiKeyDoc.user);
    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
};

// Apply the API key authentication middleware to all routes
router.use(authenticateApiKeyFromUrl);

// Support both POST and GET for sending OTP
// Route for sending OTP: /api/{apiKey}/send/{recipient}
router.post('/send/:recipient', (req, res) => {
  console.log('Received POST request to send OTP to:', req.params.recipient);
  // Set the recipient from URL params
  req.body.recipient = req.params.recipient;
  
  // Forward to the sendOtp controller
  sendOtp(req, res);
});

router.get('/send/:recipient', (req, res) => {
  console.log('Received GET request to send OTP to:', req.params.recipient);
  // Set the recipient from URL params
  req.body.recipient = req.params.recipient;
  
  // Forward to the sendOtp controller
  sendOtp(req, res);
});

// Support both POST and GET for verifying OTP
// Route for verifying OTP: /api/{apiKey}/verify/{recipient}/{otp}
router.post('/verify/:recipient/:otp', (req, res) => {
  console.log('Received POST request to verify OTP:', req.params.otp, 'for recipient:', req.params.recipient);
  // Set the recipient and OTP from URL params
  req.body.recipient = req.params.recipient;
  req.body.otp = req.params.otp;
  
  // Forward to the verifyOtp controller
  verifyOtp(req, res);
});

router.get('/verify/:recipient/:otp', (req, res) => {
  console.log('Received GET request to verify OTP:', req.params.otp, 'for recipient:', req.params.recipient);
  // Set the recipient and OTP from URL params
  req.body.recipient = req.params.recipient;
  req.body.otp = req.params.otp;
  
  // Forward to the verifyOtp controller
  verifyOtp(req, res);
});

export default router;
