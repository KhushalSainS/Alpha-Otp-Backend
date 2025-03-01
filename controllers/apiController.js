import ApiKey from "../models/apiModel.js";
import OtpLog from "../models/otpLogModel.js";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { decryptEmailConfig } from "./userController.js";

// Helper: Generate a secure 6-digit OTP
const generateOtp = () => {
  const characters = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  // Get cryptographically secure random bytes
  const randomBytes = crypto.randomBytes(32); // Using more bytes for better entropy
  let offset = 0;
  
  while (result.length < 6) {
    // Use modulo bias elimination technique
    const rand = ((randomBytes[offset] << 8) | randomBytes[offset + 1]) & 0xffff;
    const maxValue = Math.floor(0xffff / characters.length) * characters.length;
    if (rand < maxValue) {
      result += characters.charAt(rand % characters.length);
    }
    offset = (offset + 2) % randomBytes.length;
  }
  return result;
};

// SEND OTP
export const sendOtp = async (req, res) => {
  // Expecting: recipient (phone or email) and channel ("sms" or "email")
  const { recipient, channel = "email" } = req.body;
  
  // Add validation for required parameters
  if (!recipient) {
    return res.json({
      success: false,
      message: "Recipient is required"
    });
  }
  
  try {
    console.log(`Attempting to send OTP to ${recipient} via ${channel}`);
    
    // Get API key to access email configuration
    const apiKey = await ApiKey.findById(req.user.apiKeyId);
    if (!apiKey) {
      return res.json({
        success: false,
        message: "API key not found"
      });
    }

    // Check if email configuration exists when using email channel
    if (channel === "email" && (!apiKey.emailConfig || !apiKey.emailConfig.email || !apiKey.emailConfig.password)) {
      return res.json({
        success: false,
        message: "Email configuration not found or incomplete"
      });
    }
    
    // Generate OTP and set expiry time (5 minutes)
    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
    
    // Create a new OTP log
    const otpLog = new OtpLog({
      apiKey: req.user.apiKeyId,
      user: req.user.userId,
      recipient,
      channel,
      otp,
      otpExpiry,
      status: "pending",
      sentAt: new Date()
    });
    
    // Save the OTP log first to catch any validation errors early
    console.log("Saving OTP log to database");
    await otpLog.save();
    console.log(`OTP log created with ID: ${otpLog._id}`);
    
    // Actually send the OTP using stored credentials
    if (channel === "email") {
      try {
        // Decrypt email credentials
        let emailUser = apiKey.emailConfig.email;
        let emailPass = apiKey.emailConfig.password;
        
        // Only decrypt if IV exists (meaning the data is encrypted)
        if (apiKey.emailConfig.iv) {
          console.log("Decrypting email credentials...");
          try {
            emailUser = decryptEmailConfig(emailUser, apiKey.emailConfig.iv);
            emailPass = decryptEmailConfig(emailPass, apiKey.emailConfig.iv);
            console.log(`Email decryption successful for: ${emailUser.slice(0, 5)}...`);
          } catch (decryptError) {
            console.error("Decryption error:", decryptError);
            // If decryption fails, try using the stored values directly
            console.log("Falling back to stored credentials without decryption");
            emailUser = apiKey.emailConfig.email;
            emailPass = apiKey.emailConfig.password;
          }
        }
        
        console.log(`Attempting to send email using ${emailUser} via ${apiKey.emailConfig.service}`);
        
        // Configure nodemailer with stored credentials
        const transporter = nodemailer.createTransport({
          service: apiKey.emailConfig.service || "gmail",
          auth: {
            user: emailUser,
            pass: emailPass
          },
          debug: true // Enable debug mode for more detailed logging
        });
        
        // Verify the transporter configuration
        await transporter.verify();
        console.log("SMTP connection verified successfully");
        
        // Set up email content
        const mailOptions = {
          from: emailUser,
          to: recipient,
          subject: "Your Verification Code",
          text: `Your verification code is: ${otp}. It will expire in 5 minutes.`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Verification Code</h2>
              <p>Your verification code is:</p>
              <h1 style="font-size: 36px; letter-spacing: 5px; font-weight: bold; color: #4a6ee0;">${otp}</h1>
              <p>This code will expire in 5 minutes.</p>
              <p>If you didn't request this code, you can ignore this message.</p>
            </div>
          `
        };
        
        // Send the email
        console.log("Sending email...");
        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent successfully:", info.messageId);
        
        // Update OTP log to reflect success
        otpLog.status = "sent";
        await otpLog.save();
        
      } catch (emailError) {
        console.error("Error sending email:", emailError);
        
        // Update OTP log to reflect failure
        otpLog.status = "failed";
        await otpLog.save();
        
        // Provide more specific error messages
        const errorMessage = emailError.message.toLowerCase();
        
        if (errorMessage.includes("535") || 
            errorMessage.includes("534") ||
            errorMessage.includes("authentication failed") || 
            errorMessage.includes("password not accepted") || 
            errorMessage.includes("invalid login") ||
            errorMessage.includes("invalid credentials")) {
          
          if (apiKey.emailConfig.service && apiKey.emailConfig.service.toLowerCase() === "gmail") {
            return res.json({
              success: false,
              message: "Gmail authentication failed. This is likely due to one of these issues:",
              details: [
                "1. The App Password may have been entered incorrectly (it should be 16 characters without spaces)",
                "2. 2-Step Verification may not be enabled on your Gmail account",
                "3. Your Google Account security settings may be blocking the login attempt",
                "4. The encryption/decryption process for your credentials may have issues"
              ],
              troubleshooting: "Please try creating a new API key with a fresh App Password, ensuring no spaces are included",
              error: errorMessage
            });
          } else {
            return res.json({
              success: false,
              message: "Email authentication failed",
              error: errorMessage
            });
          }
        } else {
          return res.json({
            success: false,
            message: "Failed to send OTP via email",
            error: errorMessage
          });
        }
      }
    } else if (channel === "sms") {
      // SMS implementation would go here if needed
      console.log(`SMS sending is not implemented yet. Would send ${otp} to ${recipient}`);
      
      // Don't return success for SMS since it's not actually implemented
      return res.json({
        success: false,
        message: "SMS channel is not implemented yet",
      });
    }
    
    // Update API usage count
    const apiUsageRecord = await ApiKey.findById(req.user.apiKeyId);
    if (apiUsageRecord) {
      apiUsageRecord.numberOfSentOTPs = (apiUsageRecord.numberOfSentOTPs || 0) + 1;
      await apiUsageRecord.save();
    }
    
    return res.json({
      success: true,
      message: "OTP sent successfully",
      recipient,
      channel,
      expiry: otpExpiry
    });
    
  } catch (error) {
    console.error("Error sending OTP:", error);
    return res.json({
      success: false,
      message: "Failed to send OTP",
      error: error.message
    });
  }
};

// VERIFY OTP
export const verifyOtp = async (req, res) => {
  // Expecting: recipient and otp in req.body
  const { recipient, otp } = req.body;
  
  if (!recipient || !otp) {
    return res.json({
      success: false,
      message: "Recipient and OTP are required"
    });
  }
  
  try {
    console.log(`Verifying OTP: ${otp} for recipient: ${recipient}`);
    
    // Find the most recent pending OTP for the recipient that is still valid
    // AND is associated with the current user or API key
    const otpLog = await OtpLog.findOne({
      recipient,
      otp,
      status: "pending",
      otpExpiry: { $gt: new Date() },
      apiKey: req.user.apiKeyId, // Add this check to ensure the OTP belongs to the current API key
      user: req.user.userId // Add this check to ensure the OTP belongs to the current user
    }).sort({ sentAt: -1 });
    
    if (!otpLog) {
      console.log("Invalid or expired OTP");
      
      // Check if an expired or invalid OTP attempt was made
      const failedAttempt = await OtpLog.findOne({
        recipient,
        otp,
        user: req.user.userId
      }).sort({ sentAt: -1 });
      
      // If OTP exists but is expired, provide a more specific error
      if (failedAttempt && failedAttempt.otpExpiry < new Date()) {
        return res.json({
          success: false,
          message: "OTP has expired. Please request a new one.",
          expired: true
        });
      }
      
      // Track failed verification attempts (could implement rate limiting here)
      console.log("Failed verification attempt");
      
      return res.json({
        success: false,
        message: "Invalid OTP. Please check and try again."
      });
    }
    
    // Mark the OTP as verified (or delivered)
    otpLog.status = "delivered";
    otpLog.deliveredAt = new Date();
    await otpLog.save();
    
    console.log("OTP verified successfully");
    return res.json({
      success: true,
      message: "OTP verified successfully",
      verified: true
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return res.json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// GET OTP LOGS FOR THE AUTHENTICATED USER
export const getOtpLogs = async (req, res) => {
  try {
    const userId = req.user.userId;
    const otpLogs = await OtpLog.find({ user: userId }).sort({ sentAt: -1 });
    return res.json({
      success: true,
      message: "OTP logs retrieved successfully",
      otpLogs
    });
  } catch (error) {
    return res.json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// GET API USAGE STATS FOR THE AUTHENTICATED USER
export const getApiUsage = async (req, res) => {
  try {
    const userId = req.user.userId;
    const apiKey = await ApiKey.findOne({ user: userId });
    
    if (!apiKey) {
      return res.json({
        success: false,
        message: "No API usage record found for this user"
      });
    }
    
    return res.json({
      success: true,
      message: "API usage retrieved successfully",
      apiUsage: {
        numberOfSentOTPs: apiKey.numberOfSentOTPs || 0,
        createdAt: apiKey.createdAt
      }
    });
  } catch (error) {
    return res.json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};
