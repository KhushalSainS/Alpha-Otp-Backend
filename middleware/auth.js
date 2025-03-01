import jwt from 'jsonwebtoken';
import ApiKey from '../models/apiModel.js';

// Validate JWT token for admin/dashboard access
export const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log("Auth header:", authHeader);

  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded token:", decoded);
    req.user = decoded;
    next();
  } catch (error) {
    console.error("JWT verification error:", error);
    return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
  }
};

// Validate API key for client applications
export const authenticateApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ success: false, message: 'API key is required' });
  }
  
  try {
    // Find and validate the API key
    const apiKeyDoc = await ApiKey.findOne({ key: apiKey, active: true });
    
    if (!apiKeyDoc) {
      return res.status(403).json({ success: false, message: 'Invalid or inactive API key' });
    }
    
    // Add the user to the request
    req.user = { userId: foundApiKey.user._id };
    next();
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};
