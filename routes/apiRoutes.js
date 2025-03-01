import express from "express";
import { authenticateJWT, authenticateApiKey } from "../middleware/auth.js";
import { 
  sendOtp, 
  verifyOtp, 
  getOtpLogs, 
  getApiUsage 
} from "../controllers/apiController.js";

const apiRouter = express.Router();

// OTP routes - require API key authentication
apiRouter.post("/send-otp", authenticateApiKey, sendOtp);
apiRouter.post("/verify-otp", authenticateApiKey, verifyOtp);

// Protected routes - require JWT authentication
apiRouter.get("/otp-logs", authenticateJWT, getOtpLogs);
apiRouter.get("/usage", authenticateJWT, getApiUsage);

export default apiRouter;
