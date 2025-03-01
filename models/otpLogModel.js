import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const otpLogSchema = new mongoose.Schema({
  apiKey: { 
    type: Schema.Types.ObjectId, 
    ref: 'apiKey', 
    required: true 
  },
  user: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  recipient: { 
    type: String, 
    required: true 
  },
  channel: { 
    type: String, 
    enum: ['email', 'sms'], 
    default: 'email' 
  },
  otp: { 
    type: String, 
    required: true 
  },
  otpExpiry: { 
    type: Date, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'delivered', 'failed', 'expired', 'sent'], 
    default: 'pending' 
  },
  sentAt: { 
    type: Date, 
    default: Date.now 
  },
  deliveredAt: { 
    type: Date 
  }
}, { 
  timestamps: true 
});

const OtpLog = mongoose.models.OtpLog || mongoose.model('OtpLog', otpLogSchema);

export default OtpLog;
