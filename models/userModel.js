import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const userSchema = new mongoose.Schema({
    companyName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  contactNumber: { type: String, required: true },
  taxIdentificationNumber: { type: String, required: true },
  businessPan: { type: String, required: true },
  registeredBusinessId: { type: String, required: true },
  // Configuration for sending OTPs from the company's own email/number
  // Optional: subscription plan for pricing/usage limits
  subscriptionPlan: { type: Schema.Types.ObjectId, ref: 'Plan' },
  createdAt: { type: Date, default: Date.now }
});
  
const userModel = mongoose.models.user || mongoose.model('user', userSchema);

export default userModel;
