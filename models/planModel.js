import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const planSchema = new mongoose.Schema({
  name: { type: String, required: true },
  pricePerOtp: { type: Number, required: true },
  monthlyLimit: { type: Number, required: true },
  description: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const planModel = mongoose.models.plan || mongoose.model('plan', planSchema);

export default planModel;
