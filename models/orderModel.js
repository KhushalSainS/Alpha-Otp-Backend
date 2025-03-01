import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const orderSchema = new mongoose.Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true }, // e.g., amount paid for credits
  creditsPurchased: { type: Number, required: true }, // Number of OTP credits added to the wallet
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const orderModel = mongoose.models.order || mongoose.model('order', orderSchema);

export default orderModel;
