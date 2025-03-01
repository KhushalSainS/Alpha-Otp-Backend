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
  
  // Log the incoming request
  console.log(`[SendOTP] Received request:`, {
    recipient,
    channel,
    apiKeyId: req.user?.apiKeyId,
    userId: req.user?.userId,
    timestamp: new Date().toISOString()
  });
  
  // Add validation for required parameters
  if (!recipient) {
    console.error('[SendOTP] Error: Missing recipient');
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
        
        // // Only decrypt if IV exists (meaning the data is encrypted)
        // if (apiKey.emailConfig.iv) {
        //   console.log("Decrypting email credentials...");
        //   try {
        //     emailUser = decryptEmailConfig(emailUser, apiKey.emailConfig.iv);
        //     emailPass = decryptEmailConfig(emailPass, apiKey.emailConfig.iv);
        //     console.log(`Email decryption successful for: ${emailUser.slice(0, 5)}...`);
        //     console.loglog(emailUser, emailPass);
        //   } catch (decryptError) {
        //     console.error("Decryption error:", decryptError);
        //     // If decryption fails, try using the stored values directly
        //     console.log("Falling back to stored credentials without decryption");
        //     emailUser = apiKey.emailConfig.email;
        //     emailPass = apiKey.emailConfig.password;
        //   }
        // }
        
        console.log(`Attempting to send email using ${emailUser} via ${apiKey.emailConfig.service}`);
        
        // Configure nodemailer with stored credentials
        const transporter = nodemailer.createTransport({
          service: apiKey.emailConfig.service || "Gmail",
          host: 'smtp.gmail.com',
          port: 465,
          secure: true, 
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
        
        // Update OTP log to reflect sent status (not delivered)
        otpLog.status = "sent";  // Changed from "delivered" to "sent"
        await otpLog.save();
        console.log(`OTP status updated to 'sent' for ${recipient}`);
        
      } catch (emailError) {
        console.error("Error sending email:", emailError);
        
        // Update OTP log to reflect failure
        otpLog.status = "failed";
        await otpLog.save();
        
        // Provide more specific error messages
        const errorMessage = emailError.message.toLowerCase();
        
        // Authentication errors
        if (errorMessage.includes("535") || 
            errorMessage.includes("534") ||
            errorMessage.includes("authentication failed") || 
            errorMessage.includes("password not accepted") || 
            errorMessage.includes("invalid login") ||
            errorMessage.includes("invalid credentials")) {
          
          if (apiKey.emailConfig.service?.toLowerCase() === "gmail") {
            let specificError = "Unknown Gmail authentication error";
            let specificSolution = "";

            if (errorMessage.includes("535-5.7.8")) {
              specificError = "Username and Password not accepted";
              specificSolution = "Verify your Gmail address and App Password";
            } else if (errorMessage.includes("534-5.7.9")) {
              specificError = "OAuth 2.0 authentication required";
              specificSolution = "Use App Password instead of regular password";
            } else if (errorMessage.includes("535-5.7.1")) {
              specificError = "Invalid credentials or access blocked";
              specificSolution = "Check if less secure app access is enabled";
            }

            return res.json({
              success: false,
              message: "Gmail authentication failed",
              error: specificError,
              solution: specificSolution,
              requiredSteps: [
          "1. Enable 2-Step Verification in Google Account",
          "2. Generate new App Password from Google Account Security",
          "3. Use the 16-character App Password without spaces",
          "4. Make sure you're using your full Gmail address"
              ],
              moreInfo: "https://support.google.com/mail/answer/185833",
              originalError: errorMessage
            });
        } else if (errorMessage.includes("timeout") || errorMessage.includes("etimedout")) {
            return res.json({
              success: false,
              message: "Connection timed out",
              details: "Email server is not responding",
              solution: "Try again later or check email server settings",
              error: errorMessage
            });
        } else if (errorMessage.includes("certificate") || errorMessage.includes("ssl")) {
            return res.json({
              success: false,
              message: "SSL/TLS Error",
              details: "Secure connection failed",
              solution: "Check email server SSL settings",
              error: errorMessage
            });
        } else {
            return res.json({
              success: false,
              message: "Email server error",
              details: "Could not connect to email service",
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
    // Enhanced error logging
    console.error('[SendOTP] Critical error:', {
      error: error.message,
      stack: error.stack,
      recipient,
      channel,
      apiKeyId: req.user?.apiKeyId,
      userId: req.user?.userId,
      timestamp: new Date().toISOString()
    });

    // Categorize errors for better client feedback
    let errorMessage = "Failed to send OTP";
    if (error.code === 'ECONNREFUSED') {
      errorMessage = "Email service connection failed. Please check your email configuration.";
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = "Request timed out. Please try again.";
    } else if (error.message.includes('authentication')) {
      errorMessage = "Email authentication failed. Please check your credentials.";
    }

    return res.json({
      success: false,
      message: errorMessage,
      error: error.message,
      errorCode: error.code || 'UNKNOWN'
    });
  }
};

// VERIFY OTP
export const verifyOtp = async (req, res) => {
  const { recipient, otp } = req.body;
  
  console.log(`[VerifyOTP] Verification attempt:`, {
    recipient,
    otp,  // Log full OTP during development/debugging
    apiKeyId: req.user?.apiKeyId,
    userId: req.user?.userId,
    timestamp: new Date().toISOString()
  });
  
  if (!recipient || !otp) {
    console.error('[VerifyOTP] Error: Missing required fields', {
      hasRecipient: !!recipient,
      hasOTP: !!otp
    });
    return res.json({
      success: false,
      message: "Recipient and OTP are required"
    });
  }
  
  try {
    // First, find any OTP record for this recipient, regardless of status
    const anyOtpLog = await OtpLog.findOne({
      recipient,
      apiKey: req.user.apiKeyId,
      user: req.user.userId
    }).sort({ sentAt: -1 });

    if (!anyOtpLog) {
      console.log(`No OTP found for recipient: ${recipient}`);
      return res.json({
        success: false,
        message: "No OTP was generated for this recipient"
      });
    }

    // Now check for valid OTP
    const otpLog = await OtpLog.findOne({
      recipient,
      otp,
      apiKey: req.user.apiKeyId,
      user: req.user.userId,
      status: { $in: ["sent", "pending"] }  // Only check non-delivered/non-expired OTPs
    }).sort({ sentAt: -1 });

    if (!otpLog) {
      // Try to find any OTP to give better error message
      const anyOtp = await OtpLog.findOne({
        recipient,
        otp,
        apiKey: req.user.apiKeyId,
        user: req.user.userId
      }).sort({ sentAt: -1 });

      if (!anyOtp) {
        return res.json({
          success: false,
          message: "Invalid OTP code"
        });
      }

      if (anyOtp.status === "delivered") {
        return res.json({
          success: false,
          message: "This OTP has already been used"
        });
      }

      if (anyOtp.status === "expired") {
        return res.json({
          success: false,
          message: "This OTP has expired"
        });
      }
    }

    // Check if OTP is expired
    if (otpLog.otpExpiry < new Date()) {
      otpLog.status = "expired";
      await otpLog.save();
      return res.json({
        success: false,
        message: "OTP has expired. Please request a new one.",
        expired: true
      });
    }

    // Valid OTP found, mark it as delivered
    otpLog.status = "delivered";
    otpLog.deliveredAt = new Date();
    await otpLog.save();
    
    console.log(`OTP verified successfully for recipient: ${recipient}`);
    return res.json({
      success: true,
      message: "OTP verified successfully",
      verified: true
    });
  } catch (error) {
    console.error('[VerifyOTP] Critical error:', {
      error: error.message,
      stack: error.stack,
      recipient,
      otpLength: otp?.length,
      apiKeyId: req.user?.apiKeyId,
      userId: req.user?.userId,
      timestamp: new Date().toISOString()
    });

    return res.json({
      success: false,
      message: "Error verifying OTP",
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
